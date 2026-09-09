import type { LocationResponse } from "../api/types"
import type { IslandMapModel } from "../types/presentation"

interface Anchor {
  locationKey: string
  x: number
  y: number
}

interface IslandLayout {
  width: number
  height: number
  outline: string
  anchors: Anchor[]
  edges: [string, string][]
}

// These are presentation coordinates recovered from the approved donor shell.
// Labels and the set of available locations still come exclusively from the API.
const layouts: Record<string, IslandLayout> = {
  melemele: {
    width: 280,
    height: 260,
    outline:
      "60,10 130,5 190,20 230,60 240,110 220,160 200,200 170,240 130,250 90,245 60,220 35,185 20,145 15,100 25,60",
    anchors: [
      { locationKey: "route-1", x: 125, y: 90 },
      { locationKey: "hauoli-outskirts", x: 105, y: 120 },
      { locationKey: "route-3", x: 175, y: 105 },
      { locationKey: "kalae-bay", x: 60, y: 215 },
      { locationKey: "melemele-sea", x: 195, y: 180 },
    ],
    edges: [
      ["route-1", "hauoli-outskirts"],
      ["route-1", "route-3"],
      ["hauoli-outskirts", "kalae-bay"],
      ["route-3", "melemele-sea"],
    ],
  },
  akala: {
    width: 300,
    height: 280,
    outline:
      "80,10 160,5 220,25 265,70 275,130 260,185 235,225 195,255 150,268 100,262 65,235 40,195 25,145 30,90 50,45",
    anchors: [],
    edges: [],
  },
  ulaula: {
    width: 310,
    height: 290,
    outline:
      "100,8 175,5 240,25 280,70 295,135 280,195 255,240 210,268 155,278 95,270 55,240 30,195 20,140 30,85 60,40",
    anchors: [],
    edges: [],
  },
  poni: {
    width: 270,
    height: 260,
    outline:
      "80,12 150,8 205,30 240,75 248,130 235,180 210,218 170,245 120,252 75,238 45,200 30,155 30,105 50,60",
    anchors: [],
    edges: [],
  },
}

// Compact tab-label presentation for each canonical area-group key, recovered
// from the approved Figma donor (web/src/data/islands.ts as of commit
// d50c86d). Purely visual: a group key maps to a short label and an accent
// token, never to locations, routes, encounters, or Pokémon — those stay
// backend-owned. The backend's own display_name (e.g. "Melemele Island")
// is untouched and still used for the fuller navigator heading.
const ISLAND_PRESENTATION: Record<string, { shortLabel: string; color: string }> = {
  melemele: { shortLabel: "Melemele", color: "var(--color-melemele)" },
  akala: { shortLabel: "Akala", color: "var(--color-akala)" },
  ulaula: { shortLabel: "Ula'ula", color: "var(--color-ulaula)" },
  poni: { shortLabel: "Poni", color: "var(--color-poni)" },
}

export function islandColor(groupKey: string): string {
  return ISLAND_PRESENTATION[groupKey]?.color ?? "var(--color-text-muted)"
}

export function islandShortLabel(
  groupKey: string,
  groupType: "island" | "other" | "special",
  fallbackName: string,
): string {
  if (groupType !== "island") return "Other"
  return ISLAND_PRESENTATION[groupKey]?.shortLabel ?? fallbackName
}

export function buildIslandMap(
  groupKey: string,
  locations: LocationResponse[],
): IslandMapModel | null {
  const layout = layouts[groupKey]
  if (!layout) return null

  const locationsByKey = new Map(
    locations.map((location) => [location.location_key, location]),
  )
  const nodes = layout.anchors.flatMap((anchor) => {
    const location = locationsByKey.get(anchor.locationKey)
    if (!location) return []
    return [
      {
        id: `anchor-${location.location_key}`,
        label: location.display_name,
        x: anchor.x,
        y: anchor.y,
        locationId: location.location_key,
        hasEncounters: location.encounter_place_count > 0,
      },
    ]
  })
  const nodeKeys = new Set(nodes.map((node) => node.locationId))

  return {
    width: layout.width,
    height: layout.height,
    outline: layout.outline,
    nodes,
    edges: layout.edges.flatMap(([from, to]) =>
      nodeKeys.has(from) && nodeKeys.has(to)
        ? [
            {
              fromNodeId: `anchor-${from}`,
              toNodeId: `anchor-${to}`,
            },
          ]
        : [],
    ),
  }
}
