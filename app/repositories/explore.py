"""Queries supporting frontend-oriented geography and Pokémon read models."""

from __future__ import annotations

from typing import Any

from psycopg.rows import dict_row

from app.database import connect_database


class ExploreRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url

    def get_location_bundle(
        self, group_key: str, location_key: str
    ) -> tuple[dict[str, Any] | None, list[dict[str, Any]], list[dict[str, Any]]]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        area_group.group_key,
                        area_group.display_name AS group_display_name,
                        area_group.group_type,
                        location.location_key,
                        location.display_name AS location_display_name,
                        location.location_type,
                        location.description
                    FROM luxdex.geography_location AS location
                    JOIN luxdex.geography_area_group AS area_group
                      ON area_group.id = location.area_group_id
                    WHERE area_group.group_key = %s AND location.location_key = %s
                    """,
                    (group_key, location_key),
                )
                location = cursor.fetchone()
                if location is None:
                    return None, [], []

                cursor.execute(
                    """
                    SELECT
                        place.place_key,
                        place.display_name,
                        place.subtitle,
                        place.encounter_method,
                        place.requirement,
                        place.display_order,
                        place.mapping_status
                    FROM luxdex.geography_encounter_place AS place
                    JOIN luxdex.geography_location AS location
                      ON location.id = place.location_id
                    WHERE location.location_key = %s
                    ORDER BY place.display_order, place.id
                    """,
                    (location_key,),
                )
                places = list(cursor.fetchall())

                cursor.execute(
                    """
                    SELECT
                        encounter.place_key,
                        encounter.time_of_day,
                        encounter.pool_type,
                        encounter.sos_slot,
                        encounter.min_level,
                        encounter.max_level,
                        encounter.rate_percent,
                        encounter.canonical_key,
                        encounter.canonical_display_name AS display_name,
                        encounter.species_key,
                        encounter.species_display_name AS species_name,
                        encounter.national_dex_number,
                        encounter.alola_dex_number AS alola_usum_dex_number,
                        encounter.local_sprite_path AS sprite_path,
                        form.is_regional,
                        form.regional_name,
                        species.generation,
                        encounter.raw_map_group_sequence,
                        encounter.source_table_number
                        , COALESCE(collection.state, 'unseen') AS collection_state
                    FROM luxdex.geography_encounter_full AS encounter
                    JOIN luxdex.pokemon_form AS form
                      ON form.form_key = encounter.canonical_key
                    JOIN luxdex.pokemon_species AS species
                      ON species.id = form.species_id
                    LEFT JOIN luxdex.pokemon_collection_state AS collection
                      ON collection.pokemon_form_id = form.id
                     AND collection.profile_id = (
                         SELECT id FROM luxdex.profile WHERE profile_key = 'local'
                     )
                    WHERE encounter.location_key = %s
                      AND encounter.canonical_key IS NOT NULL
                    ORDER BY
                        encounter.place_key,
                        CASE encounter.time_of_day WHEN 'day' THEN 1 ELSE 2 END,
                        CASE encounter.pool_type
                            WHEN 'normal' THEN 1 WHEN 'sos' THEN 2 ELSE 3
                        END,
                        encounter.canonical_display_name,
                        encounter.rate_percent DESC NULLS LAST,
                        encounter.sos_slot NULLS FIRST,
                        encounter.encounter_order
                    """,
                    (location_key,),
                )
                encounters = list(cursor.fetchall())

        return location, places, encounters

    def list_form_occurrences(self, canonical_key: str) -> list[dict[str, Any]]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        encounter.group_key AS area_group_key,
                        encounter.group_display_name AS area_group_name,
                        area_group.display_order AS area_group_order,
                        encounter.location_key,
                        encounter.location_display_name AS location_name,
                        location.display_order AS location_order,
                        encounter.place_key,
                        encounter.place_display_name AS place_name,
                        place.display_order AS place_order,
                        encounter.encounter_method,
                        encounter.time_of_day,
                        encounter.pool_type,
                        encounter.sos_slot,
                        encounter.rate_percent,
                        encounter.min_level,
                        encounter.max_level,
                        encounter.raw_map_group_sequence,
                        encounter.source_table_number
                    FROM luxdex.geography_encounter_full AS encounter
                    JOIN luxdex.geography_area_group AS area_group
                      ON area_group.group_key = encounter.group_key
                    JOIN luxdex.geography_location AS location
                      ON location.location_key = encounter.location_key
                    JOIN luxdex.geography_encounter_place AS place
                      ON place.place_key = encounter.place_key
                    WHERE encounter.canonical_key = %s
                    ORDER BY
                        area_group.display_order,
                        location.display_order,
                        place.display_order,
                        CASE encounter.time_of_day WHEN 'day' THEN 1 ELSE 2 END,
                        CASE encounter.pool_type
                            WHEN 'normal' THEN 1 WHEN 'sos' THEN 2 ELSE 3
                        END,
                        encounter.rate_percent DESC NULLS LAST,
                        encounter.sos_slot NULLS FIRST
                    """,
                    (canonical_key,),
                )
                return list(cursor.fetchall())
