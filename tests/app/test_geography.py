from __future__ import annotations

import csv
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import psycopg
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.geography.loader import (
    DEFAULT_CANONICAL_DIRECTORY,
    GeographyValidationError,
    build_geography,
    load_and_validate_bundle,
)
from app.identity.penumbra import build_penumbra_pokemon_map
from app.ingestion.penumbra.loader import ensure_penumbra_dataset
from app.ingestion.pokemon.loader import ensure_pokemon_dataset
from app.main import app

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class GeographyBundleTests(unittest.TestCase):
    def test_real_bundle_hierarchy_evidence_and_structural_counts(self) -> None:
        bundle = load_and_validate_bundle()
        self.assertEqual(bundle.vanilla_map_count, 336)
        self.assertEqual(bundle.vanilla_table_count, 397)
        self.assertEqual(len(bundle.rows["area-groups.csv"]), 5)
        self.assertEqual(len(bundle.rows["locations.csv"]), 6)
        self.assertEqual(len(bundle.rows["encounter-places.csv"]), 17)
        self.assertEqual(len(bundle.rows["table-mappings.csv"]), 39)
        self.assertEqual(
            {row["group_key"] for row in bundle.rows["area-groups.csv"]},
            {"melemele", "akala", "ulaula", "poni", "other-special"},
        )
        evidence_keys = {row["mapping_key"] for row in bundle.rows["mapping-evidence.csv"]}
        self.assertEqual(
            evidence_keys,
            {row["mapping_key"] for row in bundle.rows["table-mappings.csv"]},
        )

    def test_verified_mapping_without_evidence_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            canonical = Path(temporary_directory) / "geography"
            shutil.copytree(DEFAULT_CANONICAL_DIRECTORY, canonical)
            evidence_path = canonical / "mapping-evidence.csv"
            rows = list(csv.DictReader(evidence_path.read_text(encoding="utf-8").splitlines()))
            rows = [row for row in rows if row["mapping_key"] != "g001-t01"]
            with evidence_path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
            with self.assertRaisesRegex(GeographyValidationError, "require evidence"):
                load_and_validate_bundle(canonical_directory=canonical)

    def test_nonexistent_raw_table_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            canonical = Path(temporary_directory) / "geography"
            shutil.copytree(DEFAULT_CANONICAL_DIRECTORY, canonical)
            mappings_path = canonical / "table-mappings.csv"
            text = mappings_path.read_text(encoding="utf-8")
            mappings_path.write_text(
                text
                + "g999-t01,999,1,route-1-first-two-fields-east-house,"
                + "vanilla_pool_match,verified,Invalid fixture mapping.\n",
                encoding="utf-8",
            )
            evidence_path = canonical / "mapping-evidence.csv"
            evidence_path.write_text(
                evidence_path.read_text(encoding="utf-8")
                + "g999-t01,sciresm-usum-encounters,1,Invalid fixture,Invalid fixture.\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(GeographyValidationError, "nonexistent vanilla"):
                load_and_validate_bundle(canonical_directory=canonical)


@unittest.skipUnless(os.getenv("TEST_DATABASE_URL"), "TEST_DATABASE_URL is not configured")
class GeographyDatabaseTests(unittest.TestCase):
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
        cls.identity_build = build_penumbra_pokemon_map(
            cls.test_database_url,
            report_path=Path(tempfile.gettempdir()) / f"{cls.test_database_name}-identity.json",
        )
        cls.report_path = Path(tempfile.gettempdir()) / f"{cls.test_database_name}-geography.json"
        cls.first_build = build_geography(cls.test_database_url, report_path=cls.report_path)
        cls.second_build = build_geography(cls.test_database_url, report_path=cls.report_path)

    @classmethod
    def tearDownClass(cls) -> None:
        with psycopg.connect(cls.admin_database_url, autocommit=True) as connection:
            connection.execute(
                sql.SQL("DROP DATABASE {} WITH (FORCE)").format(
                    sql.Identifier(cls.test_database_name)
                )
            )
        cls.report_path.unlink(missing_ok=True)

    def test_population_counts_idempotence_and_coverage_report(self) -> None:
        self.assertEqual(self.first_build.status, "loaded")
        self.assertEqual(self.second_build.status, "skipped")
        self.assertEqual(self.first_build.build_id, self.second_build.build_id)
        self.assertEqual(
            self.first_build.summary,
            {
                "total_raw_tables": 397,
                "verified_mapped_tables": 39,
                "probable_tables": 0,
                "unresolved_tables": 358,
                "coverage_percent": 9.82,
                "area_groups": 5,
                "locations": 6,
                "encounter_places": 17,
            },
        )
        report = json.loads(self.report_path.read_text(encoding="utf-8"))
        self.assertEqual(
            sum(group["unresolved_count"] for group in report["unresolved_by_raw_map_block"]),
            358,
        )
        route_one = next(
            group
            for group in report["unresolved_by_raw_map_block"]
            if group["source_sequence"] == 1
        )
        self.assertEqual(route_one["unresolved_table_numbers"], [18])
        self.assertEqual(report["probable_mappings"], [])

    def test_route_examples_many_to_one_and_one_block_to_many_locations(self) -> None:
        with psycopg.connect(self.test_database_url) as connection:
            many_to_one = connection.execute(
                """
                SELECT count(*)
                FROM luxdex.geography_encounter_place_table_map AS table_map
                JOIN luxdex.geography_encounter_place AS place
                  ON place.id = table_map.encounter_place_id
                WHERE place.place_key = 'route-1-grass-near-iki-western-path'
                """
            ).fetchone()[0]
            block_locations = connection.execute(
                """
                SELECT count(DISTINCT location.location_key)
                FROM luxdex.geography_encounter_place_table_map AS table_map
                JOIN luxdex.geography_encounter_place AS place
                  ON place.id = table_map.encounter_place_id
                JOIN luxdex.geography_location AS location ON location.id = place.location_id
                JOIN luxdex.penumbra_encounter_table AS encounter_table
                  ON encounter_table.id = table_map.penumbra_encounter_table_id
                JOIN luxdex.penumbra_map_group AS map_group ON map_group.id = encounter_table.map_group_id
                WHERE map_group.source_sequence = 1
                """
            ).fetchone()[0]
            route_three = dict(
                connection.execute(
                    """
                    SELECT place.place_key, count(table_map.id)
                    FROM luxdex.geography_encounter_place AS place
                    JOIN luxdex.geography_encounter_place_table_map AS table_map
                      ON table_map.encounter_place_id = place.id
                    WHERE place.place_key IN (
                        'route-3-two-fields-north-bridge',
                        'route-3-field-south-bridge',
                        'route-3-ambush-encounters',
                        'route-3-berry-pile'
                    )
                    GROUP BY place.id
                    """
                )
            )
        self.assertEqual(many_to_one, 6)
        self.assertEqual(block_locations, 3)
        self.assertEqual(route_three["route-3-two-fields-north-bridge"], 2)
        self.assertEqual(route_three["route-3-field-south-bridge"], 1)
        self.assertEqual(route_three["route-3-ambush-encounters"], 4)
        self.assertEqual(route_three["route-3-berry-pile"], 1)

    def test_database_constraints_enforce_evidence_and_raw_table_fk(self) -> None:
        with psycopg.connect(self.test_database_url) as connection:
            place_id = connection.execute(
                "SELECT id FROM luxdex.geography_encounter_place LIMIT 1"
            ).fetchone()[0]
            unmapped_table_id = connection.execute(
                """
                SELECT encounter_table.id
                FROM luxdex.penumbra_encounter_table AS encounter_table
                LEFT JOIN luxdex.geography_encounter_place_table_map AS table_map
                  ON table_map.penumbra_encounter_table_id = encounter_table.id
                WHERE table_map.id IS NULL
                ORDER BY encounter_table.id
                LIMIT 1
                """
            ).fetchone()[0]
            connection.execute(
                """
                INSERT INTO luxdex.geography_encounter_place_table_map (
                    encounter_place_id, penumbra_encounter_table_id,
                    mapping_method, mapping_status, mapping_note
                ) VALUES (%s, %s, 'manual_verified', 'verified', 'Test mapping without evidence.')
                """,
                (place_id, unmapped_table_id),
            )
            with self.assertRaisesRegex(psycopg.errors.RaiseException, "requires evidence"):
                connection.commit()
            connection.rollback()

            with self.assertRaises(psycopg.errors.ForeignKeyViolation):
                connection.execute(
                    """
                    INSERT INTO luxdex.geography_encounter_place_table_map (
                        encounter_place_id, penumbra_encounter_table_id,
                        mapping_method, mapping_status, mapping_note
                    ) VALUES (%s, -1, 'manual_verified', 'verified', 'Invalid fixture.')
                    """,
                    (place_id,),
                )
            connection.rollback()

    def test_api_hierarchy_and_full_backend_join(self) -> None:
        with patch.dict(os.environ, {"DATABASE_URL": self.test_database_url}):
            with TestClient(app) as client:
                groups = client.get("/api/geography/groups")
                locations = client.get("/api/geography/groups/melemele/locations")
                route_one = client.get("/api/geography/locations/route-1")
                route_three_places = client.get(
                    "/api/geography/locations/route-3/encounter-places"
                )
                south_grass = client.get(
                    "/api/geography/encounter-places/route-3-field-south-bridge"
                )
                missing = client.get("/api/geography/locations/not-a-location")

        self.assertEqual(groups.status_code, 200)
        self.assertEqual([row["group_key"] for row in groups.json()][:4], [
            "melemele",
            "akala",
            "ulaula",
            "poni",
        ])
        self.assertEqual(locations.status_code, 200)
        self.assertEqual(route_one.status_code, 200)
        self.assertEqual(route_three_places.status_code, 200)
        self.assertEqual(missing.status_code, 404)

        payload = south_grass.json()
        self.assertEqual(payload["area_group_key"], "melemele")
        self.assertEqual(payload["location_key"], "route-3")
        self.assertEqual(payload["encounter_method"], "grass")
        self.assertEqual(payload["raw_table_mappings"][0]["source_table_number"], 14)
        self.assertGreaterEqual(len(payload["raw_table_mappings"][0]["evidence"]), 2)
        resolved_encounters = [
            encounter for encounter in payload["encounters"] if encounter["canonical_pokemon"]
        ]
        self.assertTrue(resolved_encounters)
        self.assertTrue(
            any(
                encounter["canonical_pokemon"]["local_sprite_path"].startswith(
                    "/assets/pokemon/sprites/"
                )
                for encounter in resolved_encounters
                if encounter["canonical_pokemon"]["local_sprite_path"]
            )
        )

    def test_frontend_location_read_models_preserve_time_forms_and_sos_slots(self) -> None:
        with patch.dict(os.environ, {"DATABASE_URL": self.test_database_url}):
            with TestClient(app) as client:
                route_one_response = client.get(
                    "/api/explore/areas/melemele/route-1"
                )
                route_three_response = client.get(
                    "/api/explore/areas/melemele/route-3"
                )
                kalae_bay_response = client.get(
                    "/api/explore/areas/melemele/kalae-bay"
                )

        self.assertEqual(route_one_response.status_code, 200)
        route_one = route_one_response.json()
        self.assertEqual(route_one["location_display_name"], "Route 1")
        self.assertEqual(len(route_one["places"]), 4)
        self.assertNotIn("raw_map_header", route_one_response.text)

        bay = next(
            place
            for place in route_one["places"]
            if place["place_key"] == "route-1-grass-overlooking-bay"
        )
        day = next(pool for pool in bay["pools"] if pool["time_of_day"] == "day")
        night = next(pool for pool in bay["pools"] if pool["time_of_day"] == "night")
        self.assertTrue(day["normal"])
        self.assertTrue(night["normal"])

        pikachu = next(
            pokemon for pokemon in day["sos"] if pokemon["canonical_key"] == "pikachu"
        )
        self.assertEqual(pikachu["sos_slots"], [1, 2, 3, 4])
        self.assertEqual(pikachu["rate_percent"], 10)
        self.assertEqual(
            pikachu["sprite_path"], "/assets/pokemon/sprites/pikachu.png"
        )

        self.assertEqual(route_three_response.status_code, 200)
        self.assertEqual(len(route_three_response.json()["places"]), 4)
        self.assertEqual(kalae_bay_response.status_code, 200)
        self.assertEqual(len(kalae_bay_response.json()["places"]), 4)

    def test_frontend_pokemon_search_detail_and_find_in_penumbra(self) -> None:
        with patch.dict(os.environ, {"DATABASE_URL": self.test_database_url}):
            with TestClient(app) as client:
                search_results = {
                    query: client.get("/api/pokemon/search", params={"q": query})
                    for query in ("Pichu", "Pikachu", "Rattata", "Type: Null", "Mr. Mime")
                }
                pichu = client.get("/api/explore/pokemon/pichu")
                alolan_rattata = client.get(
                    "/api/explore/pokemon/rattata%3Aalola"
                )
                bulbasaur = client.get("/api/explore/pokemon/bulbasaur")
                filtered_pokedex = client.get(
                    "/api/pokemon",
                    params={"order": "name", "q": "Mr. Mime", "limit": 1000},
                )

        for query, response in search_results.items():
            self.assertEqual(response.status_code, 200, query)
            self.assertTrue(response.json(), query)
        self.assertIn(
            "Alolan Rattata",
            [
                row["selected_form"]["display_name"]
                for row in search_results["Rattata"].json()
            ],
        )

        self.assertEqual(pichu.status_code, 200)
        self.assertTrue(pichu.json()["encounters"])
        self.assertTrue(
            all(
                occurrence["location_name"] != ""
                and occurrence["place_name"] != ""
                for occurrence in pichu.json()["encounters"]
            )
        )

        self.assertEqual(alolan_rattata.status_code, 200)
        self.assertEqual(
            alolan_rattata.json()["selected_form"]["display_name"],
            "Alolan Rattata",
        )
        self.assertTrue(alolan_rattata.json()["encounters"])
        self.assertEqual(bulbasaur.status_code, 200)
        self.assertEqual(bulbasaur.json()["encounters"], [])
        self.assertEqual(filtered_pokedex.status_code, 200)
        self.assertEqual(
            [item["display_name"] for item in filtered_pokedex.json()["items"]],
            ["Mr. Mime"],
        )
