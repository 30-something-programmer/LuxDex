"""Application-level read models consumed by the LuxDex frontend."""

from __future__ import annotations

from collections import OrderedDict
from typing import Any

from app.api.explore_models import (
    ExploreLocationResponse,
    ExplorePlaceResponse,
    ExplorePokemonResponse,
    ExploreTimePoolResponse,
    PokemonEncounterOccurrenceResponse,
    PokemonExploreResponse,
)
from app.repositories.explore import ExploreRepository
from app.services.pokemon import PokemonNotFoundError, PokemonService


class ExploreNotFoundError(LookupError):
    pass


def _encounter_group_key(row: dict[str, Any]) -> tuple[Any, ...]:
    return (
        row["canonical_key"],
        row["rate_percent"],
        row["min_level"],
        row["max_level"],
    )


class ExploreService:
    def __init__(
        self,
        repository: ExploreRepository,
        pokemon_service: PokemonService,
    ) -> None:
        self.repository = repository
        self.pokemon_service = pokemon_service

    def get_location(self, group_key: str, location_key: str) -> ExploreLocationResponse:
        location, place_rows, encounter_rows = self.repository.get_location_bundle(
            group_key, location_key
        )
        if location is None:
            raise ExploreNotFoundError(
                f"Location {location_key!r} was not found in area group {group_key!r}"
            )

        rows_by_place: dict[str, list[dict[str, Any]]] = {}
        for row in encounter_rows:
            rows_by_place.setdefault(row["place_key"], []).append(row)

        places: list[ExplorePlaceResponse] = []
        for place_row in place_rows:
            pools: list[ExploreTimePoolResponse] = []
            place_encounters = rows_by_place.get(place_row["place_key"], [])
            for time_of_day in ("day", "night"):
                pool_values: dict[str, list[ExplorePokemonResponse]] = {}
                for pool_type in ("normal", "sos", "additional_sos"):
                    grouped: OrderedDict[tuple[Any, ...], dict[str, Any]] = OrderedDict()
                    for row in place_encounters:
                        if row["time_of_day"] != time_of_day or row["pool_type"] != pool_type:
                            continue
                        key = _encounter_group_key(row)
                        item = grouped.setdefault(
                            key,
                            {
                                **row,
                                "sos_slots": set(),
                                "source_tables": set(),
                            },
                        )
                        if row["sos_slot"] is not None:
                            item["sos_slots"].add(row["sos_slot"])
                        item["source_tables"].add(
                            (row["raw_map_group_sequence"], row["source_table_number"])
                        )

                    pool_values[pool_type] = [
                        ExplorePokemonResponse(
                            canonical_key=item["canonical_key"],
                            display_name=item["display_name"],
                            species_key=item["species_key"],
                            species_name=item["species_name"],
                            national_dex_number=item["national_dex_number"],
                            alola_usum_dex_number=item["alola_usum_dex_number"],
                            generation=item["generation"],
                            is_regional=item["is_regional"],
                            regional_name=item["regional_name"],
                            sprite_path=item["sprite_path"],
                            rate_percent=item["rate_percent"],
                            min_level=item["min_level"],
                            max_level=item["max_level"],
                            sos_slots=sorted(item["sos_slots"]),
                            source_table_count=len(item["source_tables"]),
                            collection_state=item["collection_state"],
                        )
                        for item in grouped.values()
                    ]
                pools.append(
                    ExploreTimePoolResponse(
                        time_of_day=time_of_day,
                        normal=pool_values["normal"],
                        sos=pool_values["sos"],
                        additional_sos=pool_values["additional_sos"],
                    )
                )

            places.append(ExplorePlaceResponse(**place_row, pools=pools))

        return ExploreLocationResponse(**location, places=places)

    def get_pokemon(self, canonical_key: str) -> PokemonExploreResponse:
        try:
            pokemon = self.pokemon_service.get_pokemon(canonical_key)
            forms = self.pokemon_service.list_forms(canonical_key)
        except PokemonNotFoundError as error:
            raise ExploreNotFoundError(str(error)) from error

        rows = self.repository.list_form_occurrences(canonical_key)
        grouped: OrderedDict[tuple[Any, ...], dict[str, Any]] = OrderedDict()
        for row in rows:
            key = (
                row["area_group_key"],
                row["location_key"],
                row["place_key"],
                row["time_of_day"],
                row["pool_type"],
                row["rate_percent"],
                row["min_level"],
                row["max_level"],
            )
            item = grouped.setdefault(
                key,
                {**row, "sos_slots": set(), "source_tables": set()},
            )
            if row["sos_slot"] is not None:
                item["sos_slots"].add(row["sos_slot"])
            item["source_tables"].add(
                (row["raw_map_group_sequence"], row["source_table_number"])
            )

        occurrences = [
            PokemonEncounterOccurrenceResponse(
                area_group_key=item["area_group_key"],
                area_group_name=item["area_group_name"],
                location_key=item["location_key"],
                location_name=item["location_name"],
                place_key=item["place_key"],
                place_name=item["place_name"],
                encounter_method=item["encounter_method"],
                time_of_day=item["time_of_day"],
                pool_type=item["pool_type"],
                rate_percent=item["rate_percent"],
                min_level=item["min_level"],
                max_level=item["max_level"],
                sos_slots=sorted(item["sos_slots"]),
                source_table_count=len(item["source_tables"]),
            )
            for item in grouped.values()
        ]

        return PokemonExploreResponse(
            species_key=pokemon.species_key,
            national_dex_number=pokemon.national_dex_number,
            display_name=pokemon.display_name,
            generation=pokemon.generation,
            alola_usum_dex_number=pokemon.dex_numbers.get("alola-usum"),
            selected_form=pokemon.selected_form,
            forms=forms,
            encounters=occurrences,
        )
