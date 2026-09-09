"""Read-only Pokémon master use cases above the PostgreSQL repository."""

from __future__ import annotations

from app.api.pokemon_models import (
    PokemonDetailResponse,
    PokemonFormResponse,
    PokemonSourceResponse,
    PokemonSpeciesPage,
    PokemonSpeciesSummary,
    PokemonSearchResultResponse,
)
from app.repositories.pokemon import PokemonOrder, PokemonRepository


class PokemonNotFoundError(LookupError):
    pass


class PokemonService:
    def __init__(self, repository: PokemonRepository) -> None:
        self.repository = repository

    def source_info(self) -> PokemonSourceResponse:
        row = self.repository.get_source()
        if row is None:
            raise PokemonNotFoundError("Pokémon master dataset is not loaded")
        return PokemonSourceResponse.model_validate(row)

    def list_species(
        self,
        order: PokemonOrder,
        generation: int | None,
        in_alola_dex: bool | None,
        search: str | None,
        offset: int,
        limit: int,
    ) -> PokemonSpeciesPage:
        if order == "alola" and in_alola_dex is False:
            raise ValueError("order=alola cannot be combined with in_alola_dex=false")
        rows = self.repository.list_species(
            order,
            generation,
            in_alola_dex,
            search,
            offset,
            limit + 1,
        )
        has_more = len(rows) > limit
        items = [PokemonSpeciesSummary.model_validate(row) for row in rows[:limit]]
        return PokemonSpeciesPage(
            items=items,
            offset=offset,
            next_offset=offset + limit if has_more else None,
        )

    def search_forms(self, query: str, limit: int) -> list[PokemonSearchResultResponse]:
        normalized_query = query.strip()
        if not normalized_query:
            raise ValueError("q must contain a Pokémon name")
        rows = self.repository.search_forms(normalized_query, limit)
        return [
            PokemonSearchResultResponse(
                species_key=row["species_key"],
                national_dex_number=row["national_dex_number"],
                alola_usum_dex_number=row["alola_usum_dex_number"],
                display_name=row["display_name"],
                generation=row["generation"],
                selected_form=PokemonFormResponse(
                    form_key=row["form_key"],
                    identifier=row["identifier"],
                    display_name=row["form_display_name"],
                    display_name_source=row["display_name_source"],
                    is_default=row["is_default"],
                    form_order=row["form_order"],
                    is_battle_only=row["is_battle_only"],
                    is_mega=row["is_mega"],
                    is_regional=row["is_regional"],
                    regional_name=row["regional_name"],
                    sprite_key=row["sprite_key"],
                    sprite_path=row["sprite_path"],
                ),
            )
            for row in rows
        ]

    def get_pokemon(self, key: str) -> PokemonDetailResponse:
        row = self.repository.get_species_for_key(key)
        if row is None:
            raise PokemonNotFoundError(f"Pokémon/form key {key!r} was not found")
        selected_form = PokemonFormResponse(
            form_key=row["selected_form_key"],
            identifier=row["selected_form_identifier"],
            display_name=row["selected_form_display_name"],
            display_name_source=row["selected_form_display_name_source"],
            is_default=row["selected_form_is_default"],
            form_order=row["selected_form_order"],
            is_battle_only=row["selected_form_is_battle_only"],
            is_mega=row["selected_form_is_mega"],
            is_regional=row["selected_form_is_regional"],
            regional_name=row["selected_form_regional_name"],
            sprite_key=row["selected_form_sprite_key"],
            sprite_path=row["selected_form_sprite_path"],
        )
        return PokemonDetailResponse(
            species_key=row["species_key"],
            national_dex_number=row["national_dex_number"],
            display_name=row["display_name"],
            generation=row["generation"],
            dex_numbers=row["dex_numbers"],
            selected_form=selected_form,
        )

    def list_forms(self, key: str) -> list[PokemonFormResponse]:
        rows = self.repository.list_forms_for_key(key)
        if rows is None:
            raise PokemonNotFoundError(f"Pokémon/form key {key!r} was not found")
        return [PokemonFormResponse.model_validate(row) for row in rows]
