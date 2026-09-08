# LuxDex — Plan

## Context

The user wants a polished, functional Pokémon encounter companion app called **LuxDex**, purpose-built for the **Penumbra ROM mod** of Pokémon Ultra Sun/Ultra Moon. The app should feel like a tactile game-like companion tool (ORAS DexNav–inspired), not a SaaS dashboard. The brief is comprehensive and detailed.

**Critical note:** No actual Penumbra encounter data file was supplied — the spec references it but only the brief/spec document was attached. I'll hand-code several complete areas from data mentioned in the brief (Route 1 table is fully listed) and add plausible Alolan data for Routes 2–4 and a few other areas to demonstrate the full data model. The architecture will be designed for easy full-data loading.

---

## Aesthetic

- **Stance:** Warm-game — warm off-white/cream background (`#FDF6E8`), deep navy (`#1E1B4B`) for area panels, vivid accent palette (amber for caught, sky-blue for seen, rose for SOS highlights)
- **Fonts:** `Nunito` (rounded geometric sans) for all UI — game-like, friendly, legible at small sizes; `JetBrains Mono` for encounter percentages and level numbers
- **Palette tokens:** warm cream background, deep indigo panels, amber `#F59E0B` (caught), blue `#60A5FA` (seen), near-white surface cards, coral accents for SOS rarities
- **Visual:** rounded-lg panels, subtle box-shadows, no glassmorphism, compact tiles (~80px), obvious Seen/Caught badge overlays on sprites

---

## Architecture

### Files to create/modify

| File | Purpose |
|------|---------|
| `src/App.tsx` | Shell: tab nav (Areas / Pokémon / Progress), global state |
| `src/index.css` | Google Fonts imports (Nunito, JetBrains Mono), Tailwind v4 theme tokens |
| `src/data/penumbra.ts` | Typed encounter data (areas, tables, day/night, SOS slots) |
| `src/data/sprites.ts` | Pokémon name → PokéAPI sprite URL mapper |
| `src/hooks/useTracker.ts` | LocalStorage Seen/Caught state (global per species) |
| `src/components/AreasView.tsx` | Area selector + encounter grid |
| `src/components/AreaNav.tsx` | Searchable location list (desktop sidebar / mobile slide-over) |
| `src/components/EncounterGrid.tsx` | Pokémon tile grid with Seen/Caught overlays |
| `src/components/PokeTile.tsx` | Individual compact Pokémon tile |
| `src/components/SOSSection.tsx` | Collapsible SOS encounter panel |
| `src/components/PokemonSearch.tsx` | Search-by-Pokémon view with location results |
| `src/components/ProgressView.tsx` | Dense dex grid with All/Unseen/Seen/Caught filters |
| `src/components/PokePanel.tsx` | Slide-over detail panel (sprite, status, actions, encounter info) |
| `src/components/DayNightToggle.tsx` | Sun/moon toggle |

---

## Data Model

```ts
interface Encounter {
  name: string;         // "Alolan Rattata", "Pikachu", etc.
  rate: number;         // 10 = 10%
  minLevel: number;
  maxLevel: number;
}

interface SOSEncounter extends Encounter {
  slots: number[];      // [1,2,3,4] etc.
}

interface EncounterTable {
  id: string;
  label: string;        // "Table 1", "Table 2", etc.
  levelMin: number;
  levelMax: number;
  day: Encounter[];
  night: Encounter[];
  sos: {
    day: SOSEncounter[];
    night: SOSEncounter[];
  };
}

interface Area {
  id: string;
  name: string;
  mapIds: number[];
  tables: EncounterTable[];
}
```

**Tracker hook:** `useTracker()` returns `{ status, setStatus }` where `status` is `Record<string, 'unseen' | 'seen' | 'caught'>`, persisted to `localStorage` under key `luxdex-tracker`.

---

## Data Content (seeded from brief)

**Route 1** — full table from brief (Yungoos 20%, Caterpie 10%, Buneary 10%, Ledyba 10%, Pichu 10%, Grubbin 10%, Alolan Rattata 10%, Pikipek 10%, Spinarak 5%, Happiny 5%)

**Route 2** — seed with plausible Alolan encounters (Slowpoke, Drowzee, Rattata, Grimer, Cutiefly, etc.) with day/night differences

**Route 3** — include SOS demonstration (Bagon table with Salamence 1% SOS)

**Hau'oli City** / **Melemele Sea** / **Kala'e Bay** — at least one more area each to show variety

Total: ~5–6 areas fully populated. Enough to demo all features.

---

## Sprite Strategy

Use `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{dexNumber}.png`

Maintain a `SPRITE_MAP` in `src/data/sprites.ts`:
- Maps display name → Pokédex number
- Alolan forms → regional variant numbers (e.g. Alolan Rattata → 19, form param `alola`)
- Fallback: if form-specific sprite unavailable, fall back to base species number
- Sprite URL generator exported as `getSpriteUrl(name: string): string`

---

## View Details

### Areas View
- **Desktop:** left sidebar (collapsible area nav, ~220px), center (header + grid), right (PokePanel when open)
- **Mobile:** bottom tab nav, slide-over for area picker, 3-column tile grid
- **Area header:** name, "Penumbra Encounter Guide", Day/Night toggle, Table selector (if >1 table), level range, caught counter
- **Normal/SOS toggle:** two-tab switcher below header
- **Completion bar:** "Caught X / N" with mini Poké Ball icons

### Encounter Grid
- Tiles ~80–90px wide, 3–4 columns mobile, 4–6 columns desktop
- Tile: sprite (dominant), name (small), rate badge (`JetBrains Mono`), status indicator
- **Status treatment:**
  - Unseen: slightly muted sprite, no badge
  - Seen: blue eye badge top-right, subtle blue border
  - Caught: amber Poké Ball badge top-right, warm amber border glow
- **One-tap cycle:** clicking tile body cycles Unseen → Seen → Caught → Unseen
- Long-press / right-click / tile detail opens PokePanel

### SOS Section
- Collapsible below normal grid
- Groups identical Pokémon across slots ("SOS Slots 1–4")
- Rare encounters (≤1%) get coral/rose highlight
- Salamence example would show the SOS rarity treatment

### Pokémon Search View
- Prominent search box at top
- Fuzzy filter as-you-type on all Pokémon names in dataset
- Result card: large sprite, name, status + cycle button, then list of all encounter locations
- Each location row: area name → tappable link to Areas view, encounter %, level range, Day/Night pills, Normal/SOS label

### Progress View
- Dense sprite grid (same tile, slightly smaller ~64px)
- Filter tabs: All | Unseen | Seen | Caught
- Search input
- Caught/Seen summary counts at top
- Clicking opens PokePanel

### PokePanel
- Right-side panel on desktop (slides in), bottom sheet on mobile
- Large sprite, name, status
- Explicit `[ Mark Seen ]` `[ Mark Caught ]` buttons
- Current location encounter info (if opened from Areas)
- "Find elsewhere" link → jumps to Search view

---

## Implementation Order

1. `src/index.css` — font imports + CSS tokens
2. `src/data/penumbra.ts` — typed data for 5–6 areas
3. `src/data/sprites.ts` — sprite URL mapper
4. `src/hooks/useTracker.ts` — localStorage tracker
5. `src/App.tsx` — shell + global state + tab nav
6. `src/components/PokeTile.tsx` + `EncounterGrid.tsx` — core tile
7. `src/components/AreaNav.tsx` — location selector
8. `src/components/AreasView.tsx` — main view
9. `src/components/SOSSection.tsx`
10. `src/components/PokePanel.tsx`
11. `src/components/PokemonSearch.tsx`
12. `src/components/ProgressView.tsx`
13. `src/components/DayNightToggle.tsx` (inline or separate)

---

## Verification

1. Visit app in preview — default Areas view should show Route 1 with sprites loaded
2. Toggle Day/Night — encounter pools should visibly change where different
3. Click tiles to cycle Unseen → Seen → Caught — badges should appear/update
4. Navigate to Route 2 — Route 1 status should persist
5. Switch to SOS tab — should show grouped SOS Pokémon
6. Switch to Pokémon Search, type "Pichu" — should show Route 1 result
7. Switch to Progress, filter "Caught" — should reflect marks made in Areas
8. On narrow viewport — should show bottom tab nav, 3-column tile grid
