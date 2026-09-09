"""Read-only encounter use cases above the PostgreSQL repository."""

from __future__ import annotations

from app.api.encounter_models import (
    EncounterTableDetail,
    EncounterTableSummary,
    MapGroupPage,
    MapGroupResponse,
    PokemonOccurrenceResponse,
    PokemonOccurrencePage,
    SourceInfoResponse,
)
from app.repositories.encounters import EncountersRepository


class EncounterNotFoundError(LookupError):
    pass


class EncountersService:
    def __init__(self, repository: EncountersRepository) -> None:
        self.repository = repository

    def source_info(self) -> SourceInfoResponse:
        source = self.repository.get_source()
        if source is None:
            raise EncounterNotFoundError("Penumbra source dataset is not loaded")
        return SourceInfoResponse.model_validate(source)

    def list_map_groups(self, after_id: int, limit: int) -> MapGroupPage:
        rows = self.repository.list_map_groups(after_id, limit + 1)
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        items = [MapGroupResponse.model_validate(row) for row in page_rows]
        return MapGroupPage(
            items=items,
            next_cursor=items[-1].id if has_more and items else None,
        )

    def get_map_group(self, map_group_id: int) -> MapGroupResponse:
        row = self.repository.get_map_group(map_group_id)
        if row is None:
            raise EncounterNotFoundError(f"Penumbra map group {map_group_id} was not found")
        return MapGroupResponse.model_validate(row)

    def list_tables(self, map_group_id: int) -> list[EncounterTableSummary]:
        if self.repository.get_map_group(map_group_id) is None:
            raise EncounterNotFoundError(f"Penumbra map group {map_group_id} was not found")
        return [
            EncounterTableSummary.model_validate(row)
            for row in self.repository.list_tables(map_group_id)
        ]

    def get_table(self, map_group_id: int, table_number: int) -> EncounterTableDetail:
        row = self.repository.get_table(map_group_id, table_number)
        if row is None:
            raise EncounterNotFoundError(
                f"Penumbra table {table_number} in map group {map_group_id} was not found"
            )
        return EncounterTableDetail.model_validate(row)

    def search_pokemon(
        self,
        name: str,
        after_id: int,
        limit: int,
    ) -> PokemonOccurrencePage:
        normalized_name = name.strip()
        if not normalized_name:
            raise ValueError("name must contain at least one non-whitespace character")
        rows = self.repository.search_pokemon(normalized_name, after_id, limit + 1)
        has_more = len(rows) > limit
        page_rows = rows[:limit]
        items = [PokemonOccurrenceResponse.model_validate(row) for row in page_rows]
        return PokemonOccurrencePage(
            items=items,
            next_cursor=items[-1].occurrence_id if has_more and items else None,
        )
