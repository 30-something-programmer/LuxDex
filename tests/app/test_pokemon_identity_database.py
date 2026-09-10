from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import psycopg
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.identity.penumbra import DEFAULT_ALIAS_PATH, build_penumbra_pokemon_map
from app.ingestion.penumbra.loader import ensure_penumbra_dataset
from app.ingestion.pokemon.loader import ensure_pokemon_dataset
from app.main import app

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


@unittest.skipUnless(os.getenv("TEST_DATABASE_URL"), "TEST_DATABASE_URL is not configured")
class PokemonIdentityDatabaseTests(unittest.TestCase):
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

        cls.penumbra_load = ensure_penumbra_dataset(cls.test_database_url)
        cls.pokemon_load = ensure_pokemon_dataset(cls.test_database_url)
        with psycopg.connect(cls.test_database_url) as connection:
            cls.source_rows_before_map = connection.execute(
                """
                SELECT count(*), md5(string_agg(
                    id::text || chr(31) || source_pokemon_name || chr(31)
                    || source_line_number::text,
                    chr(30) ORDER BY id
                ))
                FROM luxdex.penumbra_encounter
                """
            ).fetchone()
        cls.identity_first = build_penumbra_pokemon_map(cls.test_database_url)
        cls.identity_second = build_penumbra_pokemon_map(cls.test_database_url)

    @classmethod
    def tearDownClass(cls) -> None:
        with psycopg.connect(cls.admin_database_url, autocommit=True) as connection:
            connection.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(
                    sql.Identifier(cls.test_database_name)
                )
            )

    def test_master_regression_counts_and_idempotence(self) -> None:
        counts = self.pokemon_load.counts
        self.assertEqual(counts.species, 807)
        self.assertEqual(counts.forms, 1127)
        self.assertEqual(counts.default_forms, 807)
        self.assertEqual(counts.non_default_forms, 320)
        self.assertEqual(counts.regional_forms, 18)
        self.assertEqual(counts.national_dex_entries, 807)
        self.assertEqual(counts.alola_usum_dex_entries, 403)
        self.assertEqual(counts.local_sprites, 1127)
        self.assertEqual(counts.form_specific_sprites, 320)
        self.assertEqual(counts.missing_sprite_mappings, 0)
        self.assertEqual(counts.fallback_sprites_used, 154)

        second = ensure_pokemon_dataset(self.test_database_url)
        self.assertEqual(second.status, "skipped")
        self.assertEqual(second.dataset_id, self.pokemon_load.dataset_id)
        self.assertEqual(second.counts, counts)

    def test_master_sequences_metadata_forms_and_spot_checks(self) -> None:
        with psycopg.connect(self.test_database_url) as connection:
            national_numbers = [
                row[0]
                for row in connection.execute(
                    "SELECT national_dex_number FROM luxdex.pokemon_species ORDER BY 1"
                )
            ]
            self.assertEqual(national_numbers, list(range(1, 808)))

            zeraora = connection.execute(
                """
                SELECT species.national_dex_number, number.dex_number
                FROM luxdex.pokemon_species AS species
                JOIN luxdex.pokemon_pokedex_number AS number ON number.species_id = species.id
                JOIN luxdex.pokemon_pokedex AS pokedex ON pokedex.id = number.pokedex_id
                WHERE species.identifier = 'zeraora' AND pokedex.dex_key = 'alola-usum'
                """
            ).fetchone()
            self.assertEqual(zeraora, (807, 403))

            metadata = connection.execute(
                """
                SELECT data_commit_sha, sprite_commit_sha, count(source_file.id)
                FROM luxdex.pokemon_source_dataset AS dataset
                JOIN luxdex.pokemon_source_file AS source_file
                  ON source_file.dataset_id = dataset.dataset_id
                GROUP BY dataset.dataset_id
                """
            ).fetchone()
            self.assertEqual(metadata[0], "8dfd1e309d4a1ca11f10b185412ed7dc8dd2b310")
            self.assertEqual(metadata[1], "n/a-vendored-locally-not-a-git-commit")
            self.assertEqual(metadata[2], 11)

            spot_checks = dict(
                connection.execute(
                    """
                    SELECT form.form_key, ARRAY[
                        species.national_dex_number::text,
                        species.display_name,
                        form.display_name,
                        COALESCE(sprite.local_path, '')
                    ]
                    FROM luxdex.pokemon_form AS form
                    JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
                    LEFT JOIN luxdex.pokemon_sprite_asset AS sprite ON sprite.form_id = form.id
                    WHERE form.form_key = ANY(%s)
                    """,
                    (
                        [
                            "bulbasaur",
                            "pikachu",
                            "pichu",
                            "rattata",
                            "rattata:alola",
                            "meowth",
                            "meowth:alola",
                            "grimer",
                            "grimer:alola",
                            "type-null",
                            "mr-mime",
                            "necrozma",
                            "zeraora",
                        ],
                    ),
                )
            )
        self.assertEqual(len(spot_checks), 13)
        self.assertEqual(spot_checks["rattata:alola"][2], "Alolan Rattata")
        self.assertEqual(
            spot_checks["rattata:alola"][3],
            "/assets/pokemon/sprites/rattata-alola.png",
        )
        self.assertEqual(spot_checks["type-null"][1], "Type: Null")
        self.assertEqual(spot_checks["mr-mime"][1], "Mr. Mime")

    def test_pokemon_api_ordering_filter_and_fallback_sprite(self) -> None:
        with patch.dict(os.environ, {"DATABASE_URL": self.test_database_url}):
            with TestClient(app) as client:
                def all_pages(order: str) -> list[dict[str, object]]:
                    items: list[dict[str, object]] = []
                    offset = 0
                    while True:
                        response = client.get(
                            "/api/pokemon",
                            params={"order": order, "limit": 200, "offset": offset},
                        )
                        self.assertEqual(response.status_code, 200)
                        payload = response.json()
                        items.extend(payload["items"])
                        if payload["next_offset"] is None:
                            return items
                        offset = payload["next_offset"]

                national = all_pages("national")
                alola = all_pages("alola")
                alphabetical = all_pages("name")
                generation_seven = client.get(
                    "/api/pokemon", params={"generation": 7, "limit": 100}
                )
                fallback_sprite = client.get("/api/pokemon/meowstic:female")

        self.assertEqual(national[0]["species_key"], "bulbasaur")
        self.assertEqual(national[-1]["species_key"], "zeraora")
        self.assertEqual(len(alola), 403)
        self.assertEqual(alola[-1]["alola_usum_dex_number"], 403)
        names = [str(item["display_name"]).casefold() for item in alphabetical]
        self.assertEqual(names, sorted(names))
        self.assertEqual(len(generation_seven.json()["items"]), 86)
        # meowstic:female has no exact form art in the vendored source, so it
        # falls back to its own copy of the species-default artwork rather than
        # having no sprite at all.
        self.assertEqual(
            fallback_sprite.json()["selected_form"]["sprite_path"],
            "/assets/pokemon/sprites/meowstic-female.png",
        )

    def test_complete_identity_map_is_idempotent_and_preserves_source_rows(self) -> None:
        self.assertEqual(self.identity_first.status, "loaded")
        self.assertEqual(self.identity_second.status, "skipped")
        self.assertEqual(self.identity_first.build_id, self.identity_second.build_id)
        self.assertEqual(
            self.identity_first.summary,
            {
                "total_raw_identities": 570,
                "resolved": 570,
                "exact": 508,
                "normalised_exact": 0,
                "explicit_alias": 2,
                "explicit_form_alias": 60,
                "manual_verified": 0,
                "unresolved": 0,
                "mapped_targets_without_local_sprite": 0,
            },
        )
        with psycopg.connect(self.test_database_url) as connection:
            source_rows_after_map = connection.execute(
                """
                SELECT count(*), md5(string_agg(
                    id::text || chr(31) || source_pokemon_name || chr(31)
                    || source_line_number::text,
                    chr(30) ORDER BY id
                ))
                FROM luxdex.penumbra_encounter
                """
            ).fetchone()
            duplicate_count = connection.execute(
                """
                SELECT count(*) - count(DISTINCT source_identity_id)
                FROM luxdex.penumbra_pokemon_identity_map
                """
            ).fetchone()[0]
        self.assertEqual(source_rows_after_map, self.source_rows_before_map)
        self.assertEqual(duplicate_count, 0)

    def test_canonical_encounter_lookup_and_local_sprite_chain(self) -> None:
        with patch.dict(os.environ, {"DATABASE_URL": self.test_database_url}):
            with TestClient(app) as client:
                regional = client.get(
                    "/api/encounters/pokemon/rattata:alola", params={"limit": 2}
                )
                normal = client.get("/api/encounters/pokemon/rattata", params={"limit": 2})
                diagnostics = client.get("/api/identity/penumbra")

        self.assertEqual(regional.status_code, 200)
        self.assertTrue(regional.json()["items"])
        self.assertTrue(
            all(
                item["source_pokemon_name"] == "Rattata (Forme 1)"
                for item in regional.json()["items"]
            )
        )
        canonical = regional.json()["items"][0]["canonical_pokemon"]
        self.assertEqual(canonical["canonical_key"], "rattata:alola")
        self.assertEqual(canonical["display_name"], "Alolan Rattata")
        self.assertEqual(canonical["national_dex_number"], 19)
        self.assertEqual(canonical["alola_dex_number"], 15)
        self.assertEqual(
            canonical["local_sprite_path"],
            "/assets/pokemon/sprites/rattata-alola.png",
        )
        self.assertTrue(normal.json()["items"])
        self.assertTrue(
            all(item["source_pokemon_name"] == "Rattata" for item in normal.json()["items"])
        )
        self.assertEqual(diagnostics.json()["total_raw_identities"], 570)
        self.assertEqual(diagnostics.json()["unresolved_names"], [])
        self.assertEqual(diagnostics.json()["mapped_targets_without_local_sprite"], [])

    def test_failed_identity_replacement_rolls_back_previous_map(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            alias_path = Path(temporary_directory) / "aliases.csv"
            alias_path.write_bytes(DEFAULT_ALIAS_PATH.read_bytes() + b"\n")
            report_path = Path(temporary_directory) / "report.json"
            with patch(
                "app.identity.penumbra._encounter_fingerprint",
                side_effect=[(100, "before"), (100, "after")],
            ):
                with self.assertRaisesRegex(RuntimeError, "source encounter rows changed"):
                    build_penumbra_pokemon_map(
                        self.test_database_url,
                        alias_path,
                        report_path,
                    )

        with psycopg.connect(self.test_database_url) as connection:
            build_id = connection.execute(
                "SELECT id FROM luxdex.penumbra_pokemon_identity_build"
            ).fetchone()[0]
            mapping_count = connection.execute(
                "SELECT count(*) FROM luxdex.penumbra_pokemon_identity_map"
            ).fetchone()[0]
        self.assertEqual(build_id, self.identity_first.build_id)
        self.assertEqual(mapping_count, 570)

    def test_runtime_frontend_has_no_remote_sprite_reference(self) -> None:
        sprite_library = (REPOSITORY_ROOT / "web/src/lib/sprites.ts").read_text(
            encoding="utf-8"
        )
        web_source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (REPOSITORY_ROOT / "web/src").rglob("*")
            if path.is_file() and path.suffix in {".ts", ".tsx", ".css"}
        )
        self.assertIn('/assets/pokemon/sprites', sprite_library)
        self.assertNotIn("raw.githubusercontent.com", web_source)
        self.assertNotIn("pokeapi.co", web_source)


if __name__ == "__main__":
    unittest.main()
