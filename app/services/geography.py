"""Canonical geography use cases above the read-only repository."""

from __future__ import annotations

from app.api.geography_models import (
    AreaGroupResponse,
    EncounterPlaceDetailResponse,
    EncounterPlaceResponse,
    LocationDetailResponse,
    LocationResponse,
)
from app.repositories.geography import GeographyRepository


class GeographyNotFoundError(LookupError):
    pass


class GeographyService:
    def __init__(self, repository: GeographyRepository) -> None:
        self.repository = repository

    def list_groups(self) -> list[AreaGroupResponse]:
        return [AreaGroupResponse.model_validate(row) for row in self.repository.list_groups()]

    def list_locations(self, group_key: str) -> list[LocationResponse]:
        rows = self.repository.list_locations(group_key)
        if rows is None:
            raise GeographyNotFoundError(f"geography group {group_key!r} was not found")
        return [LocationResponse.model_validate(row) for row in rows]

    def get_location(self, location_key: str) -> LocationDetailResponse:
        row = self.repository.get_location(location_key)
        if row is None:
            raise GeographyNotFoundError(f"geography location {location_key!r} was not found")
        places = self.repository.list_places(location_key)
        if places is None:
            raise GeographyNotFoundError(f"geography location {location_key!r} was not found")
        return LocationDetailResponse.model_validate(
            {**row, "encounter_places": places}
        )

    def list_places(self, location_key: str) -> list[EncounterPlaceResponse]:
        rows = self.repository.list_places(location_key)
        if rows is None:
            raise GeographyNotFoundError(f"geography location {location_key!r} was not found")
        return [EncounterPlaceResponse.model_validate(row) for row in rows]

    def get_place(self, place_key: str) -> EncounterPlaceDetailResponse:
        row = self.repository.get_place(place_key)
        if row is None:
            raise GeographyNotFoundError(f"encounter place {place_key!r} was not found")
        return EncounterPlaceDetailResponse.model_validate(row)
