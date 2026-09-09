"""Transactional, idempotent PostgreSQL loader for Penumbra encounters."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

from app.database import connect_database
from app.ingestion.penumbra.models import (
    LoadResult,
    ParsedDataset,
    RegressionCounts,
    SourceMetadata,
)
from app.ingestion.penumbra.parser import parse_bytes, read_source_metadata
from app.ingestion.penumbra.validator import validate_dataset

LOGGER = logging.getLogger(__name__)
DEFAULT_SOURCE_PATH = (
    Path(__file__).resolve().parents[3]
    / "db"
    / "data"
    / "source"
    / "penumbra"
    / "wild-encounters.txt"
)


def _log_event(event: str, **fields: Any) -> None:
    LOGGER.info(json.dumps({"event": event, **fields}, sort_keys=True, default=str))


def ensure_penumbra_dataset(
    database_url: str | None = None,
    source_path: Path = DEFAULT_SOURCE_PATH,
) -> LoadResult:
    metadata, raw_bytes = read_source_metadata(source_path)
    _log_event(
        "penumbra_source_opened",
        path=metadata.source_path,
        sha256=metadata.sha256,
        byte_count=metadata.byte_count,
        line_count=metadata.line_count,
        nonblank_line_count=metadata.nonblank_line_count,
    )

    with connect_database(database_url) as connection:
        existing = _find_dataset(connection, metadata.source_name)
        if existing and existing["sha256"] == metadata.sha256:
            counts = fetch_persisted_counts(connection, existing["id"])
            _log_event(
                "penumbra_dataset_skipped_unchanged",
                dataset_id=existing["id"],
                sha256=metadata.sha256,
                total_encounters=counts.total_encounters,
            )
            return LoadResult(status="skipped", dataset_id=existing["id"], counts=counts)

    _log_event("penumbra_parse_started", parser_version=metadata.parser_version)
    dataset = parse_bytes(raw_bytes, metadata=metadata)
    _log_event(
        "penumbra_parse_completed",
        map_groups=len(dataset.map_groups),
        sha256=metadata.sha256,
    )
    parsed_counts = validate_dataset(dataset)
    _log_event("penumbra_validation_completed", **parsed_counts.to_dict())

    with connect_database(database_url) as connection:
        with connection.transaction():
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute("LOCK TABLE luxdex.source_dataset IN SHARE ROW EXCLUSIVE MODE")
                cursor.execute(
                    "SELECT id, sha256 FROM luxdex.source_dataset WHERE source_name = %s",
                    (metadata.source_name,),
                )
                current = cursor.fetchone()
                if current and current["sha256"] == metadata.sha256:
                    counts = fetch_persisted_counts(connection, current["id"])
                    _log_event(
                        "penumbra_dataset_skipped_unchanged",
                        dataset_id=current["id"],
                        sha256=metadata.sha256,
                        total_encounters=counts.total_encounters,
                    )
                    return LoadResult(status="skipped", dataset_id=current["id"], counts=counts)

                status = "replaced" if current else "loaded"
                if current:
                    _log_event(
                        "penumbra_dataset_replacement_started",
                        old_dataset_id=current["id"],
                        old_sha256=current["sha256"],
                        new_sha256=metadata.sha256,
                    )
                    cursor.execute(
                        "DELETE FROM luxdex.source_dataset WHERE id = %s",
                        (current["id"],),
                    )

                _log_event("penumbra_transaction_started", load_status=status)
                dataset_id = _insert_dataset(cursor, dataset)
                _insert_map_groups(cursor, dataset_id, dataset)
                persisted_counts = fetch_persisted_counts(connection, dataset_id)
                if persisted_counts != parsed_counts:
                    raise RuntimeError(
                        "persisted Penumbra regression counts differ from validated parsed counts: "
                        f"parsed={parsed_counts.to_dict()} persisted={persisted_counts.to_dict()}"
                    )

        _log_event(
            "penumbra_database_load_completed",
            status=status,
            dataset_id=dataset_id,
            **persisted_counts.to_dict(),
        )
        return LoadResult(status=status, dataset_id=dataset_id, counts=persisted_counts)


def _find_dataset(connection: Connection, source_name: str) -> dict[str, Any] | None:
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            "SELECT id, sha256 FROM luxdex.source_dataset WHERE source_name = %s",
            (source_name,),
        )
        return cursor.fetchone()


def _insert_dataset(cursor: Any, dataset: ParsedDataset) -> int:
    metadata = dataset.metadata
    cursor.execute(
        """
        INSERT INTO luxdex.source_dataset (
            source_name,
            source_filename,
            sha256,
            byte_count,
            line_count,
            nonblank_line_count,
            parser_version
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            metadata.source_name,
            metadata.source_filename,
            metadata.sha256,
            metadata.byte_count,
            metadata.line_count,
            metadata.nonblank_line_count,
            metadata.parser_version,
        ),
    )
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError("source dataset insert returned no identifier")
    return int(row["id"])


def _insert_map_groups(cursor: Any, dataset_id: int, dataset: ParsedDataset) -> None:
    cursor.executemany(
        """
        INSERT INTO luxdex.penumbra_map_group (
            dataset_id,
            source_sequence,
            raw_header,
            declared_table_count,
            source_line_start,
            source_line_end
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        [
            (
                dataset_id,
                group.source_sequence,
                group.raw_header,
                group.declared_table_count,
                group.source_line_start,
                group.source_line_end,
            )
            for group in dataset.map_groups
        ],
    )
    cursor.execute(
        """
        SELECT id, source_sequence
        FROM luxdex.penumbra_map_group
        WHERE dataset_id = %s
        """,
        (dataset_id,),
    )
    group_ids = {row["source_sequence"]: row["id"] for row in cursor.fetchall()}

    cursor.executemany(
        """
        INSERT INTO luxdex.penumbra_map_location (
            map_group_id,
            source_order,
            raw_map_number,
            source_location_name,
            raw_reference
        )
        VALUES (%s, %s, %s, %s, %s)
        """,
        [
            (
                group_ids[group.source_sequence],
                location.source_order,
                location.raw_map_number,
                location.source_location_name,
                location.raw_reference,
            )
            for group in dataset.map_groups
            for location in group.locations
        ],
    )

    cursor.executemany(
        """
        INSERT INTO luxdex.penumbra_encounter_table (
            map_group_id,
            source_table_number,
            source_order,
            source_line_start,
            source_line_end
        )
        VALUES (%s, %s, %s, %s, %s)
        """,
        [
            (
                group_ids[group.source_sequence],
                table.source_table_number,
                table.source_order,
                table.source_line_start,
                table.source_line_end,
            )
            for group in dataset.map_groups
            for table in group.tables
        ],
    )
    cursor.execute(
        """
        SELECT encounter_table.id, map_group.source_sequence, encounter_table.source_table_number
        FROM luxdex.penumbra_encounter_table AS encounter_table
        JOIN luxdex.penumbra_map_group AS map_group
          ON map_group.id = encounter_table.map_group_id
        WHERE map_group.dataset_id = %s
        """,
        (dataset_id,),
    )
    table_ids = {
        (row["source_sequence"], row["source_table_number"]): row["id"]
        for row in cursor.fetchall()
    }

    cursor.executemany(
        """
        INSERT INTO luxdex.penumbra_encounter_pool (
            encounter_table_id,
            time_of_day,
            pool_type,
            sos_slot,
            source_order,
            min_level,
            max_level,
            source_line_number,
            source_entry_count,
            empty_entry_count,
            empty_rate_total_percent,
            rate_total_percent
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        [
            (
                table_ids[(group.source_sequence, table.source_table_number)],
                pool.time_of_day,
                pool.pool_type,
                pool.sos_slot,
                pool.source_order,
                pool.min_level,
                pool.max_level,
                pool.source_line_number,
                pool.source_entry_count,
                pool.empty_entry_count,
                pool.empty_rate_total_percent,
                pool.rate_total_percent,
            )
            for group in dataset.map_groups
            for table in group.tables
            for pool in table.pools
        ],
    )
    cursor.execute(
        """
        SELECT
            encounter_pool.id,
            map_group.source_sequence,
            encounter_table.source_table_number,
            encounter_pool.time_of_day,
            encounter_pool.pool_type,
            encounter_pool.sos_slot
        FROM luxdex.penumbra_encounter_pool AS encounter_pool
        JOIN luxdex.penumbra_encounter_table AS encounter_table
          ON encounter_table.id = encounter_pool.encounter_table_id
        JOIN luxdex.penumbra_map_group AS map_group
          ON map_group.id = encounter_table.map_group_id
        WHERE map_group.dataset_id = %s
        """,
        (dataset_id,),
    )
    pool_ids = {
        (
            row["source_sequence"],
            row["source_table_number"],
            row["time_of_day"],
            row["pool_type"],
            row["sos_slot"],
        ): row["id"]
        for row in cursor.fetchall()
    }

    cursor.executemany(
        """
        INSERT INTO luxdex.penumbra_encounter (
            encounter_pool_id,
            source_order,
            source_pokemon_name,
            rate_percent,
            source_line_number
        )
        VALUES (%s, %s, %s, %s, %s)
        """,
        [
            (
                pool_ids[
                    (
                        group.source_sequence,
                        table.source_table_number,
                        pool.time_of_day,
                        pool.pool_type,
                        pool.sos_slot,
                    )
                ],
                encounter.source_order,
                encounter.source_pokemon_name,
                encounter.rate_percent,
                encounter.source_line_number,
            )
            for group in dataset.map_groups
            for table in group.tables
            for pool in table.pools
            for encounter in pool.encounters
        ],
    )


def fetch_persisted_counts(connection: Connection, dataset_id: int) -> RegressionCounts:
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            SELECT byte_count, line_count, nonblank_line_count, sha256
            FROM luxdex.source_dataset
            WHERE id = %s
            """,
            (dataset_id,),
        )
        metadata = cursor.fetchone()
        if metadata is None:
            raise RuntimeError(f"source dataset {dataset_id} does not exist")

        def scalar(query: str) -> int:
            cursor.execute(query, (dataset_id,))
            row = cursor.fetchone()
            if row is None:
                raise RuntimeError("regression-count query returned no row")
            return int(next(iter(row.values())))

        source_datasets = scalar("SELECT count(*) FROM luxdex.source_dataset WHERE id = %s")
        map_groups = scalar("SELECT count(*) FROM luxdex.penumbra_map_group WHERE dataset_id = %s")
        map_locations = scalar(
            """
            SELECT count(*)
            FROM luxdex.penumbra_map_location AS location
            JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = location.map_group_id
            WHERE map_group.dataset_id = %s
            """
        )
        encounter_tables = scalar(
            """
            SELECT count(*)
            FROM luxdex.penumbra_encounter_table AS encounter_table
            JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
            WHERE map_group.dataset_id = %s
            """
        )
        encounter_pools = scalar(
            """
            SELECT count(*)
            FROM luxdex.penumbra_encounter_pool AS pool
            JOIN luxdex.penumbra_encounter_table AS encounter_table ON encounter_table.id = pool.encounter_table_id
            JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
            WHERE map_group.dataset_id = %s
            """
        )

        def encounter_count(pool_type: str | None = None) -> int:
            condition = "" if pool_type is None else "AND pool.pool_type = %s"
            parameters: tuple[Any, ...] = (dataset_id,) if pool_type is None else (dataset_id, pool_type)
            cursor.execute(
                f"""
                SELECT count(*)
                FROM luxdex.penumbra_encounter AS encounter
                JOIN luxdex.penumbra_encounter_pool AS pool ON pool.id = encounter.encounter_pool_id
                JOIN luxdex.penumbra_encounter_table AS encounter_table ON encounter_table.id = pool.encounter_table_id
                JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
                WHERE map_group.dataset_id = %s {condition}
                """,
                parameters,
            )
            row = cursor.fetchone()
            return int(next(iter(row.values()))) if row else 0

        unique_pokemon_names = scalar(
            """
            SELECT count(DISTINCT encounter.source_pokemon_name)
            FROM luxdex.penumbra_encounter AS encounter
            JOIN luxdex.penumbra_encounter_pool AS pool ON pool.id = encounter.encounter_pool_id
            JOIN luxdex.penumbra_encounter_table AS encounter_table ON encounter_table.id = pool.encounter_table_id
            JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
            WHERE map_group.dataset_id = %s
            """
        )
        zero_table_map_groups = scalar(
            """
            SELECT count(*)
            FROM luxdex.penumbra_map_group
            WHERE dataset_id = %s AND declared_table_count = 0
            """
        )
        day_night_different_tables = scalar(
            """
            WITH signatures AS (
                SELECT
                    pool.encounter_table_id,
                    pool.time_of_day,
                    jsonb_agg(
                        jsonb_build_array(
                            pool.source_order,
                            pool.pool_type,
                            pool.sos_slot,
                            pool.min_level,
                            pool.max_level,
                            pool.source_entry_count,
                            pool.empty_entry_count,
                            encounter.source_order,
                            encounter.source_pokemon_name,
                            encounter.rate_percent
                        )
                        ORDER BY pool.source_order, encounter.source_order NULLS FIRST
                    ) AS signature
                FROM luxdex.penumbra_encounter_pool AS pool
                LEFT JOIN luxdex.penumbra_encounter AS encounter ON encounter.encounter_pool_id = pool.id
                JOIN luxdex.penumbra_encounter_table AS encounter_table ON encounter_table.id = pool.encounter_table_id
                JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
                WHERE map_group.dataset_id = %s
                GROUP BY pool.encounter_table_id, pool.time_of_day
            )
            SELECT count(*)
            FROM signatures AS day_signature
            JOIN signatures AS night_signature
              ON night_signature.encounter_table_id = day_signature.encounter_table_id
             AND night_signature.time_of_day = 'night'
            WHERE day_signature.time_of_day = 'day'
              AND day_signature.signature IS DISTINCT FROM night_signature.signature
            """
        )
        normal_encounters = encounter_count("normal")
        sos_encounters = encounter_count("sos")
        additional_sos_encounters = encounter_count("additional_sos")
        total_encounters = encounter_count()

    return RegressionCounts(
        source_datasets=source_datasets,
        map_groups=map_groups,
        map_locations=map_locations,
        encounter_tables=encounter_tables,
        encounter_pools=encounter_pools,
        normal_encounters=normal_encounters,
        sos_encounters=sos_encounters,
        additional_sos_encounters=additional_sos_encounters,
        unique_pokemon_names=unique_pokemon_names,
        zero_table_map_groups=zero_table_map_groups,
        day_night_different_tables=day_night_different_tables,
        total_encounters=total_encounters,
        source_byte_count=int(metadata["byte_count"]),
        source_line_count=int(metadata["line_count"]),
        source_nonblank_line_count=int(metadata["nonblank_line_count"]),
        source_sha256=str(metadata["sha256"]),
    )
