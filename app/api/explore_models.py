"""Frontend-oriented, read-only response models for LuxDex exploration."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.api.pokemon_models import PokemonFormResponse


class ExplorePokemonResponse(BaseModel):
    canonical_key: str
    display_name: str
    species_key: str
    species_name: str
    national_dex_number: int
    alola_usum_dex_number: int | None
    generation: int
    is_regional: bool
    regional_name: str | None
    sprite_path: str | None
    rate_percent: int | None
    min_level: int | None
    max_level: int | None
    sos_slots: list[int]
    source_table_count: int


class ExploreTimePoolResponse(BaseModel):
    time_of_day: Literal["day", "night"]
    normal: list[ExplorePokemonResponse]
    sos: list[ExplorePokemonResponse]
    additional_sos: list[ExplorePokemonResponse]


class ExplorePlaceResponse(BaseModel):
    place_key: str
    display_name: str
    subtitle: str | None
    encounter_method: str
    requirement: str | None
    display_order: int
    mapping_status: Literal["verified"]
    pools: list[ExploreTimePoolResponse]


class ExploreLocationResponse(BaseModel):
    group_key: str
    group_display_name: str
    group_type: Literal["island", "other", "special"]
    location_key: str
    location_display_name: str
    location_type: str
    description: str | None
    places: list[ExplorePlaceResponse]


class PokemonEncounterOccurrenceResponse(BaseModel):
    area_group_key: str
    area_group_name: str
    location_key: str
    location_name: str
    place_key: str
    place_name: str
    encounter_method: str
    time_of_day: Literal["day", "night"]
    pool_type: Literal["normal", "sos", "additional_sos"]
    rate_percent: int | None
    min_level: int | None
    max_level: int | None
    sos_slots: list[int]
    source_table_count: int


class PokemonExploreResponse(BaseModel):
    species_key: str
    national_dex_number: int
    display_name: str
    generation: int
    alola_usum_dex_number: int | None
    selected_form: PokemonFormResponse
    forms: list[PokemonFormResponse]
    encounters: list[PokemonEncounterOccurrenceResponse]

