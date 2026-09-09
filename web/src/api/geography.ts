import { request } from "./client"
import type { AreaGroupResponse, LocationResponse } from "./types"

export function getAreaGroups(signal?: AbortSignal) {
  return request<AreaGroupResponse[]>("/geography/groups", signal)
}

export function getLocations(groupKey: string, signal?: AbortSignal) {
  return request<LocationResponse[]>(
    `/geography/groups/${encodeURIComponent(groupKey)}/locations`,
    signal,
  )
}
