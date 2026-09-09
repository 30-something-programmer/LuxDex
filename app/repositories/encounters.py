"""Read-only PostgreSQL queries for authoritative Penumbra source data."""

from __future__ import annotations

from typing import Any

from psycopg.rows import dict_row

from app.database import connect_database
from app.ingestion.penumbra.parser import SOURCE_NAME


class EncountersRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url

    def get_source(self) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        source_name,
                        source_filename,
                        sha256,
                        byte_count,
                        line_count,
                        nonblank_line_count,
                        parser_version,
                        imported_at
                    FROM luxdex.source_dataset
                    WHERE source_name = %s
                    """,
                    (SOURCE_NAME,),
                )
                return cursor.fetchone()

    def list_map_groups(self, after_id: int, limit: int) -> list[dict[str, Any]]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        map_group.id,
                        map_group.source_sequence,
                        map_group.raw_header,
                        map_group.declared_table_count,
                        map_group.source_line_start,
                        map_group.source_line_end,
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'source_order', location.source_order,
                                        'raw_map_number', location.raw_map_number,
                                        'source_location_name', location.source_location_name,
                                        'raw_reference', location.raw_reference
                                    ) ORDER BY location.source_order
                                )
                                FROM luxdex.penumbra_map_location AS location
                                WHERE location.map_group_id = map_group.id
                            ),
                            '[]'::jsonb
                        ) AS locations
                    FROM luxdex.penumbra_map_group AS map_group
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = map_group.dataset_id
                    WHERE dataset.source_name = %s AND map_group.id > %s
                    ORDER BY map_group.id
                    LIMIT %s
                    """,
                    (SOURCE_NAME, after_id, limit),
                )
                return list(cursor.fetchall())

    def get_map_group(self, map_group_id: int) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        map_group.id,
                        map_group.source_sequence,
                        map_group.raw_header,
                        map_group.declared_table_count,
                        map_group.source_line_start,
                        map_group.source_line_end,
                        COALESCE(
                            jsonb_agg(
                                jsonb_build_object(
                                    'source_order', location.source_order,
                                    'raw_map_number', location.raw_map_number,
                                    'source_location_name', location.source_location_name,
                                    'raw_reference', location.raw_reference
                                ) ORDER BY location.source_order
                            ) FILTER (WHERE location.id IS NOT NULL),
                            '[]'::jsonb
                        ) AS locations
                    FROM luxdex.penumbra_map_group AS map_group
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = map_group.dataset_id
                    LEFT JOIN luxdex.penumbra_map_location AS location ON location.map_group_id = map_group.id
                    WHERE dataset.source_name = %s AND map_group.id = %s
                    GROUP BY map_group.id
                    """,
                    (SOURCE_NAME, map_group_id),
                )
                return cursor.fetchone()

    def list_tables(self, map_group_id: int) -> list[dict[str, Any]]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        encounter_table.source_table_number,
                        encounter_table.source_order,
                        encounter_table.source_line_start,
                        encounter_table.source_line_end
                    FROM luxdex.penumbra_encounter_table AS encounter_table
                    JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = map_group.dataset_id
                    WHERE dataset.source_name = %s AND map_group.id = %s
                    ORDER BY encounter_table.source_order
                    """,
                    (SOURCE_NAME, map_group_id),
                )
                return list(cursor.fetchall())

    def get_table(self, map_group_id: int, table_number: int) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        encounter_table.id,
                        encounter_table.source_table_number,
                        encounter_table.source_order,
                        encounter_table.source_line_start,
                        encounter_table.source_line_end
                    FROM luxdex.penumbra_encounter_table AS encounter_table
                    JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = map_group.dataset_id
                    WHERE dataset.source_name = %s
                      AND map_group.id = %s
                      AND encounter_table.source_table_number = %s
                    """,
                    (SOURCE_NAME, map_group_id, table_number),
                )
                table = cursor.fetchone()
                if table is None:
                    return None

                cursor.execute(
                    """
                    SELECT
                        pool.id AS pool_id,
                        pool.time_of_day,
                        pool.pool_type,
                        pool.sos_slot,
                        pool.source_order AS pool_source_order,
                        pool.min_level,
                        pool.max_level,
                        pool.source_line_number AS pool_source_line_number,
                        pool.source_entry_count,
                        pool.empty_entry_count,
                        pool.rate_total_percent,
                        pool.empty_rate_total_percent,
                        encounter.source_order AS encounter_source_order,
                        encounter.source_pokemon_name,
                        encounter.rate_percent,
                        encounter.source_line_number AS encounter_source_line_number
                    FROM luxdex.penumbra_encounter_pool AS pool
                    LEFT JOIN luxdex.penumbra_encounter AS encounter ON encounter.encounter_pool_id = pool.id
                    WHERE pool.encounter_table_id = %s
                    ORDER BY
                        CASE pool.time_of_day WHEN 'day' THEN 1 ELSE 2 END,
                        pool.source_order,
                        encounter.source_order NULLS FIRST
                    """,
                    (table["id"],),
                )
                pools: list[dict[str, Any]] = []
                pool_by_id: dict[int, dict[str, Any]] = {}
                for row in cursor.fetchall():
                    pool_id = row["pool_id"]
                    pool = pool_by_id.get(pool_id)
                    if pool is None:
                        pool = {
                            "time_of_day": row["time_of_day"],
                            "pool_type": row["pool_type"],
                            "sos_slot": row["sos_slot"],
                            "source_order": row["pool_source_order"],
                            "min_level": row["min_level"],
                            "max_level": row["max_level"],
                            "source_line_number": row["pool_source_line_number"],
                            "source_entry_count": row["source_entry_count"],
                            "empty_entry_count": row["empty_entry_count"],
                            "rate_total_percent": row["rate_total_percent"],
                            "empty_rate_total_percent": row["empty_rate_total_percent"],
                            "encounters": [],
                        }
                        pool_by_id[pool_id] = pool
                        pools.append(pool)
                    if row["encounter_source_order"] is not None:
                        pool["encounters"].append(
                            {
                                "source_order": row["encounter_source_order"],
                                "source_pokemon_name": row["source_pokemon_name"],
                                "rate_percent": row["rate_percent"],
                                "source_line_number": row["encounter_source_line_number"],
                            }
                        )

                return {
                    "source_table_number": table["source_table_number"],
                    "source_order": table["source_order"],
                    "source_line_start": table["source_line_start"],
                    "source_line_end": table["source_line_end"],
                    "pools": pools,
                }

    def search_pokemon(
        self,
        name_prefix: str,
        after_id: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        encounter.id AS occurrence_id,
                        encounter.source_pokemon_name,
                        encounter.rate_percent,
                        encounter.source_order,
                        encounter.source_line_number,
                        pool.time_of_day,
                        pool.pool_type,
                        pool.sos_slot,
                        pool.min_level,
                        pool.max_level,
                        encounter_table.source_table_number,
                        map_group.id AS map_group_id,
                        map_group.source_sequence AS map_group_source_sequence,
                        map_group.raw_header,
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'source_order', location.source_order,
                                        'raw_map_number', location.raw_map_number,
                                        'source_location_name', location.source_location_name,
                                        'raw_reference', location.raw_reference
                                    ) ORDER BY location.source_order
                                )
                                FROM luxdex.penumbra_map_location AS location
                                WHERE location.map_group_id = map_group.id
                            ),
                            '[]'::jsonb
                        ) AS locations
                    FROM luxdex.penumbra_encounter AS encounter
                    JOIN luxdex.penumbra_encounter_pool AS pool ON pool.id = encounter.encounter_pool_id
                    JOIN luxdex.penumbra_encounter_table AS encounter_table ON encounter_table.id = pool.encounter_table_id
                    JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = map_group.dataset_id
                    WHERE dataset.source_name = %s
                      AND lower(encounter.source_pokemon_name) LIKE lower(%s) || '%%'
                      AND encounter.id > %s
                    ORDER BY encounter.id
                    LIMIT %s
                    """,
                    (SOURCE_NAME, name_prefix, after_id, limit),
                )
                return list(cursor.fetchall())
