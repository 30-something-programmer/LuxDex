"""Typed read-only models for canonical player-facing geography."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

GroupType = Literal["island", "other", "special"]
EncounterMethod = Literal[
    "grass",
    "surf",
    "fishing",
    "bubbling_fishing",
    "cave",
    "moving_shadow",
    "berry_pile",
    "special",
    "other",
]
MappingMethod = Literal[
    "explicit_documentation",
    "vanilla_pool_match",
    "explicit_method_match",
    "route_subarea_match",
    "manual_verified",
]


class AreaGroupResponse(BaseModel):
    group_key: str
    display_name: str
    display_order: int
    group_type: GroupType
    location_count: int
    encounter_place_count: int


class LocationResponse(BaseModel):
    location_key: str
    display_name: str
    location_type: str
    display_order: int
    description: str | None
    area_group_key: str
    area_group_name: str
    encounter_place_count: int


class EncounterPlaceResponse(BaseModel):
    place_key: str
    display_name: str
    subtitle: str | None
    encounter_method: EncounterMethod
    requirement: str | None
    display_order: int
    mapping_status: Literal["verified"]
    raw_table_count: int
    encounter_count: int


class LocationDetailResponse(LocationResponse):
    encounter_places: list[EncounterPlaceResponse]


class MappingEvidenceResponse(BaseModel):
    source_key: str
    source_title: str
    source_url: str
    source_type: Literal[
        "structured_dump",
        "location_reference",
        "walkthrough",
        "supporting_reference",
    ]
    accessed_on: str
    evidence_order: int
    source_locator: str
    evidence_note: str


class RawTableMappingResponse(BaseModel):
    raw_map_group_sequence: int
    raw_map_header: str
    source_table_number: int
    mapping_method: MappingMethod
    mapping_status: Literal["verified"]
    mapping_note: str
    encounter_count: int
    evidence: list[MappingEvidenceResponse]


class CanonicalEncounterIdentityResponse(BaseModel):
    canonical_key: str
    display_name: str
    species_key: str
    species_name: str
    national_dex_number: int
    alola_dex_number: int | None
    local_sprite_path: str | None


class PlaceEncounterResponse(BaseModel):
    raw_map_group_sequence: int
    source_table_number: int
    time_of_day: Literal["day", "night"]
    pool_type: Literal["normal", "sos", "additional_sos"]
    sos_slot: int | None
    min_level: int | None
    max_level: int | None
    encounter_order: int
    source_pokemon_name: str
    rate_percent: int | None
    canonical_pokemon: CanonicalEncounterIdentityResponse | None


class EncounterPlaceDetailResponse(EncounterPlaceResponse):
    location_key: str
    location_name: str
    area_group_key: str
    area_group_name: str
    raw_table_mappings: list[RawTableMappingResponse]
    encounters: list[PlaceEncounterResponse]
