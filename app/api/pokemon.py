"""Minimal read-only proof API for canonical Pokémon species and forms."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.pokemon_models import (
    PokemonDetailResponse,
    PokemonFormResponse,
    PokemonSourceResponse,
    PokemonSpeciesPage,
    PokemonSearchResultResponse,
)
from app.repositories.pokemon import PokemonRepository
from app.services.pokemon import PokemonNotFoundError, PokemonService

router = APIRouter(prefix="/api/pokemon", tags=["pokemon"])


def get_pokemon_service() -> PokemonService:
    return PokemonService(PokemonRepository())


PokemonServiceDependency = Annotated[PokemonService, Depends(get_pokemon_service)]


def _not_found(error: PokemonNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


@router.get("/source", response_model=PokemonSourceResponse)
def source_info(service: PokemonServiceDependency) -> PokemonSourceResponse:
    try:
        return service.source_info()
    except PokemonNotFoundError as error:
        raise _not_found(error) from error


@router.get("", response_model=PokemonSpeciesPage)
def list_pokemon(
    service: PokemonServiceDependency,
    order: Literal["national", "alola", "name"] = "national",
    generation: Annotated[int | None, Query(ge=1, le=7)] = None,
    in_alola_dex: bool | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=1000)] = 50,
) -> PokemonSpeciesPage:
    try:
        return service.list_species(order, generation, in_alola_dex, q, offset, limit)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error


@router.get("/search", response_model=list[PokemonSearchResultResponse])
def search_pokemon_forms(
    service: PokemonServiceDependency,
    q: Annotated[str, Query(min_length=1, max_length=80)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> list[PokemonSearchResultResponse]:
    try:
        return service.search_forms(q, limit)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error


@router.get("/{key}", response_model=PokemonDetailResponse)
def get_pokemon(key: str, service: PokemonServiceDependency) -> PokemonDetailResponse:
    try:
        return service.get_pokemon(key)
    except PokemonNotFoundError as error:
        raise _not_found(error) from error


@router.get("/{key}/forms", response_model=list[PokemonFormResponse])
def list_forms(key: str, service: PokemonServiceDependency) -> list[PokemonFormResponse]:
    try:
        return service.list_forms(key)
    except PokemonNotFoundError as error:
        raise _not_found(error) from error
