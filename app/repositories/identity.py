"""Read-only diagnostics for persisted source-to-canonical identity mappings."""

from __future__ import annotations

from typing import Any

from psycopg.rows import dict_row

from app.database import connect_database


class IdentityRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url

    def get_penumbra_summary(self) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        build.id AS build_id,
                        build.resolver_version,
                        build.alias_filename,
                        build.alias_sha256,
                        build.total_identity_count AS total_raw_identities,
                        build.total_identity_count - build.unresolved_count AS resolved,
                        build.exact_count AS exact,
                        build.normalised_exact_count AS normalised_exact,
                        build.explicit_alias_count AS explicit_alias,
                        build.explicit_form_alias_count AS explicit_form_alias,
                        build.unresolved_count AS unresolved,
                        build.built_at,
                        penumbra.sha256 AS penumbra_sha256,
                        pokemon.sha256 AS pokemon_master_sha256,
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    identity.source_pokemon_name
                                    ORDER BY identity.source_pokemon_name
                                )
                                FROM luxdex.penumbra_pokemon_source_identity AS identity
                                LEFT JOIN luxdex.penumbra_pokemon_identity_map AS identity_map
                                  ON identity_map.source_identity_id = identity.id
                                WHERE identity.build_id = build.id
                                  AND identity_map.id IS NULL
                            ),
                            '[]'::jsonb
                        ) AS unresolved_names,
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'source_pokemon_name', identity.source_pokemon_name,
                                        'canonical_key', form.form_key
                                    ) ORDER BY identity.source_pokemon_name
                                )
                                FROM luxdex.penumbra_pokemon_source_identity AS identity
                                JOIN luxdex.penumbra_pokemon_identity_map AS identity_map
                                  ON identity_map.source_identity_id = identity.id
                                JOIN luxdex.pokemon_form AS form
                                  ON form.id = identity_map.pokemon_form_id
                                LEFT JOIN luxdex.pokemon_sprite_asset AS sprite
                                  ON sprite.form_id = form.id
                                WHERE identity.build_id = build.id
                                  AND sprite.id IS NULL
                            ),
                            '[]'::jsonb
                        ) AS mapped_targets_without_local_sprite
                    FROM luxdex.penumbra_pokemon_identity_build AS build
                    JOIN luxdex.source_dataset AS penumbra
                      ON penumbra.id = build.penumbra_dataset_id
                    JOIN luxdex.source_dataset AS pokemon
                      ON pokemon.id = build.pokemon_dataset_id
                    ORDER BY build.id DESC
                    LIMIT 1
                    """
                )
                return cursor.fetchone()
