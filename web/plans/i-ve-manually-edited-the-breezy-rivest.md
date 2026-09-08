# Plan: Encounter Place Mapping Layer

## Context

Raw encounter tables in the Penumbra data dump carry no player-facing meaning — they are numbered `Table 1` through `Table N` with no habitat, location, or zone type information. A single raw map block (e.g. Map 000) contains tables that physically belong to multiple distinct in-game locations (Route 1, Hau'oli Outskirts, Melemele Sea). The current `EncounterZoneCards` component displays all tables for an area as raw zones labelled by heuristic inference (`habitatLabel()`), resulting in up to 18 unlabelled or misleadingly-labelled cards.

This iteration adds a verified player-facing mapping layer: `encounterPlaces.ts` defines what each raw table means to the player, enabling `EncounterZoneCards` to show meaningful named encounter places (e.g. "East of Player's House", "Surfing", "Bubbling Fishing Spot") grouped by real in-game location, with duplicate encounter pools consolidated into a single grid.

---

## What changes

### New file: `src/data/encounterPlaces.ts`

Contains the `EncounterPlace` interface, initial data for Map 000 (all 18 tables), pool-consolidation helpers, and lookup functions.

```ts
export interface EncounterPlace {
  id: string;
  location: string;          // player-facing area name: "Route 1", "Hau'oli Outskirts", "Melemele Sea"
  label: string;             // encounter place name shown on card header
  subtitle?: string;         // optional secondary description
  method: 'grass' | 'surf' | 'fishing' | 'special';
  rawMapId: number;          // numeric map ID from the raw data (Map 000 → 0)
  rawTableIndexes: number[]; // 1-based table numbers matching EncounterTable.id "table-N"
  requirement?: string;      // e.g. "Requires Tauros Charge"
  verified: boolean;         // false = physical location not confirmed; show as "Special Encounter"
}
```

**Map 000 data (18 tables):**

| id | location | label | rawTableIndexes | method | requirement |
|---|---|---|---|---|---|
| route1-east-house | Route 1 | East of Player's House | [1, 13] | grass | — |
| route1-bay | Route 1 | Grass Overlooking the Bay | [14] | grass | — |
| route1-iki | Route 1 | Near Iki Town & Western Path | [2, 12, 15] | grass | — |
| route1-tauros | Route 1 | South of Iki Town — Tauros Area | [9, 16, 17] | grass | Requires Tauros Charge |
| hauoli-outskirts-grass | Hau'oli Outskirts | Hau'oli Outskirts Grass | [3, 10] | grass | — |
| melemele-sea-fishing | Melemele Sea | Fishing | [4, 5, 6, 7] | fishing | — |
| melemele-sea-bubbling | Melemele Sea | Bubbling Fishing Spot | [8] | fishing | — |
| melemele-sea-surfing | Melemele Sea | Surfing | [11] | surf | — |
| special-table18 | Route 1 | Special Encounter | [18] | special | — (verified: false) |

**Helpers to add:**

```ts
// Look up all places whose rawMapId is in the area's mapIds array
export function getEncounterPlacesForArea(mapIds: number[]): EncounterPlace[]

// Compare two encounter pools for identity (same Pokémon keys + same rates, same order)
export function encounterPoolsEqual(a: Encounter[], b: Encounter[]): boolean

// Get consolidated encounters for a place: if all rawTableIndexes share the same pool,
// return that pool once. Otherwise return a deduplicated union across all tables.
export function getConsolidatedEncounters(
  tables: EncounterTable[],
  timeOfDay: 'day' | 'night'
): Encounter[]

// Resolve table objects from an Area for a given EncounterPlace
export function getTablesForPlace(area: Area, place: EncounterPlace): EncounterTable[]
```

`rawTableIndexes` uses the same 1-based table numbers as the raw data (`Table 1 (Day):` → `id: "table-1"`). Lookup: `area.tables.find(t => t.id === \`table-${n}\`)`.

---

### Modified file: `src/components/EncounterZoneCards.tsx`

Add a mapped-area rendering path alongside the existing `habitatLabel` fallback.

**Detection**: at the top of the component, call `getEncounterPlacesForArea(area.mapIds)`. If it returns any results, render the **mapped path**; otherwise render the existing **fallback path** (unchanged).

**Mapped path layout:**

```
[ Location header: "Route 1" ]

  ┌ East of Player's House ─────────────────┐
  │ subtitle: "First two grass fields"       │
  │ 🌿  Lv. 4–6                              │
  │ [ PokeTile grid ]                        │
  └──────────────────────────────────────────┘

  ┌ Grass Overlooking the Bay ───────────────┐
  │ ...                                      │
  └──────────────────────────────────────────┘

  ┌ South of Iki Town — Tauros Area ─────────┐
  │ ⚠ Requires Tauros Charge                  │
  │ ...                                      │
  └──────────────────────────────────────────┘

[ Location header: "Hau'oli Outskirts" ]

  ┌ Hau'oli Outskirts Grass ─────────────────┐
  └──────────────────────────────────────────┘

[ Location header: "Melemele Sea" ]

  ┌ Surfing ─────────────────────────────────┐
  └──────────────────────────────────────────┘
  ┌ Fishing ─────────────────────────────────┐
  └──────────────────────────────────────────┘
  ┌ Bubbling Fishing Spot ────────────────────┐
  └──────────────────────────────────────────┘
```

**Card behaviour:**
- Card header shows: method icon + label + level range badge. If `!place.verified`, render as "Special Encounter" with a neutral muted style.
- Subtitle shown in small muted text below the label when present.
- `requirement` shown as a small amber warning chip inside the card header.
- Encounter grid uses `PokeTile` with `getConsolidatedEncounters()` — identical pools across multiple raw tables are shown once, not repeated.
- SOS mode: replace the normal grid with consolidated SOS encounters from all tables in the place (union of `sosDayConsolidated` / `sosNightConsolidated`, deduplicated by key).
- `onPokemonClick(enc, tableIdx)` passes the first table index for the place so `PokePanel` locationContext remains correct.

**Method icons / colour accents** using existing tokens:
- `grass` → `--color-melemele` green pip
- `surf` → `--color-poni` blue pip  
- `fishing` → `--color-poni` blue pip (slightly darker via opacity)
- `special` → `--color-text-muted` neutral pip

**Location section headers:**
- Bold small-caps location name, coloured by island (`islandInfo.color` from `ISLANDS`), above the first card in each group.

**No changes to the fallback path** — areas with no `encounterPlaces` data continue to use `habitatLabel` + the unknown accordion exactly as today.

---

## Files to create / modify

| File | Action |
|---|---|
| `src/data/encounterPlaces.ts` | **Create** — interface, Map 000 data, helpers |
| `src/components/EncounterZoneCards.tsx` | **Modify** — add mapped-area path; fallback unchanged |

`src/data/routeSchematics.ts`, `src/components/AreasView.tsx`, `src/data/islands.ts`, and all other files are **untouched**.

---

## Reuse

- `Area.mapIds` (`src/data/types.ts`) — used to look up encounter places
- `EncounterTable.id` (`src/data/types.ts`) — `"table-N"` format used to resolve raw table indexes
- `PokeTile` — reused unchanged for the encounter grid inside each card
- `--color-melemele`, `--color-poni`, `--color-sos`, `--color-sos-rare`, `--color-text-muted` — all colour tokens from `src/index.css`
- `islandInfo.color` from `ISLANDS` (`src/data/islands.ts`) — location header accent colour

---

## Verification

1. Navigate to **Melemele → Route 1** (Map 000 area). The 18-zone card wall disappears. Cards appear grouped under three location headers: Route 1, Hau'oli Outskirts, Melemele Sea.
2. **Route 1** shows four named cards: East of Player's House, Grass Overlooking the Bay, Near Iki Town & Western Path, South of Iki Town — Tauros Area.
3. **South of Iki Town** card shows an amber "Requires Tauros Charge" chip.
4. **Melemele Sea** shows Surfing, Fishing (consolidated from 4 tables if pools match), Bubbling Fishing Spot.
5. **Table 18** appears as "Special Encounter" with muted neutral styling.
6. Toggle **Day/Night** — encounter grids update per time of day.
7. Toggle **SOS** — cards switch to SOS grids; RARE badge appears for ≤1% rates.
8. Click a Pokémon → PokePanel opens with correct location context.
9. Navigate to a route with **no mapping data** (e.g. Route 2) — existing `habitatLabel` accordion renders unchanged.
