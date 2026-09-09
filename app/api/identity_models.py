"""Typed development diagnostics for source identity mapping."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class MissingSpriteIdentityResponse(BaseModel):
    source_pokemon_name: str
    canonical_key: str


class PenumbraIdentitySummaryResponse(BaseModel):
    build_id: int
    resolver_version: str
    alias_filename: str
    alias_sha256: str
    penumbra_sha256: str
    pokemon_master_sha256: str
    total_raw_identities: int
    resolved: int
    exact: int
    normalised_exact: int
    explicit_alias: int
    explicit_form_alias: int
    unresolved: int
    unresolved_names: list[str]
    mapped_targets_without_local_sprite: list[MissingSpriteIdentityResponse]
    built_at: datetime
