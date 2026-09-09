"""Persistent collection-state endpoints for the active local profile."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.collection_models import (
    CollectionStateResponse,
    CollectionStateUpdate,
    CollectionSummaryResponse,
)
from app.repositories.collection import CollectionRepository
from app.services.collection import CollectionNotFoundError, CollectionService

router = APIRouter(prefix="/api/collection", tags=["collection"])


def get_collection_service() -> CollectionService:
    return CollectionService(CollectionRepository())


ServiceDependency = Annotated[CollectionService, Depends(get_collection_service)]


def _not_found(error: CollectionNotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


@router.get("", response_model=list[CollectionStateResponse])
def list_collection(service: ServiceDependency) -> list[CollectionStateResponse]:
    return service.list_states()


@router.get("/summary", response_model=CollectionSummaryResponse)
def collection_summary(service: ServiceDependency) -> CollectionSummaryResponse:
    return service.summary()


@router.get("/{canonical_key}", response_model=CollectionStateResponse)
def get_collection_state(
    canonical_key: str, service: ServiceDependency
) -> CollectionStateResponse:
    try:
        return service.get_state(canonical_key)
    except CollectionNotFoundError as error:
        raise _not_found(error) from error


@router.post("/{canonical_key}/advance", response_model=CollectionStateResponse)
def advance_collection_state(
    canonical_key: str, service: ServiceDependency
) -> CollectionStateResponse:
    try:
        return service.advance(canonical_key)
    except CollectionNotFoundError as error:
        raise _not_found(error) from error


@router.put("/{canonical_key}", response_model=CollectionStateResponse)
def set_collection_state(
    canonical_key: str,
    update: CollectionStateUpdate,
    service: ServiceDependency,
) -> CollectionStateResponse:
    try:
        return service.set_state(canonical_key, update.state)
    except CollectionNotFoundError as error:
        raise _not_found(error) from error

