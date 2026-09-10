"""Pinned upstream revisions and repository paths for Pass 3."""

from __future__ import annotations

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SOURCE_ROOT = REPOSITORY_ROOT / "db" / "data" / "source" / "pokemon"
SOURCE_LOCK_PATH = SOURCE_ROOT / "source-lock.json"
SPRITE_DESTINATION = REPOSITORY_ROOT / "web" / "public" / "assets" / "pokemon" / "sprites"

DATA_REPOSITORY = "https://github.com/PokeAPI/pokeapi.git"
DATA_COMMIT_SHA = "8dfd1e309d4a1ca11f10b185412ed7dc8dd2b310"
ACQUISITION_DATE = "2026-09-09"

DATA_PATHS = (
    "LICENSE.md",
    "data/v2/csv/languages.csv",
    "data/v2/csv/version_groups.csv",
    "data/v2/csv/pokemon_species.csv",
    "data/v2/csv/pokemon_species_names.csv",
    "data/v2/csv/pokemon.csv",
    "data/v2/csv/pokemon_forms.csv",
    "data/v2/csv/pokemon_form_names.csv",
    "data/v2/csv/pokedexes.csv",
    "data/v2/csv/pokedex_prose.csv",
    "data/v2/csv/pokemon_dex_numbers.csv",
)

# Sprite art is no longer acquired from a live pinned git donor. It is vendored locally
# (copied onto disk by a maintainer, outside of version control - see
# db/data/source/pokemon/local-sprite-vendor/PROVENANCE.md) and referenced here only by
# description; there is no repository/commit to check out.
SPRITE_REPOSITORY = "local-vendor"
SPRITE_COMMIT_SHA = "n/a-vendored-locally-not-a-git-commit"
SPRITE_LICENSE_PATH = "local-sprite-vendor/PROVENANCE.md"
SPRITE_FAMILY = "vendored-local/hd-box-art"
SPRITE_FALLBACK_FAMILY = "vendored-local/hd-box-art-fallback"

TARGET_NATIONAL_MAX = 807
TARGET_POKEDEXES = {
    1: ("national", False),
    21: ("alola-usum", True),
    22: ("melemele-usum", True),
    23: ("akala-usum", True),
    24: ("ulaula-usum", True),
    25: ("poni-usum", True),
}


def data_destination(relative_path: str) -> Path:
    return SOURCE_ROOT / "pokeapi" / DATA_COMMIT_SHA / relative_path


def sprite_license_destination() -> Path:
    return SOURCE_ROOT / SPRITE_LICENSE_PATH

