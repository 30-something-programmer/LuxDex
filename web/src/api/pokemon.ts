import { queryString, request } from "./client"
import type {
  PokemonSearchResultResponse,
  PokemonSpeciesPageResponse,
} from "./types"

export type PokemonOrder = "national" | "alola" | "name"

export interface ListPokemonOptions {
  order: PokemonOrder
  generation?: number | null
  query?: string
}

export function listPokemon(options: ListPokemonOptions, signal?: AbortSignal) {
  const query = queryString({
    order: options.order,
    generation: options.generation,
    q: options.query?.trim(),
    limit: 1000,
  })
  return request<PokemonSpeciesPageResponse>(`/pokemon${query}`, signal)
}

export function searchPokemon(query: string, signal?: AbortSignal) {
  return request<PokemonSearchResultResponse[]>(
    `/pokemon/search${queryString({ q: query.trim(), limit: 30 })}`,
    signal,
  )
}
