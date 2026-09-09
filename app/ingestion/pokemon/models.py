"""Typed canonical model produced from the pinned PokéAPI donors."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal

DisplayNameSource = Literal[
    "species_name",
    "pokemon_form_name",
    "form_name",
    "derived_form_identifier",
]


@dataclass(frozen=True, slots=True)
class PokemonSourceMetadata:
    source_name: str
    manifest_filename: str
    manifest_path: Path
    manifest_sha256: str
    manifest_byte_count: int
    manifest_line_count: int
    manifest_nonblank_line_count: int
    parser_version: str
    data_repository: str
    data_commit_sha: str
    sprite_repository: str
    sprite_commit_sha: str
    acquisition_date: date
    data_license_path: str
    sprite_license_path: str


@dataclass(frozen=True, slots=True)
class SourceFile:
    source_order: int
    source_component: Literal["pokeapi-data", "pokeapi-sprites"]
    source_role: Literal["data", "license", "manifest"]
    source_path: str
    destination_path: str
    sha256: str
    byte_count: int


@dataclass(frozen=True, slots=True)
class SpriteAsset:
    form_key: str
    sprite_family: str
    local_path: str
    upstream_path: str
    sha256: str
    byte_count: int
    width: int
    height: int


@dataclass(frozen=True, slots=True)
class MissingSprite:
    form_key: str
    reason: str
    checked_paths: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class PokemonForm:
    form_key: str
    identifier: str
    display_name: str
    display_name_source: DisplayNameSource
    is_default: bool
    form_order: int
    is_battle_only: bool
    is_mega: bool
    is_regional: bool
    regional_name: str | None
    sprite_key: str
    upstream_pokemon_id: int
    upstream_form_id: int
    upstream_pokemon_identifier: str
    upstream_form_identifier: str | None
    introduced_version_group_id: int
    sprite: SpriteAsset | None


@dataclass(frozen=True, slots=True)
class PokemonSpecies:
    national_dex_number: int
    identifier: str
    display_name: str
    generation: int
    is_active: bool
    upstream_species_id: int
    upstream_identifier: str
    forms: tuple[PokemonForm, ...]


@dataclass(frozen=True, slots=True)
class PokedexEntry:
    species_identifier: str
    dex_number: int


@dataclass(frozen=True, slots=True)
class Pokedex:
    dex_key: str
    display_name: str
    upstream_pokedex_id: int
    is_in_game: bool
    entries: tuple[PokedexEntry, ...]


@dataclass(frozen=True, slots=True)
class ParsedPokemonDataset:
    metadata: PokemonSourceMetadata
    source_files: tuple[SourceFile, ...]
    species: tuple[PokemonSpecies, ...]
    pokedexes: tuple[Pokedex, ...]
    missing_sprites: tuple[MissingSprite, ...]


@dataclass(frozen=True, slots=True)
class PokemonRegressionCounts:
    source_datasets: int
    source_files: int
    species: int
    forms: int
    default_forms: int
    non_default_forms: int
    regional_forms: int
    national_dex_entries: int
    alola_usum_dex_entries: int
    melemele_usum_dex_entries: int
    akala_usum_dex_entries: int
    ulaula_usum_dex_entries: int
    poni_usum_dex_entries: int
    species_by_generation: tuple[tuple[int, int], ...]
    local_sprites: int
    form_specific_sprites: int
    missing_sprite_mappings: int
    fallback_sprites_used: int
    manifest_byte_count: int
    manifest_line_count: int
    manifest_sha256: str

    def to_dict(self) -> dict[str, object]:
        return {
            "source_datasets": self.source_datasets,
            "source_files": self.source_files,
            "species": self.species,
            "forms": self.forms,
            "default_forms": self.default_forms,
            "non_default_forms": self.non_default_forms,
            "regional_forms": self.regional_forms,
            "national_dex_entries": self.national_dex_entries,
            "alola_usum_dex_entries": self.alola_usum_dex_entries,
            "melemele_usum_dex_entries": self.melemele_usum_dex_entries,
            "akala_usum_dex_entries": self.akala_usum_dex_entries,
            "ulaula_usum_dex_entries": self.ulaula_usum_dex_entries,
            "poni_usum_dex_entries": self.poni_usum_dex_entries,
            "species_by_generation": {
                str(generation): count for generation, count in self.species_by_generation
            },
            "local_sprites": self.local_sprites,
            "form_specific_sprites": self.form_specific_sprites,
            "missing_sprite_mappings": self.missing_sprite_mappings,
            "fallback_sprites_used": self.fallback_sprites_used,
            "manifest_byte_count": self.manifest_byte_count,
            "manifest_line_count": self.manifest_line_count,
            "manifest_sha256": self.manifest_sha256,
        }


@dataclass(frozen=True, slots=True)
class PokemonLoadResult:
    status: Literal["loaded", "replaced", "skipped"]
    dataset_id: int
    counts: PokemonRegressionCounts

