"""Collection-state use cases and summary semantics."""

from __future__ import annotations

from app.api.collection_models import (
    CollectionCountResponse,
    CollectionState,
    CollectionStateResponse,
    CollectionSummaryResponse,
)
from app.repositories.collection import CollectionRepository


class CollectionNotFoundError(LookupError):
    pass


class CollectionService:
    def __init__(self, repository: CollectionRepository) -> None:
        self.repository = repository

    def list_states(self) -> list[CollectionStateResponse]:
        return [CollectionStateResponse.model_validate(row) for row in self.repository.list_states()]

    def get_state(self, canonical_key: str) -> CollectionStateResponse:
        return self._require(self.repository.get_state(canonical_key), canonical_key)

    def advance(self, canonical_key: str) -> CollectionStateResponse:
        return self._require(self.repository.advance(canonical_key), canonical_key)

    def set_state(
        self, canonical_key: str, target_state: CollectionState
    ) -> CollectionStateResponse:
        return self._require(self.repository.set_state(canonical_key, target_state), canonical_key)

    def summary(self) -> CollectionSummaryResponse:
        row = self.repository.summary()
        return CollectionSummaryResponse(
            profile_key="local",
            form_counts=CollectionCountResponse(
                total=row["form_total"], unseen=row["form_unseen"],
                seen=row["form_seen"], owned=row["form_owned"],
            ),
            national_species_counts=CollectionCountResponse(
                total=row["national_total"],
                unseen=row["national_total"] - row["national_seen"] - row["national_owned"],
                seen=row["national_seen"], owned=row["national_owned"],
            ),
            alola_species_counts=CollectionCountResponse(
                total=row["alola_total"],
                unseen=row["alola_total"] - row["alola_seen"] - row["alola_owned"],
                seen=row["alola_seen"], owned=row["alola_owned"],
            ),
        )

    @staticmethod
    def _require(row: object | None, canonical_key: str) -> CollectionStateResponse:
        if row is None:
            raise CollectionNotFoundError(f"Pokémon/form key {canonical_key!r} was not found")
        return CollectionStateResponse.model_validate(row)

