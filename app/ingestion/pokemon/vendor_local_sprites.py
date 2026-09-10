"""Maintainer tool: vendor sprite art from a local image folder.

Sprite art is not acquired from a live git donor (see PROVENANCE.md). Instead a
maintainer points this script at a local directory of `NNNN[-Form].png` images
(national dex id, zero-padded to 4 digits, optionally suffixed with a form name)
and it:

1. Matches every USUM-relevant target form (species <= national dex #807,
   introduced no later than Ultra Sun/Ultra Moon) to a file in that directory by
   national dex id and a normalised form-suffix comparison.
2. Falls back to a form's species-default image when no exact per-form image
   exists, rather than leaving the form without art.
3. Copies the matched files into web/public/assets/pokemon/sprites/ (kept out of
   version control; see .gitignore) and rewrites the sprite_source/sprites
   sections of source-lock.json with fresh checksums/dimensions.

It refuses to run if any target form cannot be resolved at all (no exact match
and no species-default fallback available), rather than silently shipping an
incomplete set.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import struct
from datetime import date
from pathlib import Path
from typing import Any

from app.ingestion.pokemon.acquire import build_form_key, select_target_forms
from app.ingestion.pokemon.source_config import (
    SOURCE_LOCK_PATH,
    SOURCE_ROOT,
    SPRITE_DESTINATION,
    SPRITE_FALLBACK_FAMILY,
    SPRITE_FAMILY,
    SPRITE_REPOSITORY,
    SPRITE_COMMIT_SHA,
    TARGET_NATIONAL_MAX,
    DATA_COMMIT_SHA,
)

_FILENAME_PATTERN = re.compile(r"^(\d{4})(?:-(.+))?\.png$", re.IGNORECASE)


class SpriteVendorError(RuntimeError):
    pass


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as source:
        header = source.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise SpriteVendorError(f"not a valid PNG with an IHDR header: {path}")
    return struct.unpack(">II", header[16:24])


def _csv_rows(root: Path, relative_path: str) -> list[dict[str, str]]:
    with (root / relative_path).open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def _index_source_images(source_dir: Path) -> dict[int, dict[str, str]]:
    by_id: dict[int, dict[str, str]] = {}
    for path in source_dir.glob("*.png"):
        match = _FILENAME_PATTERN.match(path.name)
        if not match:
            continue
        national_id = int(match.group(1))
        suffix = match.group(2) or ""
        by_id.setdefault(national_id, {})[_normalize(suffix)] = path.name
    return by_id


def build_sprite_rows(source_dir: Path) -> list[dict[str, Any]]:
    data_root = SOURCE_ROOT / "pokeapi" / DATA_COMMIT_SHA
    dex_rows = _csv_rows(data_root, "data/v2/csv/pokemon_dex_numbers.csv")
    national_numbers = {
        int(row["species_id"]): int(row["pokedex_number"])
        for row in dex_rows
        if int(row["pokedex_id"]) == 1 and int(row["pokedex_number"]) <= TARGET_NATIONAL_MAX
    }

    by_id = _index_source_images(source_dir)

    unresolved: list[str] = []
    rows: list[dict[str, Any]] = []
    for form, pokemon, species in select_target_forms(data_root):
        species_id = int(species["id"])
        if species_id not in national_numbers:
            continue
        national_id = national_numbers[species_id]
        form_key = build_form_key(form, pokemon, species)
        is_default = pokemon["is_default"] == "1" and form["is_default"] == "1"
        candidates = by_id.get(national_id, {})

        exact = candidates.get("") if is_default else candidates.get(_normalize(form["form_identifier"] or ""))
        is_fallback = exact is None
        source_filename = exact or candidates.get("")

        if source_filename is None:
            unresolved.append(form_key)
            continue

        local_filename = f"{form_key.replace(':', '-')}.png"
        source_path = source_dir / source_filename
        width, height = _png_dimensions(source_path)
        rows.append(
            {
                "form_key": form_key,
                "sprite_family": SPRITE_FALLBACK_FAMILY if is_fallback else SPRITE_FAMILY,
                "local_path": f"/assets/pokemon/sprites/{local_filename}",
                "upstream_path": source_filename + (" (species-default fallback)" if is_fallback else ""),
                "sha256": _sha256(source_path),
                "byte_count": source_path.stat().st_size,
                "width": width,
                "height": height,
                "_source_file": str(source_path),
            }
        )

    if unresolved:
        raise SpriteVendorError(
            "no art (exact or species-default fallback) found for: " + ", ".join(sorted(unresolved))
        )
    return rows


def vendor(source_dir: Path, acquisition_date: str | None = None) -> dict[str, Any]:
    if not source_dir.is_dir():
        raise SpriteVendorError(f"source directory does not exist: {source_dir}")

    rows = build_sprite_rows(source_dir)

    SPRITE_DESTINATION.mkdir(parents=True, exist_ok=True)
    expected_filenames = {Path(row["local_path"]).name for row in rows}
    for stale in SPRITE_DESTINATION.glob("*.png"):
        if stale.name not in expected_filenames:
            stale.unlink()
    for row in rows:
        destination = SPRITE_DESTINATION / Path(row["local_path"]).name
        shutil.copyfile(row.pop("_source_file"), destination)

    existing_lock = json.loads(SOURCE_LOCK_PATH.read_text(encoding="utf-8"))
    existing_lock["sprite_source"] = {
        "repository": SPRITE_REPOSITORY,
        "commit_sha": SPRITE_COMMIT_SHA,
        "family": SPRITE_FAMILY,
        "vendored_date": acquisition_date or date.today().isoformat(),
        "note": "Vendored locally, kept out of version control; see PROVENANCE.md.",
    }
    existing_lock["sprites"] = rows
    existing_lock["missing_sprites"] = []
    SOURCE_LOCK_PATH.write_text(
        json.dumps(existing_lock, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    return {
        "vendored_sprites": len(rows),
        "exact_matches": sum(1 for row in rows if row["sprite_family"] == SPRITE_FAMILY),
        "fallback_matches": sum(1 for row in rows if row["sprite_family"] == SPRITE_FALLBACK_FAMILY),
    }


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source_dir",
        type=Path,
        help="local directory of NNNN[-Form].png images to vendor from",
    )
    parser.add_argument("--acquisition-date", default=None, help="override the ISO date recorded in the lock")
    return parser


def main(argv: list[str] | None = None) -> int:
    arguments = build_argument_parser().parse_args(argv)
    print(json.dumps(vendor(arguments.source_dir, arguments.acquisition_date), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
