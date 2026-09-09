"""Efficient read-model endpoints for the LuxDex frontend."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.explore_models import ExploreLocationResponse, PokemonExploreResponse
from app.repositories.explore import ExploreRepository
from app.repositories.pokemon import PokemonRepository
from app.services.explore import ExploreNotFoundError, ExploreService
from app.services.pokemon import PokemonService

router = APIRouter(prefix="/api/explore", tags=["explore"])


def get_explore_service() -> ExploreService:
    return ExploreService(
        ExploreRepository(),
        PokemonService(PokemonRepository()),
    )


ServiceDependency = Annotated[ExploreService, Depends(get_explore_service)]


def _not_found(error: ExploreNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


@router.get("/areas/{group_key}/{location_key}", response_model=ExploreLocationResponse)
def get_location(
    group_key: str,
    location_key: str,
    service: ServiceDependency,
) -> ExploreLocationResponse:
    try:
        return service.get_location(group_key, location_key)
    except ExploreNotFoundError as error:
        raise _not_found(error) from error


@router.get("/pokemon/{canonical_key}", response_model=PokemonExploreResponse)
def get_pokemon(canonical_key: str, service: ServiceDependency) -> PokemonExploreResponse:
    try:
        return service.get_pokemon(canonical_key)
    except ExploreNotFoundError as error:
        raise _not_found(error) from error

