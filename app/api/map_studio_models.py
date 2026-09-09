from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Point(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class GeometryUpdate(BaseModel):
    points: list[Point] = Field(min_length=3)


class PlacementUpdate(BaseModel):
    canonical_key: str
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    scale: float = Field(default=1, ge=0.25, le=3)


class StudioNode(BaseModel):
    node_key: str
    parent_key: str | None
    layer: int
    node_type: Literal["world", "island", "location", "zone"]
    canonical_key: str | None
    display_name: str
    asset_path: str | None
    geometry: list[list[float]] | None


class StudioPokemon(BaseModel):
    zone_node_key: str
    canonical_key: str
    display_name: str
    sprite_path: str | None
    collection_state: Literal["unseen", "seen", "owned"]


class StudioPlacement(BaseModel):
    zone_node_key: str
    canonical_key: str
    x: float
    y: float
    scale: float


class StudioDocument(BaseModel):
    nodes: list[StudioNode]
    pokemon: list[StudioPokemon]
    placements: list[StudioPlacement]
