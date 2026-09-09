from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.ingestion.penumbra.loader import ensure_penumbra_dataset
from penumbra_fixture import source_document

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(os.getenv("TEST_DATABASE_URL"), "TEST_DATABASE_URL is not configured")
class PenumbraDatabaseTests(unittest.TestCase):
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
            connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(cls.test_database_name)))
        with psycopg.connect(cls.test_database_url) as connection:
            for schema_file in sorted((REPOSITORY_ROOT / "db/schema").glob("*.sql")):
                connection.execute(schema_file.read_text(encoding="utf-8"))

    @classmethod
    def tearDownClass(cls) -> None:
        with psycopg.connect(cls.admin_database_url, autocommit=True) as connection:
            connection.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(cls.test_database_name))
            )

    def test_schema_constraints_indexes_idempotence_replacement_and_rollback(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source_path = Path(temporary_directory) / "wild-encounters.txt"
            source_path.write_text(source_document(day_normal="Alpha (100%)"), encoding="utf-8")

            first = ensure_penumbra_dataset(self.test_database_url, source_path)
            second = ensure_penumbra_dataset(self.test_database_url, source_path)
            self.assertEqual(first.status, "loaded")
            self.assertEqual(second.status, "skipped")
            self.assertEqual(first.dataset_id, second.dataset_id)

            source_path.write_text(source_document(day_normal="Beta (100%)"), encoding="utf-8")
            replaced = ensure_penumbra_dataset(self.test_database_url, source_path)
            self.assertEqual(replaced.status, "replaced")
            self.assertNotEqual(replaced.dataset_id, first.dataset_id)

            with psycopg.connect(self.test_database_url) as connection:
                names = {
                    row[0]
                    for row in connection.execute(
                        "SELECT DISTINCT source_pokemon_name FROM luxdex.penumbra_encounter"
                    )
                }
            self.assertIn("Beta", names)
            self.assertNotIn("Alpha", names)

            source_path.write_text(source_document(day_normal="Gamma (100%)"), encoding="utf-8")
            with patch(
                "app.ingestion.penumbra.loader._insert_map_groups",
                side_effect=RuntimeError("forced transactional failure"),
            ):
                with self.assertRaisesRegex(RuntimeError, "forced transactional failure"):
                    ensure_penumbra_dataset(self.test_database_url, source_path)

            with psycopg.connect(self.test_database_url) as connection:
                names_after_rollback = {
                    row[0]
                    for row in connection.execute(
                        "SELECT DISTINCT source_pokemon_name FROM luxdex.penumbra_encounter"
                    )
                }
            self.assertIn("Beta", names_after_rollback)
            self.assertNotIn("Gamma", names_after_rollback)

        with psycopg.connect(self.test_database_url) as connection:
            table_names = {
                row[0]
                for row in connection.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'luxdex'"
                )
            }
            index_names = {
                row[0]
                for row in connection.execute(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = 'luxdex'"
                )
            }
        self.assertTrue(
            {
                "source_dataset",
                "penumbra_map_group",
                "penumbra_map_location",
                "penumbra_encounter_table",
                "penumbra_encounter_pool",
                "penumbra_encounter",
            }.issubset(table_names)
        )
        self.assertTrue(
            {
                "penumbra_map_location_raw_map_number_idx",
                "penumbra_map_location_name_prefix_idx",
                "penumbra_encounter_pokemon_name_prefix_idx",
            }.issubset(index_names)
        )

        with self.assertRaises(psycopg.errors.CheckViolation):
            with psycopg.connect(self.test_database_url) as connection:
                connection.execute(
                    "UPDATE luxdex.penumbra_encounter SET rate_percent = 101 "
                    "WHERE id = (SELECT min(id) FROM luxdex.penumbra_encounter)"
                )
        with self.assertRaises(psycopg.errors.UniqueViolation):
            with psycopg.connect(self.test_database_url) as connection:
                connection.execute(
                    "INSERT INTO luxdex.source_dataset "
                    "(source_name, source_filename, sha256, byte_count, line_count, "
                    "nonblank_line_count, parser_version) "
                    "SELECT source_name, source_filename, sha256, byte_count, line_count, "
                    "nonblank_line_count, parser_version FROM luxdex.source_dataset LIMIT 1"
                )
        with self.assertRaises(psycopg.errors.ForeignKeyViolation):
            with psycopg.connect(self.test_database_url) as connection:
                connection.execute(
                    "INSERT INTO luxdex.penumbra_map_group "
                    "(dataset_id, source_sequence, raw_header, declared_table_count, "
                    "source_line_start, source_line_end) "
                    "VALUES (999999, 1, 'invalid', 0, 1, 1)"
                )


if __name__ == "__main__":
    unittest.main()
