"""Strict parser for the authoritative Penumbra wild-encounter export."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from app.ingestion.penumbra.models import (
    Encounter,
    EncounterPool,
    EncounterTable,
    MapGroup,
    MapLocation,
    ParsedDataset,
    SourceMetadata,
    TimeOfDay,
)

PARSER_VERSION = "1.0.0"
SOURCE_NAME = "penumbra-wild-encounters"

_SEPARATOR = "=========="
_MAP_REFERENCE_PATTERN = re.compile(r"(?P<number>\d{3}) - (?P<name>.+)")
_TABLES_PATTERN = re.compile(r"Tables: (?P<count>\d+)")
_SECTION_PATTERN = re.compile(r"Table (?P<number>\d+) \((?P<time>Day|Night)\):")
_POOL_PATTERN = re.compile(
    r"(?P<label>Encounters|SOS Slot (?P<slot>[1-7])) "
    r"\(Levels (?P<minimum>\d+)-(?P<maximum>\d+)\): (?P<entries>.+)"
)
_ENCOUNTER_PATTERN = re.compile(r"(?P<name>.+) \((?P<rate>\d+)%\)")
_ADDITIONAL_PREFIX = "Additional SOS encounters: "


class PenumbraParseError(ValueError):
    """Raised when the source does not match its declared structure."""

    def __init__(self, message: str, line_number: int, line: str | None = None) -> None:
        context = "<end of file>" if line is None else repr(line)
        super().__init__(f"line {line_number}: {message}; found {context}")
        self.line_number = line_number
        self.line = line


class _Cursor:
    def __init__(self, lines: list[str]) -> None:
        self.lines = lines
        self.index = 0

    @property
    def at_end(self) -> bool:
        return self.index >= len(self.lines)

    @property
    def line_number(self) -> int:
        return self.index + 1

    def take(self) -> tuple[str, int]:
        if self.at_end:
            raise PenumbraParseError("unexpected end of source", self.line_number)
        line_number = self.line_number
        line = self.lines[self.index]
        self.index += 1
        return line, line_number

    def expect(self, expected: str) -> int:
        line, line_number = self.take()
        if line != expected:
            raise PenumbraParseError(f"expected {expected!r}", line_number, line)
        return line_number


def read_source_metadata(source_path: Path) -> tuple[SourceMetadata, bytes]:
    """Read source bytes once and calculate metadata without parsing records."""
    resolved_path = source_path.resolve()
    raw_bytes = resolved_path.read_bytes()
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise PenumbraParseError(
            f"source is not valid UTF-8: {error.reason}",
            raw_bytes[: error.start].count(b"\n") + 1,
        ) from error

    lines = text.splitlines()
    metadata = SourceMetadata(
        source_name=SOURCE_NAME,
        source_filename=resolved_path.name,
        source_path=resolved_path,
        sha256=hashlib.sha256(raw_bytes).hexdigest(),
        byte_count=len(raw_bytes),
        line_count=len(lines),
        nonblank_line_count=sum(bool(line.strip()) for line in lines),
        parser_version=PARSER_VERSION,
    )
    return metadata, raw_bytes


def parse_source(source_path: Path) -> ParsedDataset:
    metadata, raw_bytes = read_source_metadata(source_path)
    return parse_bytes(raw_bytes, metadata=metadata)


def parse_text(text: str, source_filename: str = "fixture.txt") -> ParsedDataset:
    raw_bytes = text.encode("utf-8")
    lines = text.splitlines()
    metadata = SourceMetadata(
        source_name=SOURCE_NAME,
        source_filename=source_filename,
        source_path=Path(source_filename),
        sha256=hashlib.sha256(raw_bytes).hexdigest(),
        byte_count=len(raw_bytes),
        line_count=len(lines),
        nonblank_line_count=sum(bool(line.strip()) for line in lines),
        parser_version=PARSER_VERSION,
    )
    return parse_bytes(raw_bytes, metadata=metadata)


def parse_bytes(raw_bytes: bytes, metadata: SourceMetadata) -> ParsedDataset:
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise PenumbraParseError(
            f"source is not valid UTF-8: {error.reason}",
            raw_bytes[: error.start].count(b"\n") + 1,
        ) from error

    cursor = _Cursor(text.splitlines())
    map_groups: list[MapGroup] = []

    while not cursor.at_end:
        cursor.expect(_SEPARATOR)
        map_groups.append(_parse_map_group(cursor, len(map_groups) + 1))
        cursor.expect(_SEPARATOR)

    return ParsedDataset(metadata=metadata, map_groups=tuple(map_groups))


def _parse_map_group(cursor: _Cursor, source_sequence: int) -> MapGroup:
    map_line, map_line_number = cursor.take()
    if not map_line.startswith("Map: "):
        raise PenumbraParseError("expected Map: header", map_line_number, map_line)

    raw_header = map_line.removeprefix("Map: ")
    locations: list[MapLocation] = []
    for source_order, raw_reference in enumerate(raw_header.split(" / "), start=1):
        match = _MAP_REFERENCE_PATTERN.fullmatch(raw_reference)
        if not match:
            raise PenumbraParseError(
                "invalid map reference; expected NNN - literal location name",
                map_line_number,
                raw_reference,
            )
        locations.append(
            MapLocation(
                source_order=source_order,
                raw_map_number=int(match.group("number")),
                source_location_name=match.group("name"),
                raw_reference=raw_reference,
            )
        )

    tables_line, tables_line_number = cursor.take()
    tables_match = _TABLES_PATTERN.fullmatch(tables_line)
    if not tables_match:
        raise PenumbraParseError("expected Tables: count", tables_line_number, tables_line)
    declared_table_count = int(tables_match.group("count"))

    tables: list[EncounterTable] = []
    for source_order in range(1, declared_table_count + 1):
        day_table_number, day_start, day_end, day_pools = _parse_section(cursor, "day")
        cursor.expect("")
        night_table_number, _, night_end, night_pools = _parse_section(cursor, "night")
        cursor.expect("")
        if night_table_number != day_table_number:
            raise PenumbraParseError(
                f"Night table number {night_table_number} does not match Day table {day_table_number}",
                night_end,
            )
        tables.append(
            EncounterTable(
                source_table_number=day_table_number,
                source_order=source_order,
                source_line_start=day_start,
                source_line_end=night_end,
                pools=tuple([*day_pools, *night_pools]),
            )
        )

    source_line_end = tables[-1].source_line_end if tables else tables_line_number
    return MapGroup(
        source_sequence=source_sequence,
        raw_header=raw_header,
        declared_table_count=declared_table_count,
        source_line_start=map_line_number,
        source_line_end=source_line_end,
        locations=tuple(locations),
        tables=tuple(tables),
    )


def _parse_section(
    cursor: _Cursor,
    expected_time_of_day: TimeOfDay,
) -> tuple[int, int, int, list[EncounterPool]]:
    section_line, section_line_number = cursor.take()
    section_match = _SECTION_PATTERN.fullmatch(section_line)
    if not section_match:
        raise PenumbraParseError("expected Table N (Day/Night) header", section_line_number, section_line)

    parsed_time: TimeOfDay = "day" if section_match.group("time") == "Day" else "night"
    if parsed_time != expected_time_of_day:
        raise PenumbraParseError(
            f"expected {expected_time_of_day.title()} section",
            section_line_number,
            section_line,
        )

    pools = [_parse_percentage_pool(cursor, parsed_time, expected_slot=None)]
    for sos_slot in range(1, 8):
        pools.append(_parse_percentage_pool(cursor, parsed_time, expected_slot=sos_slot))
    additional_pool, additional_line_number = _parse_additional_pool(cursor, parsed_time)
    pools.append(additional_pool)

    return (
        int(section_match.group("number")),
        section_line_number,
        additional_line_number,
        pools,
    )


def _parse_percentage_pool(
    cursor: _Cursor,
    time_of_day: TimeOfDay,
    expected_slot: int | None,
) -> EncounterPool:
    line, line_number = cursor.take()
    match = _POOL_PATTERN.fullmatch(line)
    expected_label = "Encounters" if expected_slot is None else f"SOS Slot {expected_slot}"
    if not match or match.group("label") != expected_label:
        raise PenumbraParseError(f"expected {expected_label} pool", line_number, line)

    encounters: list[Encounter] = []
    source_entries = match.group("entries").split(", ")
    empty_count = 0
    empty_rate_total = 0
    rate_total = 0
    for source_order, raw_entry in enumerate(source_entries, start=1):
        encounter_match = _ENCOUNTER_PATTERN.fullmatch(raw_entry)
        if not encounter_match:
            raise PenumbraParseError(
                "invalid encounter entry; expected literal name (N%)",
                line_number,
                raw_entry,
            )
        name = encounter_match.group("name")
        rate = int(encounter_match.group("rate"))
        rate_total += rate
        if name == "(None)":
            empty_count += 1
            empty_rate_total += rate
            continue
        encounters.append(
            Encounter(
                source_order=source_order,
                source_pokemon_name=name,
                rate_percent=rate,
                source_line_number=line_number,
            )
        )

    return EncounterPool(
        time_of_day=time_of_day,
        pool_type="normal" if expected_slot is None else "sos",
        sos_slot=expected_slot,
        source_order=1 if expected_slot is None else expected_slot + 1,
        min_level=int(match.group("minimum")),
        max_level=int(match.group("maximum")),
        source_line_number=line_number,
        source_entry_count=len(source_entries),
        empty_entry_count=empty_count,
        empty_rate_total_percent=empty_rate_total,
        rate_total_percent=rate_total,
        encounters=tuple(encounters),
    )


def _parse_additional_pool(
    cursor: _Cursor,
    time_of_day: TimeOfDay,
) -> tuple[EncounterPool, int]:
    line, line_number = cursor.take()
    if not line.startswith(_ADDITIONAL_PREFIX):
        raise PenumbraParseError("expected Additional SOS encounters pool", line_number, line)

    value = line.removeprefix(_ADDITIONAL_PREFIX)
    raw_entries = value.split(", ")
    encounters: list[Encounter] = []
    empty_count = 0
    for source_order, name in enumerate(raw_entries, start=1):
        if not name:
            raise PenumbraParseError("empty Additional SOS entry", line_number, line)
        if name == "(None)":
            empty_count += 1
            continue
        encounters.append(
            Encounter(
                source_order=source_order,
                source_pokemon_name=name,
                rate_percent=None,
                source_line_number=line_number,
            )
        )

    return (
        EncounterPool(
            time_of_day=time_of_day,
            pool_type="additional_sos",
            sos_slot=None,
            source_order=9,
            min_level=None,
            max_level=None,
            source_line_number=line_number,
            source_entry_count=len(raw_entries),
            empty_entry_count=empty_count,
            empty_rate_total_percent=None,
            rate_total_percent=None,
            encounters=tuple(encounters),
        ),
        line_number,
    )
