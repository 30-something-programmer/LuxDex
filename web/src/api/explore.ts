import { request } from "./client"
import type { ExploreLocationResponse, PokemonExploreResponse } from "./types"

export function getLocationExplore(
  groupKey: string,
  locationKey: string,
  signal?: AbortSignal,
) {
  return request<ExploreLocationResponse>(
    `/explore/areas/${encodeURIComponent(groupKey)}/${encodeURIComponent(locationKey)}`,
    signal,
  )
}

export function getPokemonExplore(canonicalKey: string, signal?: AbortSignal) {
  return request<PokemonExploreResponse>(
    `/explore/pokemon/${encodeURIComponent(canonicalKey)}`,
    signal,
  )
}
