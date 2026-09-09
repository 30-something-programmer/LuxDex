"""Read-only PostgreSQL queries for canonical Pokémon species and forms."""

from __future__ import annotations

from typing import Any, Literal

from psycopg.rows import dict_row

from app.database import connect_database
from app.ingestion.pokemon.parser import SOURCE_NAME

PokemonOrder = Literal["national", "alola", "name"]


class PokemonRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url

    def get_source(self) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        dataset.source_name,
                        dataset.source_filename,
                        dataset.sha256,
                        dataset.byte_count,
                        dataset.line_count,
                        dataset.nonblank_line_count,
                        dataset.parser_version,
                        dataset.imported_at,
                        pokemon_source.data_repository,
                        pokemon_source.data_commit_sha,
                        pokemon_source.sprite_repository,
                        pokemon_source.sprite_commit_sha,
                        pokemon_source.acquisition_date,
                        pokemon_source.data_license_path,
                        pokemon_source.sprite_license_path,
                        (
                            SELECT count(*)
                            FROM luxdex.pokemon_source_file AS source_file
                            WHERE source_file.dataset_id = dataset.id
                        ) AS source_file_count
                    FROM luxdex.source_dataset AS dataset
                    JOIN luxdex.pokemon_source_dataset AS pokemon_source
                      ON pokemon_source.dataset_id = dataset.id
                    WHERE dataset.source_name = %s
                    """,
                    (SOURCE_NAME,),
                )
                return cursor.fetchone()

    def list_species(
        self,
        order: PokemonOrder,
        generation: int | None,
        in_alola_dex: bool | None,
        search: str | None,
        offset: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        order_clause = {
            "national": "species.national_dex_number, species.id",
            "alola": "alola_number.dex_number, species.national_dex_number",
            "name": "lower(species.display_name), species.national_dex_number",
        }[order]
        conditions = ["dataset.source_name = %s", "species.is_active"]
        parameters: list[Any] = [SOURCE_NAME]
        if generation is not None:
            conditions.append("species.generation = %s")
            parameters.append(generation)
        if order == "alola" or in_alola_dex is True:
            conditions.append("alola_number.dex_number IS NOT NULL")
        elif in_alola_dex is False:
            conditions.append("alola_number.dex_number IS NULL")
        if search:
            escaped_search = (
                search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            conditions.append("lower(species.display_name) LIKE lower(%s) ESCAPE '\\'")
            parameters.append(f"%{escaped_search}%")
        parameters.extend((limit, offset))

        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    f"""
                    SELECT
                        species.identifier AS species_key,
                        species.national_dex_number,
                        alola_number.dex_number AS alola_usum_dex_number,
                        species.display_name,
                        species.generation,
                        default_form.form_key AS default_form_key,
                        default_form.sprite_key AS default_sprite_key,
                        sprite.local_path AS default_sprite_path
                    FROM luxdex.pokemon_species AS species
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = species.dataset_id
                    JOIN luxdex.pokemon_form AS default_form
                      ON default_form.species_id = species.id
                     AND default_form.is_default
                    LEFT JOIN luxdex.pokemon_sprite_asset AS sprite
                      ON sprite.form_id = default_form.id
                    LEFT JOIN luxdex.pokemon_pokedex_number AS alola_number
                      ON alola_number.species_id = species.id
                     AND alola_number.pokedex_id = (
                         SELECT pokedex.id
                         FROM luxdex.pokemon_pokedex AS pokedex
                         WHERE pokedex.dataset_id = species.dataset_id
                           AND pokedex.dex_key = 'alola-usum'
                     )
                    WHERE {" AND ".join(conditions)}
                    ORDER BY {order_clause}
                    LIMIT %s OFFSET %s
                    """,
                    parameters,
                )
                return list(cursor.fetchall())

    def search_forms(self, query: str, limit: int) -> list[dict[str, Any]]:
        escaped_query = (
            query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        )
        pattern = f"%{escaped_query}%"
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        species.identifier AS species_key,
                        species.national_dex_number,
                        alola_number.dex_number AS alola_usum_dex_number,
                        species.display_name,
                        species.generation,
                        form.form_key,
                        form.identifier,
                        form.display_name AS form_display_name,
                        form.display_name_source,
                        form.is_default,
                        form.form_order,
                        form.is_battle_only,
                        form.is_mega,
                        form.is_regional,
                        form.regional_name,
                        form.sprite_key,
                        sprite.local_path AS sprite_path
                    FROM luxdex.pokemon_form AS form
                    JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = species.dataset_id
                    LEFT JOIN luxdex.pokemon_sprite_asset AS sprite ON sprite.form_id = form.id
                    LEFT JOIN luxdex.pokemon_pokedex_number AS alola_number
                      ON alola_number.species_id = species.id
                     AND alola_number.pokedex_id = (
                         SELECT pokedex.id
                         FROM luxdex.pokemon_pokedex AS pokedex
                         WHERE pokedex.dataset_id = species.dataset_id
                           AND pokedex.dex_key = 'alola-usum'
                     )
                    WHERE dataset.source_name = %s
                      AND (
                          lower(form.display_name) LIKE lower(%s) ESCAPE '\\'
                          OR lower(species.display_name) LIKE lower(%s) ESCAPE '\\'
                      )
                    ORDER BY
                        CASE
                            WHEN lower(form.display_name) = lower(%s) THEN 0
                            WHEN lower(species.display_name) = lower(%s) THEN 1
                            ELSE 2
                        END,
                        lower(form.display_name),
                        species.national_dex_number,
                        form.form_order
                    LIMIT %s
                    """,
                    (SOURCE_NAME, pattern, pattern, query, query, limit),
                )
                return list(cursor.fetchall())

    def get_species_for_key(self, key: str) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        species.id AS species_id,
                        species.identifier AS species_key,
                        species.national_dex_number,
                        species.display_name,
                        species.generation,
                        selected_form.form_key AS selected_form_key,
                        selected_form.identifier AS selected_form_identifier,
                        selected_form.display_name AS selected_form_display_name,
                        selected_form.display_name_source AS selected_form_display_name_source,
                        selected_form.is_default AS selected_form_is_default,
                        selected_form.form_order AS selected_form_order,
                        selected_form.is_battle_only AS selected_form_is_battle_only,
                        selected_form.is_mega AS selected_form_is_mega,
                        selected_form.is_regional AS selected_form_is_regional,
                        selected_form.regional_name AS selected_form_regional_name,
                        selected_form.sprite_key AS selected_form_sprite_key,
                        sprite.local_path AS selected_form_sprite_path,
                        COALESCE(
                            jsonb_object_agg(pokedex.dex_key, number.dex_number)
                                FILTER (WHERE pokedex.id IS NOT NULL),
                            '{}'::jsonb
                        ) AS dex_numbers
                    FROM luxdex.pokemon_form AS selected_form
                    JOIN luxdex.pokemon_species AS species ON species.id = selected_form.species_id
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = species.dataset_id
                    LEFT JOIN luxdex.pokemon_sprite_asset AS sprite
                      ON sprite.form_id = selected_form.id
                    LEFT JOIN luxdex.pokemon_pokedex_number AS number
                      ON number.species_id = species.id
                    LEFT JOIN luxdex.pokemon_pokedex AS pokedex
                      ON pokedex.id = number.pokedex_id
                    WHERE dataset.source_name = %s AND selected_form.form_key = %s
                    GROUP BY species.id, selected_form.id, sprite.local_path
                    """,
                    (SOURCE_NAME, key),
                )
                return cursor.fetchone()

    def list_forms_for_key(self, key: str) -> list[dict[str, Any]] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT species.id
                    FROM luxdex.pokemon_species AS species
                    JOIN luxdex.pokemon_form AS selected_form ON selected_form.species_id = species.id
                    JOIN luxdex.source_dataset AS dataset ON dataset.id = species.dataset_id
                    WHERE dataset.source_name = %s AND selected_form.form_key = %s
                    """,
                    (SOURCE_NAME, key),
                )
                species_row = cursor.fetchone()
                if species_row is None:
                    return None
                cursor.execute(
                    """
                    SELECT
                        form.form_key,
                        form.identifier,
                        form.display_name,
                        form.display_name_source,
                        form.is_default,
                        form.form_order,
                        form.is_battle_only,
                        form.is_mega,
                        form.is_regional,
                        form.regional_name,
                        form.sprite_key,
                        sprite.local_path AS sprite_path
                    FROM luxdex.pokemon_form AS form
                    LEFT JOIN luxdex.pokemon_sprite_asset AS sprite ON sprite.form_id = form.id
                    WHERE form.species_id = %s
                    ORDER BY NOT form.is_default, form.form_order, form.id
                    """,
                    (species_row["id"],),
                )
                return list(cursor.fetchall())
