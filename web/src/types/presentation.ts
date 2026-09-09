export type ResourceState = "loading" | "ready" | "empty" | "error"
export type PokemonStatus = "unseen" | "seen" | "owned"
export type TimeOfDay = "day" | "night"

export interface IslandOption {
  id: string
  name: string
  fullName: string
  color: string
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
  name: string
  status: PokemonStatus
  spriteAssetKey?: string | null
  rate?: number
  isRare?: boolean
  sosSlots?: number[]
}

export interface EncounterZoneModel {
  id: string
  label: string
  minLevel?: number
  maxLevel?: number
  encounters: PokemonCardModel[]
  sosEncounters: PokemonCardModel[]
}

export interface EncounterOccurrenceModel {
  id: string
  locationId: string
  locationName: string
  zoneLabel: string
  timeOfDay: TimeOfDay | "both"
  minLevel: number
  maxLevel: number
  rate: number
  isSos: boolean
  sosSlots?: number[]
}

export interface PokemonSearchResultModel {
  pokemon: PokemonCardModel
  occurrences: EncounterOccurrenceModel[]
}

export interface PokedexEntryModel extends PokemonCardModel {
  alolaDexNumber?: number
  nationalDexNumber?: number
  generation?: number
}

export type PokedexSort = "alola" | "national" | "az"
export type StatusFilter = "all" | PokemonStatus
