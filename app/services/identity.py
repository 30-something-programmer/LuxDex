"""Identity-map diagnostic use cases."""

from __future__ import annotations

from app.api.identity_models import PenumbraIdentitySummaryResponse
from app.repositories.identity import IdentityRepository


class IdentityMapNotFoundError(LookupError):
    pass


class IdentityService:
    def __init__(self, repository: IdentityRepository) -> None:
        self.repository = repository

    def penumbra_summary(self) -> PenumbraIdentitySummaryResponse:
        row = self.repository.get_penumbra_summary()
        if row is None:
            raise IdentityMapNotFoundError("Penumbra Pokémon identity map is not built")
        return PenumbraIdentitySummaryResponse.model_validate(row)
