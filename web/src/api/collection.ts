import { request } from "./client"
import type {
  CollectionState,
  CollectionStateResponse,
  CollectionSummaryResponse,
} from "./types"

export function getCollectionSummary(signal?: AbortSignal) {
  return request<CollectionSummaryResponse>("/collection/summary", signal)
}

export function advanceCollection(canonicalKey: string) {
  return request<CollectionStateResponse>(
    `/collection/${encodeURIComponent(canonicalKey)}/advance`,
    undefined,
    { method: "POST" },
  )
}

export function setCollectionState(
  canonicalKey: string,
  state: CollectionState,
) {
  return request<CollectionStateResponse>(
    `/collection/${encodeURIComponent(canonicalKey)}`,
    undefined,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    },
  )
}
