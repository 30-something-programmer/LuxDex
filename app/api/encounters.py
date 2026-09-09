"""Minimal read-only proof endpoints for ingested Penumbra source data."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.encounter_models import (
    EncounterTableDetail,
    EncounterTableSummary,
    MapGroupPage,
    MapGroupResponse,
    PokemonOccurrencePage,
    SourceInfoResponse,
)
from app.repositories.encounters import EncountersRepository
from app.services.encounters import EncounterNotFoundError, EncountersService

router = APIRouter(prefix="/api/encounters", tags=["encounters"])


def get_encounters_service() -> EncountersService:
    return EncountersService(EncountersRepository())


ServiceDependency = Annotated[EncountersService, Depends(get_encounters_service)]


def _not_found(error: EncounterNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


@router.get("/source", response_model=SourceInfoResponse)
def source_info(service: ServiceDependency) -> SourceInfoResponse:
    try:
        return service.source_info()
    except EncounterNotFoundError as error:
        raise _not_found(error) from error


@router.get("/maps", response_model=MapGroupPage)
def list_maps(
    service: ServiceDependency,
    after: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> MapGroupPage:
    return service.list_map_groups(after, limit)


@router.get("/maps/{map_group_id}", response_model=MapGroupResponse)
def get_map(map_group_id: int, service: ServiceDependency) -> MapGroupResponse:
    try:
        return service.get_map_group(map_group_id)
    except EncounterNotFoundError as error:
        raise _not_found(error) from error


@router.get("/maps/{map_group_id}/tables", response_model=list[EncounterTableSummary])
def list_map_tables(map_group_id: int, service: ServiceDependency) -> list[EncounterTableSummary]:
    try:
        return service.list_tables(map_group_id)
    except EncounterNotFoundError as error:
        raise _not_found(error) from error


@router.get(
    "/maps/{map_group_id}/tables/{table_number}",
    response_model=EncounterTableDetail,
)
def get_map_table(
    map_group_id: int,
    table_number: int,
    service: ServiceDependency,
) -> EncounterTableDetail:
    try:
        return service.get_table(map_group_id, table_number)
    except EncounterNotFoundError as error:
        raise _not_found(error) from error


@router.get("/pokemon", response_model=PokemonOccurrencePage)
def search_pokemon(
    service: ServiceDependency,
    name: Annotated[str, Query(min_length=1)],
    after: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> PokemonOccurrencePage:
    try:
        return service.search_pokemon(name, after, limit)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
