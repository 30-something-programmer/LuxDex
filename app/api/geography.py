"""Read-only proof API for backend-owned player-facing geography."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.geography_models import (
    AreaGroupResponse,
    EncounterPlaceDetailResponse,
    EncounterPlaceResponse,
    LocationDetailResponse,
    LocationResponse,
)
from app.repositories.geography import GeographyRepository
from app.services.geography import GeographyNotFoundError, GeographyService

router = APIRouter(prefix="/api/geography", tags=["geography"])


def get_geography_service() -> GeographyService:
    return GeographyService(GeographyRepository())


ServiceDependency = Annotated[GeographyService, Depends(get_geography_service)]


def _not_found(error: GeographyNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


@router.get("/groups", response_model=list[AreaGroupResponse])
def list_groups(service: ServiceDependency) -> list[AreaGroupResponse]:
    return service.list_groups()


@router.get("/groups/{group_key}/locations", response_model=list[LocationResponse])
def list_group_locations(group_key: str, service: ServiceDependency) -> list[LocationResponse]:
    try:
        return service.list_locations(group_key)
    except GeographyNotFoundError as error:
        raise _not_found(error) from error


@router.get("/locations/{location_key}", response_model=LocationDetailResponse)
def get_location(location_key: str, service: ServiceDependency) -> LocationDetailResponse:
    try:
        return service.get_location(location_key)
    except GeographyNotFoundError as error:
        raise _not_found(error) from error


@router.get(
    "/locations/{location_key}/encounter-places",
    response_model=list[EncounterPlaceResponse],
)
def list_location_places(
    location_key: str, service: ServiceDependency
) -> list[EncounterPlaceResponse]:
    try:
        return service.list_places(location_key)
    except GeographyNotFoundError as error:
        raise _not_found(error) from error


@router.get(
    "/encounter-places/{place_key}",
    response_model=EncounterPlaceDetailResponse,
)
def get_encounter_place(
    place_key: str, service: ServiceDependency
) -> EncounterPlaceDetailResponse:
    try:
        return service.get_place(place_key)
    except GeographyNotFoundError as error:
        raise _not_found(error) from error
