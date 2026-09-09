import { request } from "./client"
import type { StudioDocumentResponse } from "./types"

export const getMapStudio = (signal?: AbortSignal) =>
  request<StudioDocumentResponse>("/map-studio", signal)

export const saveStudioGeometry = (nodeKey: string, points: number[][]) =>
  request<void>(`/map-studio/nodes/${encodeURIComponent(nodeKey)}`, undefined, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: points.map(([x, y]) => ({ x, y })) }),
  })

export const deleteStudioGeometry = (nodeKey: string) =>
  request<void>(`/map-studio/nodes/${encodeURIComponent(nodeKey)}`, undefined, {
    method: "DELETE",
  })

export const saveStudioPlacement = (
  nodeKey: string,
  canonicalKey: string,
  x: number,
  y: number,
) =>
  request<void>(
    `/map-studio/nodes/${encodeURIComponent(nodeKey)}/placements`,
    undefined,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonical_key: canonicalKey, x, y, scale: 1 }),
    },
  )
