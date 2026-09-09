"""Typed in-memory representation of the raw Penumbra encounter source."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

TimeOfDay = Literal["day", "night"]
PoolType = Literal["normal", "sos", "additional_sos"]


@dataclass(frozen=True, slots=True)
class SourceMetadata:
    source_name: str
    source_filename: str
    source_path: Path
    sha256: str
    byte_count: int
    line_count: int
    nonblank_line_count: int
    parser_version: str


@dataclass(frozen=True, slots=True)
class MapLocation:
    source_order: int
    raw_map_number: int
    source_location_name: str
    raw_reference: str


@dataclass(frozen=True, slots=True)
class Encounter:
    source_order: int
    source_pokemon_name: str
    rate_percent: int | None
    source_line_number: int


@dataclass(frozen=True, slots=True)
class EncounterPool:
    time_of_day: TimeOfDay
    pool_type: PoolType
    sos_slot: int | None
    source_order: int
    min_level: int | None
    max_level: int | None
    source_line_number: int
    source_entry_count: int
    empty_entry_count: int
    empty_rate_total_percent: int | None
    rate_total_percent: int | None
    encounters: tuple[Encounter, ...]


@dataclass(frozen=True, slots=True)
class EncounterTable:
    source_table_number: int
    source_order: int
    source_line_start: int
    source_line_end: int
    pools: tuple[EncounterPool, ...]


@dataclass(frozen=True, slots=True)
class MapGroup:
    source_sequence: int
    raw_header: str
    declared_table_count: int
    source_line_start: int
    source_line_end: int
    locations: tuple[MapLocation, ...]
    tables: tuple[EncounterTable, ...]


@dataclass(frozen=True, slots=True)
class ParsedDataset:
    metadata: SourceMetadata
    map_groups: tuple[MapGroup, ...]


@dataclass(frozen=True, slots=True)
class RegressionCounts:
    source_datasets: int
    map_groups: int
    map_locations: int
    encounter_tables: int
    encounter_pools: int
    normal_encounters: int
    sos_encounters: int
    additional_sos_encounters: int
    unique_pokemon_names: int
    zero_table_map_groups: int
    day_night_different_tables: int
    total_encounters: int
    source_byte_count: int
    source_line_count: int
    source_nonblank_line_count: int
    source_sha256: str

    def to_dict(self) -> dict[str, int | str]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class LoadResult:
    status: Literal["loaded", "replaced", "skipped"]
    dataset_id: int
    counts: RegressionCounts
