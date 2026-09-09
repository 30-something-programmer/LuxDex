"""Read-only PostgreSQL queries for canonical geography and full encounter joins."""

from __future__ import annotations

from typing import Any

from psycopg.rows import dict_row

from app.database import connect_database


class GeographyRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url

    def list_groups(self) -> list[dict[str, Any]]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        area_group.group_key,
                        area_group.display_name,
                        area_group.display_order,
                        area_group.group_type,
                        count(DISTINCT location.id)::integer AS location_count,
                        count(DISTINCT place.id)::integer AS encounter_place_count
                    FROM luxdex.geography_area_group AS area_group
                    LEFT JOIN luxdex.geography_location AS location
                      ON location.area_group_id = area_group.id
                    LEFT JOIN luxdex.geography_encounter_place AS place
                      ON place.location_id = location.id
                    GROUP BY area_group.id
                    ORDER BY area_group.display_order, area_group.id
                    """
                )
                return list(cursor.fetchall())

    def list_locations(self, group_key: str) -> list[dict[str, Any]] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    "SELECT id FROM luxdex.geography_area_group WHERE group_key = %s",
                    (group_key,),
                )
                if cursor.fetchone() is None:
                    return None
                cursor.execute(
                    """
                    SELECT
                        location.location_key,
                        location.display_name,
                        location.location_type,
                        location.display_order,
                        location.description,
                        area_group.group_key AS area_group_key,
                        area_group.display_name AS area_group_name,
                        count(place.id)::integer AS encounter_place_count
                    FROM luxdex.geography_location AS location
                    JOIN luxdex.geography_area_group AS area_group
                      ON area_group.id = location.area_group_id
                    LEFT JOIN luxdex.geography_encounter_place AS place
                      ON place.location_id = location.id
                    WHERE area_group.group_key = %s
                    GROUP BY location.id, area_group.id
                    ORDER BY location.display_order, location.id
                    """,
                    (group_key,),
                )
                return list(cursor.fetchall())

    def get_location(self, location_key: str) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        location.location_key,
                        location.display_name,
                        location.location_type,
                        location.display_order,
                        location.description,
                        area_group.group_key AS area_group_key,
                        area_group.display_name AS area_group_name,
                        count(place.id)::integer AS encounter_place_count
                    FROM luxdex.geography_location AS location
                    JOIN luxdex.geography_area_group AS area_group
                      ON area_group.id = location.area_group_id
                    LEFT JOIN luxdex.geography_encounter_place AS place
                      ON place.location_id = location.id
                    WHERE location.location_key = %s
                    GROUP BY location.id, area_group.id
                    """,
                    (location_key,),
                )
                return cursor.fetchone()

    def list_places(self, location_key: str) -> list[dict[str, Any]] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    "SELECT id FROM luxdex.geography_location WHERE location_key = %s",
                    (location_key,),
                )
                if cursor.fetchone() is None:
                    return None
                cursor.execute(
                    """
                    SELECT
                        place.place_key,
                        place.display_name,
                        place.subtitle,
                        place.encounter_method,
                        place.requirement,
                        place.display_order,
                        place.mapping_status,
                        count(DISTINCT table_map.penumbra_encounter_table_id)::integer AS raw_table_count,
                        count(encounter.id)::integer AS encounter_count
                    FROM luxdex.geography_encounter_place AS place
                    JOIN luxdex.geography_location AS location ON location.id = place.location_id
                    LEFT JOIN luxdex.geography_encounter_place_table_map AS table_map
                      ON table_map.encounter_place_id = place.id
                    LEFT JOIN luxdex.penumbra_encounter_pool AS pool
                      ON pool.encounter_table_id = table_map.penumbra_encounter_table_id
                    LEFT JOIN luxdex.penumbra_encounter AS encounter
                      ON encounter.encounter_pool_id = pool.id
                    WHERE location.location_key = %s
                    GROUP BY place.id
                    ORDER BY place.display_order, place.id
                    """,
                    (location_key,),
                )
                return list(cursor.fetchall())

    def get_place(self, place_key: str) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        place.id,
                        place.place_key,
                        place.display_name,
                        place.subtitle,
                        place.encounter_method,
                        place.requirement,
                        place.display_order,
                        place.mapping_status,
                        location.location_key,
                        location.display_name AS location_name,
                        area_group.group_key AS area_group_key,
                        area_group.display_name AS area_group_name,
                        count(DISTINCT table_map.penumbra_encounter_table_id)::integer AS raw_table_count,
                        count(encounter.id)::integer AS encounter_count
                    FROM luxdex.geography_encounter_place AS place
                    JOIN luxdex.geography_location AS location ON location.id = place.location_id
                    JOIN luxdex.geography_area_group AS area_group
                      ON area_group.id = location.area_group_id
                    LEFT JOIN luxdex.geography_encounter_place_table_map AS table_map
                      ON table_map.encounter_place_id = place.id
                    LEFT JOIN luxdex.penumbra_encounter_pool AS pool
                      ON pool.encounter_table_id = table_map.penumbra_encounter_table_id
                    LEFT JOIN luxdex.penumbra_encounter AS encounter
                      ON encounter.encounter_pool_id = pool.id
                    WHERE place.place_key = %s
                    GROUP BY place.id, location.id, area_group.id
                    """,
                    (place_key,),
                )
                place = cursor.fetchone()
                if place is None:
                    return None

                cursor.execute(
                    """
                    SELECT
                        table_map.id,
                        map_group.source_sequence AS raw_map_group_sequence,
                        map_group.raw_header AS raw_map_header,
                        encounter_table.source_table_number,
                        table_map.mapping_method,
                        table_map.mapping_status,
                        table_map.mapping_note,
                        count(encounter.id)::integer AS encounter_count,
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'source_key', source.source_key,
                                        'source_title', source.source_title,
                                        'source_url', source.source_url,
                                        'source_type', source.source_type,
                                        'accessed_on', source.accessed_on::text,
                                        'evidence_order', evidence.evidence_order,
                                        'source_locator', evidence.source_locator,
                                        'evidence_note', evidence.evidence_note
                                    ) ORDER BY evidence.evidence_order, evidence.id
                                )
                                FROM luxdex.geography_mapping_evidence AS evidence
                                JOIN luxdex.geography_source_reference AS source
                                  ON source.id = evidence.source_reference_id
                                WHERE evidence.table_mapping_id = table_map.id
                            ),
                            '[]'::jsonb
                        ) AS evidence
                    FROM luxdex.geography_encounter_place_table_map AS table_map
                    JOIN luxdex.penumbra_encounter_table AS encounter_table
                      ON encounter_table.id = table_map.penumbra_encounter_table_id
                    JOIN luxdex.penumbra_map_group AS map_group
                      ON map_group.id = encounter_table.map_group_id
                    LEFT JOIN luxdex.penumbra_encounter_pool AS pool
                      ON pool.encounter_table_id = encounter_table.id
                    LEFT JOIN luxdex.penumbra_encounter AS encounter
                      ON encounter.encounter_pool_id = pool.id
                    WHERE table_map.encounter_place_id = %s
                    GROUP BY table_map.id, map_group.id, encounter_table.id
                    ORDER BY map_group.source_sequence, encounter_table.source_order
                    """,
                    (place["id"],),
                )
                mappings = list(cursor.fetchall())

                cursor.execute(
                    """
                    SELECT
                        raw_map_group_sequence,
                        source_table_number,
                        time_of_day,
                        pool_type,
                        sos_slot,
                        min_level,
                        max_level,
                        encounter_order,
                        source_pokemon_name,
                        rate_percent,
                        CASE WHEN canonical_key IS NULL THEN NULL ELSE
                            jsonb_build_object(
                                'canonical_key', canonical_key,
                                'display_name', canonical_display_name,
                                'species_key', species_key,
                                'species_name', species_display_name,
                                'national_dex_number', national_dex_number,
                                'alola_dex_number', alola_dex_number,
                                'local_sprite_path', local_sprite_path
                            )
                        END AS canonical_pokemon
                    FROM luxdex.geography_encounter_full
                    WHERE place_key = %s
                    ORDER BY
                        raw_map_group_sequence,
                        source_table_number,
                        CASE time_of_day WHEN 'day' THEN 1 ELSE 2 END,
                        CASE pool_type WHEN 'normal' THEN 1 WHEN 'sos' THEN 2 ELSE 3 END,
                        sos_slot NULLS FIRST,
                        encounter_order
                    """,
                    (place_key,),
                )
                encounters = list(cursor.fetchall())

        result = dict(place)
        result.pop("id")
        result["raw_table_mappings"] = mappings
        result["encounters"] = encounters
        return result
