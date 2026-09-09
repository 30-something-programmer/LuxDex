from __future__ import annotations

import os
import unittest
from pathlib import Path
from uuid import uuid4

import psycopg
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.api.collection import get_collection_service
from app.ingestion.pokemon.loader import ensure_pokemon_dataset
from app.main import app
from app.repositories.collection import CollectionRepository
from app.services.collection import CollectionService

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(os.getenv("TEST_DATABASE_URL"), "TEST_DATABASE_URL is not configured")
class CollectionDatabaseTests(unittest.TestCase):
    admin_database_url: str
    test_database_name: str
    test_database_url: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.admin_database_url = os.environ["TEST_DATABASE_URL"]
        cls.test_database_name = f"luxdex_test_{uuid4().hex[:12]}"
        connection_info = conninfo_to_dict(cls.admin_database_url)
        connection_info["dbname"] = cls.test_database_name
        cls.test_database_url = make_conninfo(**connection_info)

        with psycopg.connect(cls.admin_database_url, autocommit=True) as connection:
            connection.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(cls.test_database_name))
            )
        with psycopg.connect(cls.test_database_url) as connection:
            for schema_file in sorted((REPOSITORY_ROOT / "db/schema").glob("*.sql")):
                connection.execute(schema_file.read_text(encoding="utf-8"))
        ensure_pokemon_dataset(cls.test_database_url)

    @classmethod
    def tearDownClass(cls) -> None:
        app.dependency_overrides.clear()
        with psycopg.connect(cls.admin_database_url, autocommit=True) as connection:
            connection.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(
                    sql.Identifier(cls.test_database_name)
                )
            )

    def setUp(self) -> None:
        with psycopg.connect(self.test_database_url) as connection:
            connection.execute(
                "TRUNCATE luxdex.pokemon_collection_state_event, luxdex.pokemon_collection_state RESTART IDENTITY"
            )
        self.service = CollectionService(CollectionRepository(self.test_database_url))
        app.dependency_overrides[get_collection_service] = lambda: self.service
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()

    def test_local_profile_and_initial_summary(self) -> None:
        with psycopg.connect(self.test_database_url) as connection:
            profile = connection.execute(
                "SELECT profile_key, display_name FROM luxdex.profile"
            ).fetchall()
        self.assertEqual(profile, [("local", "Local Player")])

        summary = self.client.get("/api/collection/summary").json()
        self.assertEqual(summary["form_counts"], {
            "total": 1127, "unseen": 1127, "seen": 0, "owned": 0
        })
        self.assertEqual(summary["national_species_counts"]["total"], 807)
        self.assertEqual(summary["alola_species_counts"]["total"], 403)

    def test_advance_is_forward_only_and_timestamps_are_stable(self) -> None:
        first = self.client.post("/api/collection/pichu/advance")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["state"], "seen")
        first_seen = first.json()["first_seen_at"]

        second = self.client.post("/api/collection/pichu/advance")
        self.assertEqual(second.json()["state"], "owned")
        self.assertEqual(second.json()["first_seen_at"], first_seen)
        first_owned = second.json()["first_owned_at"]

        third = self.client.post("/api/collection/pichu/advance")
        self.assertEqual(third.json()["state"], "owned")
        self.assertEqual(third.json()["first_seen_at"], first_seen)
        self.assertEqual(third.json()["first_owned_at"], first_owned)

        with psycopg.connect(self.test_database_url) as connection:
            state_count = connection.execute(
                "SELECT count(*) FROM luxdex.pokemon_collection_state"
            ).fetchone()[0]
            events = connection.execute(
                "SELECT previous_state, new_state FROM luxdex.pokemon_collection_state_event ORDER BY id"
            ).fetchall()
        self.assertEqual(state_count, 1)
        self.assertEqual(events, [("unseen", "seen"), ("seen", "owned")])

    def test_explicit_downgrade_reset_and_direct_owned_preserve_history(self) -> None:
        owned = self.client.put("/api/collection/pichu", json={"state": "owned"}).json()
        self.assertIsNotNone(owned["first_seen_at"])
        self.assertIsNotNone(owned["first_owned_at"])

        seen = self.client.put("/api/collection/pichu", json={"state": "seen"}).json()
        unseen = self.client.put("/api/collection/pichu", json={"state": "unseen"}).json()
        self.assertEqual(seen["state"], "seen")
        self.assertEqual(unseen["state"], "unseen")
        self.assertEqual(unseen["first_seen_at"], owned["first_seen_at"])
        self.assertEqual(unseen["first_owned_at"], owned["first_owned_at"])

    def test_state_and_history_are_atomic_and_events_are_immutable(self) -> None:
        with psycopg.connect(self.test_database_url) as connection:
            connection.execute(
                """
                CREATE OR REPLACE FUNCTION luxdex.reject_test_collection_event()
                RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'test event rejection';
                END;
                $$
                """
            )
            connection.execute(
                """
                CREATE TRIGGER reject_test_collection_event
                BEFORE INSERT ON luxdex.pokemon_collection_state_event
                FOR EACH ROW EXECUTE FUNCTION luxdex.reject_test_collection_event()
                """
            )
        try:
            with self.assertRaises(psycopg.errors.RaiseException):
                self.service.advance("pichu")
            self.assertEqual(self.service.get_state("pichu").state, "unseen")
        finally:
            with psycopg.connect(self.test_database_url) as connection:
                connection.execute(
                    "DROP TRIGGER reject_test_collection_event ON luxdex.pokemon_collection_state_event"
                )
                connection.execute("DROP FUNCTION luxdex.reject_test_collection_event()")

        self.service.advance("pichu")
        with self.assertRaises(psycopg.errors.RaiseException):
            with psycopg.connect(self.test_database_url) as connection:
                connection.execute(
                    "UPDATE luxdex.pokemon_collection_state_event SET source = 'correction'"
                )

    def test_form_states_are_independent_and_invalid_key_is_rejected(self) -> None:
        self.client.put("/api/collection/rattata", json={"state": "seen"})
        self.client.put("/api/collection/rattata%3Aalola", json={"state": "owned"})
        self.assertEqual(self.client.get("/api/collection/rattata").json()["state"], "seen")
        self.assertEqual(
            self.client.get("/api/collection/rattata%3Aalola").json()["state"],
            "owned",
        )
        self.assertEqual(self.client.post("/api/collection/not-a-pokemon/advance").status_code, 404)

    def test_database_constraints_enforce_identity_profile_and_state_shape(self) -> None:
        with psycopg.connect(self.test_database_url) as connection:
            profile_id = connection.execute(
                "SELECT id FROM luxdex.profile WHERE profile_key = 'local'"
            ).fetchone()[0]
            form_id = connection.execute(
                "SELECT id FROM luxdex.pokemon_form WHERE form_key = 'pichu'"
            ).fetchone()[0]

        invalid_statements = [
            (
                "INSERT INTO luxdex.pokemon_collection_state (profile_id, pokemon_form_id, state) VALUES (%s, %s, 'owned')",
                (profile_id, form_id),
            ),
            (
                "INSERT INTO luxdex.pokemon_collection_state (profile_id, pokemon_form_id, state, first_seen_at) VALUES (999999, %s, 'seen', now())",
                (form_id,),
            ),
            (
                "INSERT INTO luxdex.pokemon_collection_state (profile_id, pokemon_form_id, state, first_seen_at) VALUES (%s, 999999, 'seen', now())",
                (profile_id,),
            ),
        ]
        for statement, parameters in invalid_statements:
            with self.assertRaises(psycopg.IntegrityError):
                with psycopg.connect(self.test_database_url) as connection:
                    connection.execute(statement, parameters)

        self.client.put("/api/collection/pichu", json={"state": "seen"})
        with self.assertRaises(psycopg.errors.UniqueViolation):
            with psycopg.connect(self.test_database_url) as connection:
                connection.execute(
                    """
                    INSERT INTO luxdex.pokemon_collection_state (
                        profile_id, pokemon_form_id, state, first_seen_at
                    ) VALUES (%s, %s, 'seen', now())
                    """,
                    (profile_id, form_id),
                )
