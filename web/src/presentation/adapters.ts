import type {
  AreaGroupResponse,
  ExploreLocationResponse,
  ExplorePokemonResponse,
  LocationResponse,
  PokemonExploreResponse,
  PokemonSearchResultResponse,
  PokemonSpeciesSummaryResponse,
  TimeOfDay,
} from "../api/types"
import type {
  EncounterOccurrenceModel,
  EncounterZoneModel,
  IslandOption,
  LocationOption,
  PokedexEntryModel,
  PokemonCardModel,
  PokemonDetailModel,
  PokemonSearchResultModel,
} from "../types/presentation"
import { islandColor, islandShortLabel } from "./islandMaps"

export function toIslandOptions(groups: AreaGroupResponse[]): IslandOption[] {
  return groups.map((group) => ({
    id: group.group_key,
    name: group.display_name,
    shortLabel: islandShortLabel(
      group.group_key,
      group.group_type,
      group.display_name,
    ),
    fullName: group.display_name,
    color: islandColor(group.group_key),
    groupType: group.group_type,
  }))
}

export function toLocationOptions(
  locations: LocationResponse[],
): LocationOption[] {
  return locations.map((location) => ({
    id: location.location_key,
    name: location.display_name,
    hasEncounters: location.encounter_place_count > 0,
    secondaryLabel: location.location_type.replace(/_/g, " "),
  }))
}

function toCard(
  pokemon: ExplorePokemonResponse,
  identityPrefix: string,
  contextLabel?: string,
): PokemonCardModel {
  return {
    id: [
      identityPrefix,
      pokemon.canonical_key,
      pokemon.rate_percent ?? "unknown-rate",
      pokemon.min_level ?? "unknown-min",
      pokemon.max_level ?? "unknown-max",
      pokemon.sos_slots.join("-"),
    ].join(":"),
    canonicalKey: pokemon.canonical_key,
    name: pokemon.display_name,
    formLabel:
      pokemon.is_regional && pokemon.regional_name
        ? pokemon.regional_name
        : pokemon.display_name,
    status: pokemon.collection_state,
    spritePath: pokemon.sprite_path,
    rate: pokemon.rate_percent,
    minLevel: pokemon.min_level,
    maxLevel: pokemon.max_level,
    sosSlots: pokemon.sos_slots,
    contextLabel,
  }
}

export function toEncounterZones(
  location: ExploreLocationResponse | null,
  timeOfDay: TimeOfDay,
): EncounterZoneModel[] {
  if (!location) return []
  return location.places.map((place) => {
    const pool = place.pools.find(
      (candidate) => candidate.time_of_day === timeOfDay,
    )
    const normal = pool?.normal ?? []
    const sos = pool?.sos ?? []
    const additional = pool?.additional_sos ?? []
    const all = [...normal, ...sos, ...additional]
    const minimums = all.flatMap((pokemon) =>
      pokemon.min_level == null ? [] : [pokemon.min_level],
    )
    const maximums = all.flatMap((pokemon) =>
      pokemon.max_level == null ? [] : [pokemon.max_level],
    )
    return {
      id: place.place_key,
      label: place.display_name,
      minLevel: minimums.length ? Math.min(...minimums) : undefined,
      maxLevel: maximums.length ? Math.max(...maximums) : undefined,
      encounters: normal.map((pokemon) =>
        toCard(pokemon, `${place.place_key}:${timeOfDay}:normal`),
      ),
      sosEncounters: sos.map((pokemon) =>
        toCard(pokemon, `${place.place_key}:${timeOfDay}:sos`),
      ),
      additionalSosEncounters: additional.map((pokemon) =>
        toCard(
          pokemon,
          `${place.place_key}:${timeOfDay}:additional-sos`,
          "Additional SOS",
        ),
      ),
    }
  })
}

export function toSearchResults(
  results: PokemonSearchResultResponse[],
): PokemonSearchResultModel[] {
  return results.map((result) => ({
    pokemon: {
      id: result.selected_form.form_key,
      canonicalKey: result.selected_form.form_key,
      name: result.selected_form.display_name,
      formLabel: result.selected_form.display_name,
      status: result.selected_form.collection_state,
      spritePath: result.selected_form.sprite_path,
    },
    nationalDexNumber: result.national_dex_number,
    alolaDexNumber: result.alola_usum_dex_number ?? undefined,
    generation: result.generation,
  }))
}

export function toPokedexEntries(
  entries: PokemonSpeciesSummaryResponse[],
): PokedexEntryModel[] {
  return entries.map((entry) => ({
    id: entry.default_form_key,
    canonicalKey: entry.default_form_key,
    name: entry.display_name,
    status: entry.collection_state,
    spritePath: entry.default_sprite_path,
    nationalDexNumber: entry.national_dex_number,
    alolaDexNumber: entry.alola_usum_dex_number ?? undefined,
    generation: entry.generation,
  }))
}

export function toPokemonDetail(
  pokemon: PokemonExploreResponse,
): PokemonDetailModel {
  const occurrences: EncounterOccurrenceModel[] = pokemon.encounters.map(
    (occurrence, index) => ({
      id: [
        occurrence.area_group_key,
        occurrence.location_key,
        occurrence.place_key,
        occurrence.time_of_day,
        occurrence.pool_type,
        occurrence.rate_percent ?? "unknown-rate",
        occurrence.min_level ?? "unknown-min",
        occurrence.max_level ?? "unknown-max",
        index,
      ].join(":"),
      areaGroupKey: occurrence.area_group_key,
      areaGroupName: occurrence.area_group_name,
      locationId: occurrence.location_key,
      locationName: occurrence.location_name,
      zoneLabel: occurrence.place_name,
      timeOfDay: occurrence.time_of_day,
      minLevel: occurrence.min_level,
      maxLevel: occurrence.max_level,
      rate: occurrence.rate_percent,
      isSos: occurrence.pool_type !== "normal",
      sosSlots: occurrence.sos_slots,
    }),
  )

  return {
    id: pokemon.selected_form.form_key,
    canonicalKey: pokemon.selected_form.form_key,
    name: pokemon.selected_form.display_name,
    speciesName: pokemon.display_name,
    formName: pokemon.selected_form.display_name,
    formLabel: pokemon.selected_form.display_name,
    isRegional: pokemon.selected_form.is_regional,
    regionalName: pokemon.selected_form.regional_name,
    status: pokemon.selected_form.collection_state,
    spritePath: pokemon.selected_form.sprite_path,
    nationalDexNumber: pokemon.national_dex_number,
    alolaDexNumber: pokemon.alola_usum_dex_number ?? undefined,
    generation: pokemon.generation,
    forms: pokemon.forms.map((form) => ({
      key: form.form_key,
      name: form.display_name,
      status: form.collection_state,
    })),
    occurrences,
  }
}
