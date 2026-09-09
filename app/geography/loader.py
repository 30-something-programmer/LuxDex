"""Validate, report, and transactionally load researched geography mappings."""

from __future__ import annotations

import csv
import hashlib
import json
import logging
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Sequence

from psycopg import Connection
from psycopg.rows import dict_row

from app.database import connect_database
from app.geography.acquire import (
    DEFAULT_DESTINATION as DEFAULT_VANILLA_SOURCE_PATH,
    SOURCE_COMMIT,
    SOURCE_FILENAME,
    SOURCE_SHA256,
)
from app.ingestion.penumbra.parser import (
    SOURCE_NAME as PENUMBRA_SOURCE_NAME,
    parse_source,
)
from app.ingestion.pokemon.parser import SOURCE_NAME as POKEMON_SOURCE_NAME

LOGGER = logging.getLogger(__name__)
MAPPER_VERSION = "1.0.0"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CANONICAL_DIRECTORY = REPOSITORY_ROOT / "db" / "data" / "canonical" / "geography"
DEFAULT_SOURCE_LOCK_PATH = REPOSITORY_ROOT / "db" / "data" / "source" / "usum" / "source-lock.json"
DEFAULT_REPORT_PATH = DEFAULT_CANONICAL_DIRECTORY / "geography-coverage-report.json"

CSV_SCHEMAS = {
    "area-groups.csv": ["group_key", "display_name", "display_order", "group_type"],
    "locations.csv": [
        "area_group_key",
        "location_key",
        "display_name",
        "location_type",
        "display_order",
        "description",
    ],
    "encounter-places.csv": [
        "location_key",
        "place_key",
        "display_name",
        "subtitle",
        "encounter_method",
        "requirement",
        "display_order",
        "mapping_status",
    ],
    "source-references.csv": [
        "source_key",
        "source_title",
        "source_url",
        "source_type",
        "accessed_on",
        "source_note",
    ],
    "table-mappings.csv": [
        "mapping_key",
        "source_sequence",
        "source_table_number",
        "place_key",
        "mapping_method",
        "mapping_status",
        "mapping_note",
    ],
    "mapping-evidence.csv": [
        "mapping_key",
        "source_key",
        "evidence_order",
        "source_locator",
        "evidence_note",
    ],
}

KEY_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PLACEHOLDER_PATTERN = re.compile(r"^\s*(?:table|zone)\s+[0-9a-z]+\s*$|^\s*area\s+[a-z]\s*$", re.I)
MAPPING_METHODS = {
    "explicit_documentation",
    "vanilla_pool_match",
    "explicit_method_match",
    "route_subarea_match",
    "manual_verified",
}
ENCOUNTER_METHODS = {
    "grass",
    "surf",
    "fishing",
    "bubbling_fishing",
    "cave",
    "moving_shadow",
    "berry_pile",
    "special",
    "other",
}
SOURCE_TYPES = {
    "structured_dump",
    "location_reference",
    "walkthrough",
    "supporting_reference",
}


class GeographyValidationError(ValueError):
    """Raised when geography source or canonical mappings are not trustworthy."""


@dataclass(frozen=True)
class GeographyBundle:
    rows: dict[str, tuple[dict[str, str], ...]]
    sha256: str
    vanilla_map_count: int
    vanilla_table_count: int
    vanilla_structure: tuple[tuple[int, str, int, tuple[int, ...]], ...]


@dataclass(frozen=True)
class GeographyLoadResult:
    status: Literal["loaded", "replaced", "skipped"]
    build_id: int
    summary: dict[str, int | float]
    report_path: str


@dataclass(frozen=True)
class GeographyInputs:
    penumbra_dataset_id: int
    penumbra_sha256: str
    pokemon_dataset_id: int
    pokemon_sha256: str
    identity_build_id: int
    map_structure: tuple[tuple[int, str, int, tuple[int, ...]], ...]
    table_ids: dict[tuple[int, int], int]


def _relative_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPOSITORY_ROOT.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def _read_csv(path: Path, expected_fields: Sequence[str]) -> tuple[dict[str, str], ...]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        raise GeographyValidationError(f"canonical file must be UTF-8: {path}") from error
    reader = csv.DictReader(text.splitlines())
    if reader.fieldnames != list(expected_fields):
        raise GeographyValidationError(
            f"{path.name} columns must be {list(expected_fields)!r}; got {reader.fieldnames!r}"
        )

    rows: list[dict[str, str]] = []
    for line_number, raw_row in enumerate(reader, start=2):
        if None in raw_row:
            raise GeographyValidationError(f"unexpected extra CSV value at {path}:{line_number}")
        row = {field: (raw_row[field] or "").strip() for field in expected_fields}
        rows.append(row)
    return tuple(rows)


def _positive_int(value: str, field: str, context: str) -> int:
    try:
        number = int(value)
    except ValueError as error:
        raise GeographyValidationError(f"{context}: {field} must be an integer") from error
    if number <= 0:
        raise GeographyValidationError(f"{context}: {field} must be positive")
    return number


def _unique_index(
    rows: Sequence[dict[str, str]], field: str, filename: str
) -> dict[str, dict[str, str]]:
    index: dict[str, dict[str, str]] = {}
    for row in rows:
        key = row[field]
        if not key:
            raise GeographyValidationError(f"{filename}: blank {field}")
        if key in index:
            raise GeographyValidationError(f"{filename}: duplicate {field} {key!r}")
        index[key] = row
    return index


def _validate_display_order(
    rows: Sequence[dict[str, str]], parent_field: str | None, filename: str
) -> None:
    seen: set[tuple[str, int]] = set()
    for row in rows:
        order = _positive_int(row["display_order"], "display_order", filename)
        parent = row[parent_field] if parent_field else ""
        identity = (parent, order)
        if identity in seen:
            raise GeographyValidationError(
                f"{filename}: duplicate display_order {order} within {parent or 'root'}"
            )
        seen.add(identity)


def _canonical_sha256(canonical_directory: Path, source_lock_path: Path) -> str:
    digest = hashlib.sha256()
    for filename in [*CSV_SCHEMAS, "../source-lock.json"]:
        path = source_lock_path if filename == "../source-lock.json" else canonical_directory / filename
        digest.update(filename.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def load_and_validate_bundle(
    canonical_directory: Path = DEFAULT_CANONICAL_DIRECTORY,
    vanilla_source_path: Path = DEFAULT_VANILLA_SOURCE_PATH,
    source_lock_path: Path = DEFAULT_SOURCE_LOCK_PATH,
) -> GeographyBundle:
    """Validate files independent of PostgreSQL before a transaction begins."""

    rows = {
        filename: _read_csv(canonical_directory / filename, fields)
        for filename, fields in CSV_SCHEMAS.items()
    }
    source_lock = json.loads(source_lock_path.read_text(encoding="utf-8"))
    locked = source_lock.get("vanilla_encounters", {})
    if (
        locked.get("commit") != SOURCE_COMMIT
        or locked.get("filename") != SOURCE_FILENAME
        or locked.get("sha256") != SOURCE_SHA256
    ):
        raise GeographyValidationError("USUM source lock does not match the pinned acquisition contract")

    vanilla_bytes = vanilla_source_path.read_bytes()
    if hashlib.sha256(vanilla_bytes).hexdigest() != SOURCE_SHA256:
        raise GeographyValidationError("vanilla USUM encounter donor checksum does not match source-lock.json")
    if len(vanilla_bytes) != int(locked.get("byte_count", -1)):
        raise GeographyValidationError("vanilla USUM encounter donor byte count does not match source-lock.json")
    if len(vanilla_bytes.decode("utf-8").splitlines()) != int(locked.get("line_count", -1)):
        raise GeographyValidationError("vanilla USUM encounter donor line count does not match source-lock.json")

    vanilla = parse_source(vanilla_source_path)
    vanilla_structure = tuple(
        (
            group.source_sequence,
            group.raw_header,
            group.declared_table_count,
            tuple(table.source_table_number for table in group.tables),
        )
        for group in vanilla.map_groups
    )
    vanilla_table_count = sum(len(group.tables) for group in vanilla.map_groups)

    groups = _unique_index(rows["area-groups.csv"], "group_key", "area-groups.csv")
    locations = _unique_index(rows["locations.csv"], "location_key", "locations.csv")
    places = _unique_index(rows["encounter-places.csv"], "place_key", "encounter-places.csv")
    sources = _unique_index(rows["source-references.csv"], "source_key", "source-references.csv")
    mappings = _unique_index(rows["table-mappings.csv"], "mapping_key", "table-mappings.csv")

    if set(groups) != {"melemele", "akala", "ulaula", "poni", "other-special"}:
        raise GeographyValidationError("area groups must contain the four Alola islands and other-special")
    for key, row in groups.items():
        if not KEY_PATTERN.fullmatch(key) or not row["display_name"]:
            raise GeographyValidationError(f"invalid area group {key!r}")
        if row["group_type"] not in {"island", "other", "special"}:
            raise GeographyValidationError(f"invalid group_type for {key!r}")
    _validate_display_order(tuple(groups.values()), None, "area-groups.csv")

    for key, row in locations.items():
        if not KEY_PATTERN.fullmatch(key) or not row["display_name"] or not row["location_type"]:
            raise GeographyValidationError(f"invalid location {key!r}")
        if row["area_group_key"] not in groups:
            raise GeographyValidationError(f"location {key!r} references an unknown area group")
    _validate_display_order(tuple(locations.values()), "area_group_key", "locations.csv")

    for key, row in places.items():
        if not KEY_PATTERN.fullmatch(key) or not row["display_name"]:
            raise GeographyValidationError(f"invalid encounter place {key!r}")
        if row["location_key"] not in locations:
            raise GeographyValidationError(f"encounter place {key!r} references an unknown location")
        if row["encounter_method"] not in ENCOUNTER_METHODS:
            raise GeographyValidationError(f"encounter place {key!r} has an unsupported method")
        if row["mapping_status"] != "verified":
            raise GeographyValidationError(f"only verified encounter places may be canonical: {key!r}")
        if PLACEHOLDER_PATTERN.fullmatch(row["display_name"]):
            raise GeographyValidationError(f"placeholder encounter place is forbidden: {row['display_name']!r}")
    _validate_display_order(tuple(places.values()), "location_key", "encounter-places.csv")

    for key, row in sources.items():
        if not KEY_PATTERN.fullmatch(key) or not all(
            row[field] for field in ("source_title", "source_url", "accessed_on", "source_note")
        ):
            raise GeographyValidationError(f"invalid source reference {key!r}")
        if row["source_type"] not in SOURCE_TYPES:
            raise GeographyValidationError(f"invalid source type for {key!r}")

    mapped_tables: set[tuple[int, int]] = set()
    for key, row in mappings.items():
        if not KEY_PATTERN.fullmatch(key):
            raise GeographyValidationError(f"invalid mapping key {key!r}")
        raw_key = (
            _positive_int(row["source_sequence"], "source_sequence", key),
            _positive_int(row["source_table_number"], "source_table_number", key),
        )
        if raw_key in mapped_tables:
            raise GeographyValidationError(f"raw table {raw_key!r} has conflicting mappings")
        mapped_tables.add(raw_key)
        if row["place_key"] not in places:
            raise GeographyValidationError(f"mapping {key!r} references an unknown place")
        if row["mapping_method"] not in MAPPING_METHODS:
            raise GeographyValidationError(f"mapping {key!r} has an unsupported method")
        if row["mapping_status"] != "verified" or not row["mapping_note"]:
            raise GeographyValidationError(f"mapping {key!r} is not a documented verified mapping")

    evidence_by_mapping: dict[str, list[dict[str, str]]] = defaultdict(list)
    evidence_orders: set[tuple[str, int]] = set()
    evidence_sources: set[tuple[str, str]] = set()
    for row in rows["mapping-evidence.csv"]:
        mapping_key = row["mapping_key"]
        source_key = row["source_key"]
        if mapping_key not in mappings or source_key not in sources:
            raise GeographyValidationError("mapping evidence references an unknown mapping or source")
        order = _positive_int(row["evidence_order"], "evidence_order", mapping_key)
        if (mapping_key, order) in evidence_orders or (mapping_key, source_key) in evidence_sources:
            raise GeographyValidationError(f"duplicate evidence for mapping {mapping_key!r}")
        evidence_orders.add((mapping_key, order))
        evidence_sources.add((mapping_key, source_key))
        if not row["source_locator"] or not row["evidence_note"]:
            raise GeographyValidationError(f"blank evidence detail for mapping {mapping_key!r}")
        evidence_by_mapping[mapping_key].append(row)

    without_evidence = sorted(set(mappings) - set(evidence_by_mapping))
    if without_evidence:
        raise GeographyValidationError(f"verified mappings require evidence: {without_evidence!r}")

    vanilla_tables = {
        (sequence, table_number)
        for sequence, _, _, table_numbers in vanilla_structure
        for table_number in table_numbers
    }
    nonexistent = sorted(mapped_tables - vanilla_tables)
    if nonexistent:
        raise GeographyValidationError(f"mappings reference nonexistent vanilla raw tables: {nonexistent!r}")

    return GeographyBundle(
        rows=rows,
        sha256=_canonical_sha256(canonical_directory, source_lock_path),
        vanilla_map_count=len(vanilla.map_groups),
        vanilla_table_count=vanilla_table_count,
        vanilla_structure=vanilla_structure,
    )


def _fetch_inputs(connection: Connection[Any]) -> GeographyInputs:
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            "SELECT id, sha256 FROM luxdex.source_dataset WHERE source_name = %s",
            (PENUMBRA_SOURCE_NAME,),
        )
        penumbra = cursor.fetchone()
        if penumbra is None:
            raise GeographyValidationError("the Penumbra source dataset is not loaded")

        cursor.execute(
            """
            SELECT dataset.id, dataset.sha256
            FROM luxdex.source_dataset AS dataset
            JOIN luxdex.pokemon_source_dataset AS pokemon ON pokemon.dataset_id = dataset.id
            WHERE dataset.source_name = %s
            """,
            (POKEMON_SOURCE_NAME,),
        )
        pokemon = cursor.fetchone()
        if pokemon is None:
            raise GeographyValidationError("the canonical Pokémon dataset is not loaded")

        cursor.execute(
            """
            SELECT id
            FROM luxdex.penumbra_pokemon_identity_build
            WHERE penumbra_dataset_id = %s AND pokemon_dataset_id = %s
            """,
            (penumbra["id"], pokemon["id"]),
        )
        identity = cursor.fetchone()
        if identity is None:
            raise GeographyValidationError("the matching Penumbra Pokémon identity map is not built")

        cursor.execute(
            """
            SELECT
                map_group.source_sequence,
                map_group.raw_header,
                map_group.declared_table_count,
                COALESCE(
                    array_agg(encounter_table.source_table_number ORDER BY encounter_table.source_order)
                        FILTER (WHERE encounter_table.id IS NOT NULL),
                    ARRAY[]::integer[]
                ) AS table_numbers
            FROM luxdex.penumbra_map_group AS map_group
            LEFT JOIN luxdex.penumbra_encounter_table AS encounter_table
              ON encounter_table.map_group_id = map_group.id
            WHERE map_group.dataset_id = %s
            GROUP BY map_group.id
            ORDER BY map_group.source_sequence
            """,
            (penumbra["id"],),
        )
        map_structure = tuple(
            (
                int(row["source_sequence"]),
                str(row["raw_header"]),
                int(row["declared_table_count"]),
                tuple(int(number) for number in row["table_numbers"]),
            )
            for row in cursor.fetchall()
        )

        cursor.execute(
            """
            SELECT map_group.source_sequence, encounter_table.source_table_number, encounter_table.id
            FROM luxdex.penumbra_encounter_table AS encounter_table
            JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
            WHERE map_group.dataset_id = %s
            ORDER BY map_group.source_sequence, encounter_table.source_order
            """,
            (penumbra["id"],),
        )
        table_ids = {
            (int(row["source_sequence"]), int(row["source_table_number"])): int(row["id"])
            for row in cursor.fetchall()
        }

    return GeographyInputs(
        penumbra_dataset_id=int(penumbra["id"]),
        penumbra_sha256=str(penumbra["sha256"]),
        pokemon_dataset_id=int(pokemon["id"]),
        pokemon_sha256=str(pokemon["sha256"]),
        identity_build_id=int(identity["id"]),
        map_structure=map_structure,
        table_ids=table_ids,
    )


def _validate_database_structure(bundle: GeographyBundle, inputs: GeographyInputs) -> None:
    if inputs.map_structure != bundle.vanilla_structure:
        raise GeographyValidationError(
            "Penumbra map/table structure differs from the pinned vanilla Ultra Sun donor"
        )
    mapped_keys = {
        (int(row["source_sequence"]), int(row["source_table_number"]))
        for row in bundle.rows["table-mappings.csv"]
    }
    nonexistent = sorted(mapped_keys - set(inputs.table_ids))
    if nonexistent:
        raise GeographyValidationError(f"mappings reference nonexistent Penumbra tables: {nonexistent!r}")


def _summary(bundle: GeographyBundle) -> dict[str, int | float]:
    verified = len(bundle.rows["table-mappings.csv"])
    unresolved = bundle.vanilla_table_count - verified
    return {
        "total_raw_tables": bundle.vanilla_table_count,
        "verified_mapped_tables": verified,
        "probable_tables": 0,
        "unresolved_tables": unresolved,
        "coverage_percent": round(verified * 100 / bundle.vanilla_table_count, 2),
        "area_groups": len(bundle.rows["area-groups.csv"]),
        "locations": len(bundle.rows["locations.csv"]),
        "encounter_places": len(bundle.rows["encounter-places.csv"]),
    }


def build_coverage_report(bundle: GeographyBundle, inputs: GeographyInputs) -> dict[str, Any]:
    summary = _summary(bundle)
    mapped = {
        (int(row["source_sequence"]), int(row["source_table_number"]))
        for row in bundle.rows["table-mappings.csv"]
    }
    unresolved_groups = []
    for source_sequence, raw_header, _, table_numbers in inputs.map_structure:
        unresolved_numbers = [
            table_number
            for table_number in table_numbers
            if (source_sequence, table_number) not in mapped
        ]
        if unresolved_numbers:
            unresolved_groups.append(
                {
                    "source_sequence": source_sequence,
                    "raw_header": raw_header,
                    "unresolved_table_numbers": unresolved_numbers,
                    "unresolved_count": len(unresolved_numbers),
                }
            )

    places = {row["place_key"]: row for row in bundle.rows["encounter-places.csv"]}
    locations = {row["location_key"]: row for row in bundle.rows["locations.csv"]}
    sources = {row["source_key"]: row for row in bundle.rows["source-references.csv"]}
    mapping_location: dict[str, str] = {}
    for row in bundle.rows["table-mappings.csv"]:
        mapping_location[row["mapping_key"]] = places[row["place_key"]]["location_key"]

    evidence_mapping_types = {
        (row["mapping_key"], sources[row["source_key"]]["source_type"])
        for row in bundle.rows["mapping-evidence.csv"]
    }
    evidence_counts = Counter(source_type for _, source_type in evidence_mapping_types)
    method_counts = Counter(row["encounter_method"] for row in places.values())

    def example(location_keys: set[str]) -> list[dict[str, Any]]:
        return [
            {
                "mapping_key": row["mapping_key"],
                "source_sequence": int(row["source_sequence"]),
                "source_table_number": int(row["source_table_number"]),
                "place_key": row["place_key"],
                "place_label": places[row["place_key"]]["display_name"],
                "method": places[row["place_key"]]["encounter_method"],
            }
            for row in bundle.rows["table-mappings.csv"]
            if mapping_location[row["mapping_key"]] in location_keys
        ]

    return {
        "format_version": 1,
        "mapper_version": MAPPER_VERSION,
        "source_versions": {
            "penumbra_sha256": inputs.penumbra_sha256,
            "pokemon_master_sha256": inputs.pokemon_sha256,
            "canonical_bundle_sha256": bundle.sha256,
            "vanilla_source_file": _relative_path(DEFAULT_VANILLA_SOURCE_PATH),
            "vanilla_source_commit": SOURCE_COMMIT,
            "vanilla_source_sha256": SOURCE_SHA256,
        },
        "structural_validation": {
            "result": "exact_match",
            "vanilla_map_blocks": bundle.vanilla_map_count,
            "penumbra_map_blocks": len(inputs.map_structure),
            "vanilla_encounter_tables": bundle.vanilla_table_count,
            "penumbra_encounter_tables": len(inputs.table_ids),
            "content_matching_warning": "Penumbra pools are modified; only raw framework identity is shared.",
        },
        "summary": summary,
        "places_by_method": dict(sorted(method_counts.items())),
        "verified_mappings_by_evidence_type": dict(sorted(evidence_counts.items())),
        "area_groups": [
            {
                "key": row["group_key"],
                "display_name": row["display_name"],
                "group_type": row["group_type"],
            }
            for row in bundle.rows["area-groups.csv"]
        ],
        "locations": [
            {
                "key": key,
                "display_name": row["display_name"],
                "area_group_key": row["area_group_key"],
            }
            for key, row in locations.items()
        ],
        "worked_examples": {
            "route_1_hauoli_melemele_sea_trainers_school": example(
                {"route-1", "hauoli-outskirts", "melemele-sea", "trainers-school"}
            ),
            "route_3_kalae_bay": example({"route-3", "kalae-bay"}),
        },
        "probable_mappings": [],
        "unresolved_by_raw_map_block": unresolved_groups,
    }


def _write_report(report_path: Path, report: dict[str, Any]) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _find_unchanged_build(
    connection: Connection[Any], inputs: GeographyInputs, bundle: GeographyBundle
) -> int | None:
    summary = _summary(bundle)
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            SELECT build.id
            FROM luxdex.geography_build AS build
            WHERE build.penumbra_dataset_id = %s
              AND build.pokemon_dataset_id = %s
              AND build.identity_build_id = %s
              AND build.canonical_bundle_sha256 = %s
              AND build.mapper_version = %s
              AND build.vanilla_source_sha256 = %s
              AND build.vanilla_source_commit = %s
              AND build.total_table_count = %s
              AND build.verified_table_count = %s
              AND build.unresolved_table_count = %s
              AND (SELECT count(*) FROM luxdex.geography_area_group WHERE build_id = build.id) = %s
              AND (
                  SELECT count(*)
                  FROM luxdex.geography_location AS location
                  JOIN luxdex.geography_area_group AS area_group ON area_group.id = location.area_group_id
                  WHERE area_group.build_id = build.id
              ) = %s
              AND (
                  SELECT count(*)
                  FROM luxdex.geography_encounter_place AS place
                  JOIN luxdex.geography_location AS location ON location.id = place.location_id
                  JOIN luxdex.geography_area_group AS area_group ON area_group.id = location.area_group_id
                  WHERE area_group.build_id = build.id
              ) = %s
              AND (
                  SELECT count(*)
                  FROM luxdex.geography_encounter_place_table_map AS table_map
                  JOIN luxdex.geography_encounter_place AS place ON place.id = table_map.encounter_place_id
                  JOIN luxdex.geography_location AS location ON location.id = place.location_id
                  JOIN luxdex.geography_area_group AS area_group ON area_group.id = location.area_group_id
                  WHERE area_group.build_id = build.id
              ) = %s
            """,
            (
                inputs.penumbra_dataset_id,
                inputs.pokemon_dataset_id,
                inputs.identity_build_id,
                bundle.sha256,
                MAPPER_VERSION,
                SOURCE_SHA256,
                SOURCE_COMMIT,
                summary["total_raw_tables"],
                summary["verified_mapped_tables"],
                summary["unresolved_tables"],
                summary["area_groups"],
                summary["locations"],
                summary["encounter_places"],
                summary["verified_mapped_tables"],
            ),
        )
        row = cursor.fetchone()
    return int(row["id"]) if row else None


def _raw_table_fingerprint(connection: Connection[Any], dataset_id: int) -> tuple[int, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT count(*)::integer,
                   md5(string_agg(encounter_table.id::text || chr(31)
                       || map_group.source_sequence::text || chr(31)
                       || encounter_table.source_table_number::text,
                       chr(30) ORDER BY encounter_table.id))
            FROM luxdex.penumbra_encounter_table AS encounter_table
            JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
            WHERE map_group.dataset_id = %s
            """,
            (dataset_id,),
        )
        row = cursor.fetchone()
    if row is None:
        raise GeographyValidationError("could not fingerprint Penumbra encounter tables")
    return int(row[0]), str(row[1])


def _persist(
    connection: Connection[Any], inputs: GeographyInputs, bundle: GeographyBundle
) -> tuple[Literal["loaded", "replaced", "skipped"], int]:
    unchanged = _find_unchanged_build(connection, inputs, bundle)
    if unchanged is not None:
        return "skipped", unchanged

    summary = _summary(bundle)
    before_fingerprint = _raw_table_fingerprint(connection, inputs.penumbra_dataset_id)
    with connection.transaction():
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute("LOCK TABLE luxdex.geography_build IN SHARE ROW EXCLUSIVE MODE")
            unchanged = _find_unchanged_build(connection, inputs, bundle)
            if unchanged is not None:
                return "skipped", unchanged

            cursor.execute(
                "DELETE FROM luxdex.geography_build WHERE penumbra_dataset_id = %s",
                (inputs.penumbra_dataset_id,),
            )
            status: Literal["loaded", "replaced", "skipped"] = (
                "replaced" if cursor.rowcount else "loaded"
            )
            cursor.execute(
                """
                INSERT INTO luxdex.geography_build (
                    penumbra_dataset_id, pokemon_dataset_id, identity_build_id,
                    canonical_bundle_sha256, mapper_version,
                    vanilla_source_filename, vanilla_source_sha256, vanilla_source_commit,
                    total_table_count, verified_table_count, unresolved_table_count
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    inputs.penumbra_dataset_id,
                    inputs.pokemon_dataset_id,
                    inputs.identity_build_id,
                    bundle.sha256,
                    MAPPER_VERSION,
                    _relative_path(DEFAULT_VANILLA_SOURCE_PATH),
                    SOURCE_SHA256,
                    SOURCE_COMMIT,
                    summary["total_raw_tables"],
                    summary["verified_mapped_tables"],
                    summary["unresolved_tables"],
                ),
            )
            build_id = int(cursor.fetchone()["id"])

            cursor.executemany(
                """
                INSERT INTO luxdex.geography_area_group
                    (build_id, group_key, display_name, display_order, group_type)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        build_id,
                        row["group_key"],
                        row["display_name"],
                        int(row["display_order"]),
                        row["group_type"],
                    )
                    for row in bundle.rows["area-groups.csv"]
                ],
            )
            cursor.execute(
                "SELECT id, group_key FROM luxdex.geography_area_group WHERE build_id = %s",
                (build_id,),
            )
            group_ids = {str(row["group_key"]): int(row["id"]) for row in cursor.fetchall()}

            cursor.executemany(
                """
                INSERT INTO luxdex.geography_location
                    (area_group_id, location_key, display_name, location_type, display_order, description)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        group_ids[row["area_group_key"]],
                        row["location_key"],
                        row["display_name"],
                        row["location_type"],
                        int(row["display_order"]),
                        row["description"] or None,
                    )
                    for row in bundle.rows["locations.csv"]
                ],
            )
            cursor.execute("SELECT id, location_key FROM luxdex.geography_location")
            location_ids = {
                str(row["location_key"]): int(row["id"]) for row in cursor.fetchall()
            }

            cursor.executemany(
                """
                INSERT INTO luxdex.geography_encounter_place (
                    location_id, place_key, display_name, subtitle, encounter_method,
                    requirement, display_order, mapping_status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        location_ids[row["location_key"]],
                        row["place_key"],
                        row["display_name"],
                        row["subtitle"] or None,
                        row["encounter_method"],
                        row["requirement"] or None,
                        int(row["display_order"]),
                        row["mapping_status"],
                    )
                    for row in bundle.rows["encounter-places.csv"]
                ],
            )
            cursor.execute("SELECT id, place_key FROM luxdex.geography_encounter_place")
            place_ids = {str(row["place_key"]): int(row["id"]) for row in cursor.fetchall()}

            cursor.executemany(
                """
                INSERT INTO luxdex.geography_source_reference (
                    build_id, source_key, source_title, source_url,
                    source_type, accessed_on, source_note
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    (
                        build_id,
                        row["source_key"],
                        row["source_title"],
                        row["source_url"],
                        row["source_type"],
                        row["accessed_on"],
                        row["source_note"],
                    )
                    for row in bundle.rows["source-references.csv"]
                ],
            )
            cursor.execute(
                "SELECT id, source_key FROM luxdex.geography_source_reference WHERE build_id = %s",
                (build_id,),
            )
            source_ids = {str(row["source_key"]): int(row["id"]) for row in cursor.fetchall()}

            cursor.executemany(
                """
                INSERT INTO luxdex.geography_encounter_place_table_map (
                    encounter_place_id, penumbra_encounter_table_id,
                    mapping_method, mapping_status, mapping_note
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        place_ids[row["place_key"]],
                        inputs.table_ids[(int(row["source_sequence"]), int(row["source_table_number"]))],
                        row["mapping_method"],
                        row["mapping_status"],
                        row["mapping_note"],
                    )
                    for row in bundle.rows["table-mappings.csv"]
                ],
            )
            cursor.execute(
                """
                SELECT table_map.id, map_group.source_sequence, encounter_table.source_table_number
                FROM luxdex.geography_encounter_place_table_map AS table_map
                JOIN luxdex.penumbra_encounter_table AS encounter_table
                  ON encounter_table.id = table_map.penumbra_encounter_table_id
                JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
                JOIN luxdex.geography_encounter_place AS place ON place.id = table_map.encounter_place_id
                JOIN luxdex.geography_location AS location ON location.id = place.location_id
                JOIN luxdex.geography_area_group AS area_group ON area_group.id = location.area_group_id
                WHERE area_group.build_id = %s
                """,
                (build_id,),
            )
            mapping_ids_by_raw = {
                (int(row["source_sequence"]), int(row["source_table_number"])): int(row["id"])
                for row in cursor.fetchall()
            }
            mapping_rows = {
                row["mapping_key"]: row for row in bundle.rows["table-mappings.csv"]
            }
            cursor.executemany(
                """
                INSERT INTO luxdex.geography_mapping_evidence (
                    table_mapping_id, source_reference_id, evidence_order,
                    source_locator, evidence_note
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        mapping_ids_by_raw[
                            (
                                int(mapping_rows[row["mapping_key"]]["source_sequence"]),
                                int(mapping_rows[row["mapping_key"]]["source_table_number"]),
                            )
                        ],
                        source_ids[row["source_key"]],
                        int(row["evidence_order"]),
                        row["source_locator"],
                        row["evidence_note"],
                    )
                    for row in bundle.rows["mapping-evidence.csv"]
                ],
            )

            after_fingerprint = _raw_table_fingerprint(connection, inputs.penumbra_dataset_id)
            if after_fingerprint != before_fingerprint:
                raise RuntimeError("Penumbra raw encounter tables changed during geography build")

    return status, build_id


def build_geography(
    database_url: str | None = None,
    canonical_directory: Path = DEFAULT_CANONICAL_DIRECTORY,
    vanilla_source_path: Path = DEFAULT_VANILLA_SOURCE_PATH,
    source_lock_path: Path = DEFAULT_SOURCE_LOCK_PATH,
    report_path: Path = DEFAULT_REPORT_PATH,
) -> GeographyLoadResult:
    """Build the canonical geography layer after all dependent source data exists."""

    bundle = load_and_validate_bundle(canonical_directory, vanilla_source_path, source_lock_path)
    with connect_database(database_url) as connection:
        inputs = _fetch_inputs(connection)
        _validate_database_structure(bundle, inputs)
        report = build_coverage_report(bundle, inputs)
        _write_report(report_path, report)
        status, build_id = _persist(connection, inputs, bundle)

    LOGGER.info(
        json.dumps(
            {
                "event": "geography_build_completed",
                "status": status,
                "build_id": build_id,
                **report["summary"],
            },
            sort_keys=True,
        )
    )
    return GeographyLoadResult(
        status=status,
        build_id=build_id,
        summary=report["summary"],
        report_path=_relative_path(report_path),
    )
