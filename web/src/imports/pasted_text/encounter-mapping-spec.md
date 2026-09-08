The current `Table N / Zone N / Area A` model must be replaced with a player-facing **encounter-place mapping layer**.

Do not expose raw encounter table numbers in the UI.

The Penumbra encounter dump should remain the data source for Pokémon, rates, levels, Day/Night and SOS.

The new mapping layer tells LuxDex what those raw tables mean to the player.

# Important structural correction

A single raw encounter block can represent multiple named in-game locations.

For example, raw Map 000 contains encounter tables for:

* Route 1
* Hau'oli Outskirts
* Melemele Sea

These must not all appear as 18 zones under one page.

Split them into meaningful player-facing areas.

# Route 1 / Hau'oli Outskirts / Melemele Sea mapping

For the current Map 000 18-table encounter block, use the following player-facing grouping.

## Route 1 proper

### East of Player's House

Raw tables:

`1, 13`

These represent the first two grass fields east of the player's house.

Display as one encounter place:

**East of Player's House**

Optional subtitle:

**First two grass fields**

Do not show separate Table 1 / Table 13 selectors if their Penumbra encounter pools are equivalent.

---

### Grass Overlooking the Bay

Raw table:

`14`

Display as:

**Grass Overlooking the Bay**

This is a distinct encounter area and should remain separate.

---

### Near Iki Town / Western Path

Raw tables:

`2, 12, 15`

These correspond to the grass fields nearest Iki Town and the grass field on the western path.

Display as:

**Near Iki Town & Western Path**

Optional subtitle:

**Three grass fields**

Again, consolidate duplicate encounter tables when their effective Penumbra pools are identical.

---

### Tauros-Accessible Grass

Raw tables:

`9, 16, 17`

These correspond to the isolated grass area south of Iki Town that is blocked by rocks until Tauros Charge is available.

Display as:

**South of Iki Town — Tauros Area**

or, if space is limited:

**Tauros Area**

Add a small requirement indicator:

**Requires Tauros Charge**

---

## Hau'oli Outskirts

Raw tables:

`3, 10`

Display as:

**Hau'oli Outskirts Grass**

If both tables contain the same Penumbra encounter pool, consolidate them into one encounter place.

Do not present this as part of Route 1 proper in the same zone selector.

It belongs under the player-facing location:

**Hau'oli Outskirts**

---

## Melemele Sea

### Fishing

Raw tables:

`4, 5, 6, 7`

These are fishing encounter tables.

If their Penumbra encounter pools are identical, show a single:

**Fishing**

encounter category.

Do not show four separate fishing zones merely because four raw tables exist.

---

### Bubbling Fishing Spot

Raw table:

`8`

This has a distinct fishing encounter pool.

Display separately as:

**Bubbling Fishing Spot**

Use a subtle special-water/fishing visual indicator.

---

### Surfing

Raw table:

`11`

Display as:

**Surfing**

This belongs to **Melemele Sea**, not Route 1 grass navigation.

---

## Raw table 18

Table 18 is a 100% Pikipek encounter in the underlying data.

Do not label its exact physical meaning until independently verified.

For now place it under:

**Special Encounter**

and keep its raw table ID internal only.

Do not invent a location for it.

# UI implications

The route page should no longer contain 18 selectors.

Instead the player should navigate something closer to:

```text
Melemele
  ├ Route 1
  │   ├ East of Player's House
  │   ├ Grass Overlooking the Bay
  │   ├ Near Iki Town & Western Path
  │   └ South of Iki Town — Tauros Area
  │
  ├ Hau'oli Outskirts
  │   └ Grass
  │
  └ Melemele Sea
      ├ Surfing
      ├ Fishing
      └ Bubbling Fishing Spot
```

That hierarchy is the player-facing source of truth.

# Consolidation rule

Multiple raw tables may represent separate physical patches that share exactly the same encounter pool.

When this happens:

* preserve every raw table internally
* group them under one player-facing encounter place
* do not duplicate the same Pokémon grid several times

For example:

```ts
{
  id: "route1-near-iki",
  name: "Near Iki Town & Western Path",
  rawTables: [2, 12, 15]
}
```

The UI operates on the encounter place.

The parser/data layer retains the raw-table linkage.

# Proposed data model

Add a separate location mapping file such as:

`src/data/encounterPlaces.ts`

Example:

```ts
interface EncounterPlace {
  id: string;
  location: string;
  label: string;
  subtitle?: string;
  method: 'grass' | 'surf' | 'fishing' | 'special';
  rawMapId: number;
  rawTableIndexes: number[];
  requirement?: string;
  verified: boolean;
}
```

Example data:

```ts
{
  id: "route1-east-house",
  location: "Route 1",
  label: "East of Player's House",
  subtitle: "First two grass fields",
  method: "grass",
  rawMapId: 0,
  rawTableIndexes: [1, 13],
  verified: true
}
```

# Map behaviour

The island map remains the top-level spatial navigation.

If a real route map asset is available later, encounter places can be positioned on it.

Until then, use these meaningful encounter-place names as compact cards or selectors.

Do not generate arbitrary blob maps.

Do not use:

* Table 1
* Zone 1
* Area A

in the normal player interface.

# Existing state model remains unchanged

Keep:

* Unseen = silhouette
* Seen = faded sprite
* Owned = full sprite + small Poké Ball
* Day / Night
* SOS
* Pokémon search
* Pokédex
* island navigation

The purpose of this change is purely to make encounter navigation correspond to actual in-game places rather than ROM table numbering.
