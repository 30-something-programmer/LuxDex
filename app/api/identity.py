"""Minimal development diagnostic endpoint for source identity mapping."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.identity_models import PenumbraIdentitySummaryResponse
from app.repositories.identity import IdentityRepository
from app.services.identity import IdentityMapNotFoundError, IdentityService

router = APIRouter(prefix="/api/identity", tags=["identity"])


def get_identity_service() -> IdentityService:
    return IdentityService(IdentityRepository())


ServiceDependency = Annotated[IdentityService, Depends(get_identity_service)]


@router.get("/penumbra", response_model=PenumbraIdentitySummaryResponse)
def penumbra_identity_summary(service: ServiceDependency) -> PenumbraIdentitySummaryResponse:
    try:
        return service.penumbra_summary()
    except IdentityMapNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
