"""Typed public response models for the Pokémon master proof API."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.api.collection_models import CollectionState


class PokemonSourceResponse(BaseModel):
    source_name: str
    source_filename: str
    sha256: str
    byte_count: int
    line_count: int
    nonblank_line_count: int
    parser_version: str
    imported_at: datetime
    data_repository: str
    data_commit_sha: str
    sprite_repository: str
    sprite_commit_sha: str
    acquisition_date: date
    data_license_path: str
    sprite_license_path: str
    source_file_count: int


class PokemonSpeciesSummary(BaseModel):
    species_key: str
    national_dex_number: int
    alola_usum_dex_number: int | None
    display_name: str
    generation: int
    default_form_key: str
    default_sprite_key: str
    default_sprite_path: str | None
    collection_state: CollectionState


class PokemonSpeciesPage(BaseModel):
    items: list[PokemonSpeciesSummary]
    offset: int
    next_offset: int | None


class PokemonFormResponse(BaseModel):
    form_key: str
    identifier: str
    display_name: str
    display_name_source: Literal[
        "species_name",
        "pokemon_form_name",
        "form_name",
        "derived_form_identifier",
    ]
    is_default: bool
    form_order: int
    is_battle_only: bool
    is_mega: bool
    is_regional: bool
    regional_name: str | None
    sprite_key: str
    sprite_path: str | None
    collection_state: CollectionState


class PokemonSearchResultResponse(BaseModel):
    species_key: str
    national_dex_number: int
    alola_usum_dex_number: int | None
    display_name: str
    generation: int
    selected_form: PokemonFormResponse


class PokemonDetailResponse(BaseModel):
    species_key: str
    national_dex_number: int
    display_name: str
    generation: int
    dex_numbers: dict[str, int]
    selected_form: PokemonFormResponse
