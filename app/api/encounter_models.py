"""Typed public response models for the Pass 2 proof API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SourceInfoResponse(BaseModel):
    source_name: str
    source_filename: str
    sha256: str
    byte_count: int
    line_count: int
    nonblank_line_count: int
    parser_version: str
    imported_at: datetime


class RawMapLocationResponse(BaseModel):
    source_order: int
    raw_map_number: int
    source_location_name: str
    raw_reference: str


class MapGroupResponse(BaseModel):
    id: int
    source_sequence: int
    raw_header: str
    declared_table_count: int
    source_line_start: int
    source_line_end: int
    locations: list[RawMapLocationResponse]


class MapGroupPage(BaseModel):
    items: list[MapGroupResponse]
    next_cursor: int | None


class EncounterTableSummary(BaseModel):
    source_table_number: int
    source_order: int
    source_line_start: int
    source_line_end: int


class EncounterResponse(BaseModel):
    source_order: int
    source_pokemon_name: str
    rate_percent: int | None
    source_line_number: int


class EncounterPoolResponse(BaseModel):
    time_of_day: Literal["day", "night"]
    pool_type: Literal["normal", "sos", "additional_sos"]
    sos_slot: int | None
    source_order: int
    min_level: int | None
    max_level: int | None
    source_line_number: int
    source_entry_count: int
    empty_entry_count: int
    rate_total_percent: int | None
    empty_rate_total_percent: int | None
    encounters: list[EncounterResponse]


class EncounterTableDetail(EncounterTableSummary):
    pools: list[EncounterPoolResponse]


class PokemonOccurrenceResponse(BaseModel):
    occurrence_id: int
    source_pokemon_name: str
    rate_percent: int | None
    source_order: int
    source_line_number: int
    time_of_day: Literal["day", "night"]
    pool_type: Literal["normal", "sos", "additional_sos"]
    sos_slot: int | None
    min_level: int | None
    max_level: int | None
    source_table_number: int
    map_group_id: int
    map_group_source_sequence: int
    raw_header: str
    locations: list[RawMapLocationResponse]


class PokemonOccurrencePage(BaseModel):
    items: list[PokemonOccurrenceResponse]
    next_cursor: int | None
