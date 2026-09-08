Before implementation, amend the plan.

## 1. The Penumbra encounter data IS supplied

The statement:

> "No actual Penumbra encounter data file was supplied"

is incorrect.

A large text file containing the actual Penumbra encounter data has been supplied with this task.

**Do not invent, approximate or substitute vanilla USUM encounter data.**

Specifically, do NOT create "plausible Alolan data" for Route 2, Route 3 or any other location.

The supplied encounter dump is authoritative.

Use actual records from that file throughout the prototype.

This matters because Penumbra substantially modifies encounters and includes unusual relationships such as rare SOS species.

---

## 2. Build from the real source structure

The source data follows roughly:

```text
Map
 ├─ map id(s)
 ├─ location name(s)
 └─ encounter tables
     ├─ Day
     │   ├─ normal encounters
     │   ├─ SOS Slot 1
     │   ├─ SOS Slot 2
     │   ├─ ...
     │   └─ SOS Slot 7
     └─ Night
         ├─ normal encounters
         └─ SOS slots
```

Some map records have:

* multiple named locations
* multiple map IDs
* many encounter tables
* zero encounter tables
* different Day/Night encounters
* different level ranges
* identical repeated tables
* SOS substitutions/evolutions
* very rare SOS encounters such as 1%

Preserve that information.

---

## 3. Do not hand-code the dataset into the UI

Rather than:

```text
src/data/penumbra.ts
```

containing manually written Route 1 / Route 2 / Route 3 objects, structure this as:

```text
src/data/
  penumbra-raw.ts or penumbra.json
  parser.ts
  types.ts
  sprites.ts
```

or equivalent.

The important separation is:

**raw encounter source → parser/normalizer → LuxDex data model → UI**

The interface should not care whether the data originated in a text dump, JSON file or later API.

---

## 4. Preserve forms explicitly

Do not normalize:

```text
Rattata (Forme 1)
```

into simply:

```text
Rattata
```

internally.

Likewise for Meowth, Grimer and any other alternate forms.

Use an internal identity such as:

```ts
interface PokemonIdentity {
  species: string;
  form?: string;
  sourceName: string;
}
```

or an equivalent stable key.

Seen/Caught status is global to the **specific species/form**, not merely the display string.

---

## 5. Tracker key

Do not use:

```ts
Record<string, Status>
```

where the string is simply the visible Pokémon name.

Use a stable Pokémon key.

For example:

```ts
type PokemonKey = string;
// examples:
// "pichu"
// "rattata:forme-1"
// "meowth:forme-1"

Record<PokemonKey, 'unseen' | 'seen' | 'caught'>
```

This prevents regional/form collisions later.

---

## 6. Do not cycle Caught back to Unseen accidentally

The proposed interaction:

```text
Unseen → Seen → Caught → Unseen
```

is too easy to misclick while actively playing.

Prefer:

```text
Unseen → Seen → Caught
```

for the primary quick action.

If the user wants to downgrade/reset status, expose that through the Pokémon detail panel.

The point of the tile interaction is extremely quick capture while playing.

---

## 7. Normal and SOS should remain distinct

The plan is correct that SOS shouldn't overwhelm the main encounter grid.

Default:

```text
NORMAL
```

Secondary:

```text
SOS
```

However, when displaying SOS, derive the consolidated Pokémon results from all seven supplied SOS slots.

For example, if a Pokémon appears with the same rate in slots 1–4, present:

```text
Pikachu
10%
SOS 1–4
```

rather than four duplicate cards.

Do not discard the underlying slot information.

---

## 8. Preserve encounter-table identity

Do not assume that several tables belonging to one route can safely be merged.

Initially show neutral selectors such as:

```text
Area 1
Area 2
Area 3
```

or:

```text
Table 1
Table 2
Table 3
```

until meaningful terrain/location names can be derived from authoritative data.

Never invent names like:

```text
Tall Grass
Beach Grass
North Patch
```

without data supporting them.

---

## 9. Use actual encounter examples

Populate the prototype using real supplied data.

There is no reason to limit it to fabricated 5–6 areas if the parser can load the supplied source.

At minimum, demonstrate actual data from several structurally different records:

* Route 1
* Route 2
* Route 3 / Kala'e Bay
* Melemele Sea
* Hau'oli City
* one location with no encounter tables
* one table with a rare SOS result
* one location with substantial Day/Night differences

The UI architecture should work against the complete encounter dataset.

---

## 10. Search should search the complete dataset

The Pokémon viewfinder is one of LuxDex's primary reasons to exist.

If I search:

```text
Bagon
```

LuxDex should derive every occurrence of Bagon from the loaded Penumbra encounter data.

Likewise, SOS results must be searchable.

A Pokémon that appears only through SOS should still be discoverable.

Search results should distinguish:

```text
NORMAL
SOS
```

and identify the relevant encounter table.

---

## 11. Sprite strategy

PokéAPI sprites are fine for the prototype.

Keep sprite resolution entirely separate from encounter identity.

Example:

```text
Penumbra encounter:
Rattata (Forme 1)

LuxDex identity:
rattata:forme-1

Display:
Alolan Rattata

Sprite resolver:
appropriate Alolan Rattata sprite
```

If sprite resolution fails, do not alter the encounter record.

---

## 12. Main product principle

LuxDex is not demonstrating sample Pokémon data.

It is providing a polished interface over the **actual Penumbra encounter dataset supplied with the project**.

The source data is therefore part of the product, not placeholder content.

Proceed with the same proposed aesthetic and overall navigation, but build the prototype around the supplied encounter data rather than invented examples.
