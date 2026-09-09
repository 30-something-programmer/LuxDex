export interface HealthResponse {
  status: "ok" | "degraded"
  service: "luxdex-app"
  version: string
  database: "ok" | "not_configured" | "unavailable"
}

export type TimeOfDay = "day" | "night"
export type EncounterPoolType = "normal" | "sos" | "additional_sos"
export type CollectionState = "unseen" | "seen" | "owned"

export interface AreaGroupResponse {
  group_key: string
  display_name: string
  display_order: number
  group_type: "island" | "other" | "special"
  location_count: number
  encounter_place_count: number
}

export interface LocationResponse {
  location_key: string
  display_name: string
  location_type: string
  display_order: number
  description: string | null
  area_group_key: string
  area_group_name: string
  encounter_place_count: number
}

export interface PokemonFormResponse {
  form_key: string
  identifier: string
  display_name: string
  display_name_source: "species_name" | "pokemon_form_name" | "form_name" | "derived_form_identifier"
  is_default: boolean
  form_order: number
  is_battle_only: boolean
  is_mega: boolean
  is_regional: boolean
  regional_name: string | null
  sprite_key: string
  sprite_path: string | null
  collection_state: CollectionState
}

export interface PokemonSpeciesSummaryResponse {
  species_key: string
  national_dex_number: number
  alola_usum_dex_number: number | null
  display_name: string
  generation: number
  default_form_key: string
  default_sprite_key: string
  default_sprite_path: string | null
  collection_state: CollectionState
}

export interface PokemonSpeciesPageResponse {
  items: PokemonSpeciesSummaryResponse[]
  offset: number
  next_offset: number | null
}

export interface PokemonSearchResultResponse {
  species_key: string
  national_dex_number: number
  alola_usum_dex_number: number | null
  display_name: string
  generation: number
  selected_form: PokemonFormResponse
}

export interface ExplorePokemonResponse {
  canonical_key: string
  display_name: string
  species_key: string
  species_name: string
  national_dex_number: number
  alola_usum_dex_number: number | null
  generation: number
  is_regional: boolean
  regional_name: string | null
  sprite_path: string | null
  rate_percent: number | null
  min_level: number | null
  max_level: number | null
  sos_slots: number[]
  source_table_count: number
  collection_state: CollectionState
}

export interface ExploreTimePoolResponse {
  time_of_day: TimeOfDay
  normal: ExplorePokemonResponse[]
  sos: ExplorePokemonResponse[]
  additional_sos: ExplorePokemonResponse[]
}

export interface ExplorePlaceResponse {
  place_key: string
  display_name: string
  subtitle: string | null
  encounter_method: string
  requirement: string | null
  display_order: number
  mapping_status: "verified"
  pools: ExploreTimePoolResponse[]
}

export interface ExploreLocationResponse {
  group_key: string
  group_display_name: string
  group_type: "island" | "other" | "special"
  location_key: string
  location_display_name: string
  location_type: string
  description: string | null
  places: ExplorePlaceResponse[]
}

export interface PokemonEncounterOccurrenceResponse {
  area_group_key: string
  area_group_name: string
  location_key: string
  location_name: string
  place_key: string
  place_name: string
  encounter_method: string
  time_of_day: TimeOfDay
  pool_type: EncounterPoolType
  rate_percent: number | null
  min_level: number | null
  max_level: number | null
  sos_slots: number[]
  source_table_count: number
}

export interface PokemonExploreResponse {
  species_key: string
  national_dex_number: number
  display_name: string
  generation: number
  alola_usum_dex_number: number | null
  selected_form: PokemonFormResponse
  forms: PokemonFormResponse[]
  encounters: PokemonEncounterOccurrenceResponse[]
}

export interface CollectionStateResponse {
  canonical_key: string
  display_name: string
  state: CollectionState
  first_seen_at: string | null
  first_owned_at: string | null
  updated_at: string | null
}

export interface CollectionCountResponse {
  total: number
  unseen: number
  seen: number
  owned: number
}

export interface CollectionSummaryResponse {
  profile_key: string
  form_counts: CollectionCountResponse
  national_species_counts: CollectionCountResponse
  alola_species_counts: CollectionCountResponse
}
