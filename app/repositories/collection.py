"""Transactional PostgreSQL persistence for the active collection profile."""

from __future__ import annotations

from typing import Any, Literal

from psycopg import Connection
from psycopg.rows import dict_row

from app.database import connect_database

CollectionState = Literal["unseen", "seen", "owned"]
LOCAL_PROFILE_KEY = "local"


class CollectionRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url

    def list_states(self) -> list[dict[str, Any]]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT
                        form.form_key AS canonical_key,
                        form.display_name,
                        COALESCE(collection.state, 'unseen') AS state,
                        collection.first_seen_at,
                        collection.first_owned_at,
                        collection.updated_at
                    FROM luxdex.pokemon_form AS form
                    CROSS JOIN luxdex.profile AS profile
                    LEFT JOIN luxdex.pokemon_collection_state AS collection
                      ON collection.profile_id = profile.id
                     AND collection.pokemon_form_id = form.id
                    WHERE profile.profile_key = %s
                    ORDER BY form.form_key
                    """,
                    (LOCAL_PROFILE_KEY,),
                )
                return list(cursor.fetchall())

    def get_state(self, canonical_key: str) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                return self._select_state(cursor, canonical_key)

    def summary(self) -> dict[str, Any]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    WITH active_profile AS (
                        SELECT id FROM luxdex.profile WHERE profile_key = %s
                    ),
                    forms AS (
                        SELECT
                            form.id,
                            form.species_id,
                            form.is_default,
                            COALESCE(collection.state, 'unseen') AS state
                        FROM luxdex.pokemon_form AS form
                        CROSS JOIN active_profile
                        LEFT JOIN luxdex.pokemon_collection_state AS collection
                          ON collection.profile_id = active_profile.id
                         AND collection.pokemon_form_id = form.id
                    ),
                    alola_species AS (
                        SELECT DISTINCT number.species_id
                        FROM luxdex.pokemon_pokedex_number AS number
                        JOIN luxdex.pokemon_pokedex AS pokedex ON pokedex.id = number.pokedex_id
                        WHERE pokedex.dex_key = 'alola-usum'
                    ),
                    species_states AS (
                        SELECT
                            species_id,
                            CASE
                                WHEN bool_or(state = 'owned') THEN 'owned'
                                WHEN bool_or(state = 'seen') THEN 'seen'
                                ELSE 'unseen'
                            END AS state
                        FROM forms
                        GROUP BY species_id
                    )
                    SELECT
                        (SELECT count(*) FROM forms) AS form_total,
                        (SELECT count(*) FROM forms WHERE state = 'unseen') AS form_unseen,
                        (SELECT count(*) FROM forms WHERE state = 'seen') AS form_seen,
                        (SELECT count(*) FROM forms WHERE state = 'owned') AS form_owned,
                        (SELECT count(*) FROM luxdex.pokemon_species WHERE is_active) AS national_total,
                        (SELECT count(*) FROM species_states WHERE state = 'seen') AS national_seen,
                        (SELECT count(*) FROM species_states WHERE state = 'owned') AS national_owned,
                        (SELECT count(*) FROM alola_species) AS alola_total,
                        (SELECT count(*) FROM species_states JOIN alola_species USING (species_id) WHERE state = 'seen') AS alola_seen,
                        (SELECT count(*) FROM species_states JOIN alola_species USING (species_id) WHERE state = 'owned') AS alola_owned
                    """,
                    (LOCAL_PROFILE_KEY,),
                )
                return cursor.fetchone()

    def advance(self, canonical_key: str) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            return self._mutate(connection, canonical_key, None)

    def set_state(
        self, canonical_key: str, target_state: CollectionState
    ) -> dict[str, Any] | None:
        with connect_database(self.database_url) as connection:
            return self._mutate(connection, canonical_key, target_state)

    @staticmethod
    def _select_state(cursor: Any, canonical_key: str) -> dict[str, Any] | None:
        cursor.execute(
            """
            SELECT
                form.id AS pokemon_form_id,
                form.form_key AS canonical_key,
                form.display_name,
                profile.id AS profile_id,
                COALESCE(collection.state, 'unseen') AS state,
                collection.first_seen_at,
                collection.first_owned_at,
                collection.updated_at
            FROM luxdex.pokemon_form AS form
            CROSS JOIN luxdex.profile AS profile
            LEFT JOIN luxdex.pokemon_collection_state AS collection
              ON collection.profile_id = profile.id
             AND collection.pokemon_form_id = form.id
            WHERE profile.profile_key = %s AND form.form_key = %s
            """,
            (LOCAL_PROFILE_KEY, canonical_key),
        )
        return cursor.fetchone()

    def _mutate(
        self,
        connection: Connection[Any],
        canonical_key: str,
        explicit_state: CollectionState | None,
    ) -> dict[str, Any] | None:
        with connection.cursor(row_factory=dict_row) as cursor:
            current = self._select_state(cursor, canonical_key)
            if current is None:
                return None

            cursor.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                (f"collection:{current['profile_id']}:{current['pokemon_form_id']}",),
            )
            current = self._select_state(cursor, canonical_key)
            if current is None:
                return None

            previous: CollectionState = current["state"]
            target: CollectionState = explicit_state or {
                "unseen": "seen",
                "seen": "owned",
                "owned": "owned",
            }[previous]
            if target == previous:
                return current

            cursor.execute(
                """
                INSERT INTO luxdex.pokemon_collection_state (
                    profile_id,
                    pokemon_form_id,
                    state,
                    first_seen_at,
                    first_owned_at,
                    updated_at
                )
                VALUES (
                    %(profile_id)s,
                    %(pokemon_form_id)s,
                    %(state)s,
                    CASE WHEN %(state)s IN ('seen', 'owned') THEN now() END,
                    CASE WHEN %(state)s = 'owned' THEN now() END,
                    now()
                )
                ON CONFLICT (profile_id, pokemon_form_id) DO UPDATE
                SET state = EXCLUDED.state,
                    first_seen_at = CASE
                        WHEN EXCLUDED.state IN ('seen', 'owned')
                            THEN COALESCE(luxdex.pokemon_collection_state.first_seen_at, now())
                        ELSE luxdex.pokemon_collection_state.first_seen_at
                    END,
                    first_owned_at = CASE
                        WHEN EXCLUDED.state = 'owned'
                            THEN COALESCE(luxdex.pokemon_collection_state.first_owned_at, now())
                        ELSE luxdex.pokemon_collection_state.first_owned_at
                    END,
                    updated_at = now()
                """,
                {
                    "profile_id": current["profile_id"],
                    "pokemon_form_id": current["pokemon_form_id"],
                    "state": target,
                },
            )
            cursor.execute(
                """
                INSERT INTO luxdex.pokemon_collection_state_event (
                    profile_id, pokemon_form_id, previous_state, new_state, source
                ) VALUES (%s, %s, %s, %s, 'manual')
                """,
                (
                    current["profile_id"],
                    current["pokemon_form_id"],
                    previous,
                    target,
                ),
            )
            return self._select_state(cursor, canonical_key)
