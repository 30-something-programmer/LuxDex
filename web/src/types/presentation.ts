export type ResourceState = "loading" | "ready" | "empty" | "error"
export type PokemonStatus = "unseen" | "seen" | "owned"
export type TimeOfDay = "day" | "night"

export interface IslandOption {
  id: string
  name: string
  shortLabel: string
  fullName: string
  color: string
  groupType: "island" | "other" | "special"
}

export interface LocationOption {
  id: string
  name: string
  aliases?: string[]
  hasEncounters: boolean
  secondaryLabel?: string
}

export interface MapCompletion {
  owned: number
  total: number
}

export interface AreaCompletionModel extends MapCompletion {
  seen: number
}

export interface IslandMapNode {
  id: string
  label: string
  x: number
  y: number
  locationId?: string
  hasEncounters: boolean
  completion?: MapCompletion
}

export interface IslandMapEdge {
  fromNodeId: string
  toNodeId: string
}

export interface IslandMapModel {
  width: number
  height: number
  outline: string
  nodes: IslandMapNode[]
  edges: IslandMapEdge[]
}

export interface PokemonCardModel {
  id: string
  canonicalKey: string
  name: string
  status: PokemonStatus
  spritePath?: string | null
  formLabel?: string | null
  rate?: number | null
  minLevel?: number | null
  maxLevel?: number | null
  isRare?: boolean
  sosSlots?: number[]
  contextLabel?: string
  genderMarker?: "♂" | "♀"
}

export interface EncounterZoneModel {
  id: string
  label: string
  method: string
  minLevel?: number
  maxLevel?: number
  encounters: PokemonCardModel[]
  sosEncounters: PokemonCardModel[]
  additionalSosEncounters: PokemonCardModel[]
}

export interface EncounterOccurrenceModel {
  id: string
  areaGroupKey: string
  areaGroupName: string
  locationId: string
  locationName: string
  zoneLabel: string
  timeOfDay: TimeOfDay | "both"
  minLevel: number | null
  maxLevel: number | null
  rate: number | null
  isSos: boolean
  sosSlots?: number[]
}

export interface PokemonSearchResultModel {
  pokemon: PokemonCardModel
  nationalDexNumber: number
  alolaDexNumber?: number
  generation: number
}

export interface PokedexEntryModel extends PokemonCardModel {
  alolaDexNumber?: number
  nationalDexNumber?: number
  generation?: number
}

export interface PokemonFormOptionModel {
  key: string
  name: string
  status: PokemonStatus
}

export interface PokemonDetailModel extends PokedexEntryModel {
  speciesName: string
  formName: string
  isRegional: boolean
  regionalName?: string | null
  forms: PokemonFormOptionModel[]
  occurrences: EncounterOccurrenceModel[]
}

export type PokedexSort = "alola" | "national" | "az"
export type StatusFilter = "all" | PokemonStatus
