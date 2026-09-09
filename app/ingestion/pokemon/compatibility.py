"""Diagnostic-only Penumbra raw-name compatibility report."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Sequence

from psycopg.rows import dict_row

from app.database import connect_database

DEFAULT_OUTPUT_PATH = (
    Path(__file__).resolve().parents[3]
    / "db"
    / "data"
    / "canonical"
    / "pokemon"
    / "penumbra-compatibility-report.json"
)
_FORME_PATTERN = re.compile(r"^.+ \(Forme \d+\)$")


def build_compatibility_report(database_url: str | None = None) -> dict[str, Any]:
    with connect_database(database_url) as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                SELECT DISTINCT encounter.source_pokemon_name
                FROM luxdex.penumbra_encounter AS encounter
                ORDER BY encounter.source_pokemon_name
                """
            )
            source_names = [str(row["source_pokemon_name"]) for row in cursor.fetchall()]
            cursor.execute(
                """
                SELECT
                    species.display_name AS species_display_name,
                    species.identifier AS species_key,
                    form.form_key,
                    form.display_name AS form_display_name,
                    form.is_default
                FROM luxdex.pokemon_species AS species
                JOIN luxdex.pokemon_form AS form ON form.species_id = species.id
                WHERE species.is_active
                ORDER BY species.national_dex_number, NOT form.is_default, form.form_order, form.id
                """
            )
            canonical_rows = list(cursor.fetchall())
            cursor.execute(
                "SELECT source_name, sha256 FROM luxdex.source_dataset "
                "WHERE source_name IN ('penumbra-wild-encounters', 'pokemon-master-usum') "
                "ORDER BY source_name"
            )
            source_versions = {
                str(row["source_name"]): str(row["sha256"]) for row in cursor.fetchall()
            }

    exact_names: dict[str, set[str]] = {}
    for row in canonical_rows:
        form_key = str(row["form_key"])
        if row["is_default"]:
            exact_names.setdefault(str(row["species_display_name"]).casefold(), set()).add(form_key)
        exact_names.setdefault(str(row["form_display_name"]).casefold(), set()).add(form_key)

    resolved: list[dict[str, str]] = []
    requires_mapping: list[dict[str, Any]] = []
    unresolved: list[dict[str, str]] = []
    for source_name in source_names:
        candidates = sorted(exact_names.get(source_name.casefold(), set()))
        if len(candidates) == 1:
            resolved.append({"source_pokemon_name": source_name, "form_key": candidates[0]})
        elif candidates:
            requires_mapping.append(
                {
                    "source_pokemon_name": source_name,
                    "reason": "canonical display name is ambiguous across forms",
                    "candidate_form_keys": candidates,
                }
            )
        elif _FORME_PATTERN.fullmatch(source_name):
            requires_mapping.append(
                {
                    "source_pokemon_name": source_name,
                    "reason": "Penumbra Forme notation requires an explicit identity mapping",
                    "candidate_form_keys": [],
                }
            )
        else:
            unresolved.append(
                {
                    "source_pokemon_name": source_name,
                    "reason": "no exact canonical English species/form display name",
                }
            )

    return {
        "format_version": 1,
        "classification_policy": {
            "resolved": "one exact Unicode case-insensitive canonical display-name match",
            "requires_explicit_mapping": "ambiguous exact match or explicit Penumbra Forme notation",
            "unresolved": "no exact display-name match; no alias was guessed",
        },
        "source_versions": source_versions,
        "summary": {
            "penumbra_unique_raw_names": len(source_names),
            "resolved": len(resolved),
            "requires_explicit_mapping": len(requires_mapping),
            "unresolved": len(unresolved),
        },
        "resolved": resolved,
        "requires_explicit_mapping": requires_mapping,
        "unresolved": unresolved,
    }


def write_compatibility_report(
    output_path: Path = DEFAULT_OUTPUT_PATH,
    database_url: str | None = None,
) -> dict[str, Any]:
    report = build_compatibility_report(database_url)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return report


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_argument_parser().parse_args(argv)
    report = write_compatibility_report(arguments.output, arguments.database_url)
    print(json.dumps(report["summary"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
