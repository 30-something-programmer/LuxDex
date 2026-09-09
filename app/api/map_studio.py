from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.map_studio_models import GeometryUpdate, PlacementUpdate, StudioDocument
from app.repositories.map_studio import MapStudioRepository
from app.services.map_studio import MapStudioService

router = APIRouter(prefix="/api/map-studio", tags=["internal-map-studio"])


def repository() -> MapStudioRepository:
    return MapStudioRepository()


Repo = Annotated[MapStudioRepository, Depends(repository)]


@router.get("", response_model=StudioDocument)
def document(repo: Repo) -> StudioDocument:
    return MapStudioService(repo).document()


@router.put("/nodes/{node_key}", status_code=204)
def save_geometry(node_key: str, update: GeometryUpdate, repo: Repo) -> None:
    if not repo.save_geometry(node_key, [point.model_dump() for point in update.points]):
        raise HTTPException(404, "Map presentation node was not found")


@router.delete("/nodes/{node_key}", status_code=204)
def delete_geometry(node_key: str, repo: Repo) -> None:
    if not repo.delete_geometry(node_key):
        raise HTTPException(404, "Editable map presentation node was not found")


@router.put("/nodes/{node_key}/placements", status_code=204)
def save_placement(node_key: str, update: PlacementUpdate, repo: Repo) -> None:
    if not repo.save_placement(node_key, update.canonical_key, update.x, update.y, update.scale):
        raise HTTPException(400, "Sprite is not a canonical encounter in this zone")
