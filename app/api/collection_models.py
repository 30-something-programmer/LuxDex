"""API contracts for persistent, form-scoped collection state."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

CollectionState = Literal["unseen", "seen", "owned"]


class CollectionStateUpdate(BaseModel):
    state: CollectionState


class CollectionBulkUpdate(BaseModel):
    canonical_keys: list[str]
    state: CollectionState
    preserve_owned: bool = False


class CollectionStateResponse(BaseModel):
    canonical_key: str
    display_name: str
    state: CollectionState
    first_seen_at: datetime | None
    first_owned_at: datetime | None
    updated_at: datetime | None


class CollectionCountResponse(BaseModel):
    total: int
    unseen: int
    seen: int
    owned: int


class CollectionSummaryResponse(BaseModel):
    profile_key: str
    form_counts: CollectionCountResponse
    national_species_counts: CollectionCountResponse
    alola_species_counts: CollectionCountResponse
