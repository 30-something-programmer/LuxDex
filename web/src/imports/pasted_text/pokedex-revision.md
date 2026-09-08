Revise the current LuxDex design with the following changes.

## 1. Rename Collection to Pokédex

Replace all player-facing references to:

**Collection**

with:

**Pokédex**

This is now a proper Pokédex view, not merely a collection/progress screen.

The main navigation should therefore be:

**Areas | Pokémon | Pokédex**

If the current implementation uses "Progress" for the same screen, replace that with **Pokédex** as well.

---

# 2. Pokédex requires its own complete Pokémon dataset

The Penumbra encounter dump is still authoritative for:

* where Pokémon appear
* encounter rates
* levels
* Day/Night
* SOS encounters
* encounter zones

However, encounter data alone is NOT sufficient for the Pokédex.

Add a separate Pokémon master dataset containing the complete Pokédex information required by LuxDex.

At minimum each Pokémon/form should support:

```ts
interface Pokemon {
  key: string;

  name: string;
  species: string;
  form?: string;

  nationalDexNumber: number;
  alolaDexNumber?: number;

  generation?: number;

  sprite: string;
}
```

Exact implementation may differ, but preserve the separation:

```text
Pokédex master data
        +
Penumbra encounter data
        +
player Seen / Owned state
        ↓
LuxDex
```

Do not derive the existence of Pokémon solely from encounter tables.

A Pokémon may exist in the Pokédex even if LuxDex currently has no encounter location for it.

---

# 3. Pokédex ordering controls

At the top of the Pokédex screen add prominent ordering controls.

The user should be able to reorder the Dex by:

**Alola Dex**
**National Dex**
**A–Z**

Also provide useful secondary ordering/filtering options such as:

**Generation**

and player state:

**All | Unseen | Seen | Owned**

Do not hide the primary Dex-order selector inside a settings menu.

It should be immediately accessible near the top of the screen.

For example:

```text
POKÉDEX

[ Alola Dex ] [ National Dex ] [ A–Z ]

[ All ] [ Unseen ] [ Seen ] [ Owned ]

Search Pokémon...
```

---

# 4. Number presentation

When sorted by Alola Dex, make the Alola number prominent.

Example:

```text
#025
Pikachu
```

When sorted by National Dex, make the National number prominent.

Example:

```text
#025
Pikachu
```

The underlying data should retain both numbers.

A Pokémon detail view can show both where available:

```text
Alola Dex     #xxx
National Dex  #025
```

Do not overwrite one numbering scheme with another.

---

# 5. Pokémon without an Alola Dex number

Not every Pokémon necessarily has an Alola regional Pokédex number.

When viewing the **Alola Dex** ordering:

* only Pokémon belonging to that regional Dex should participate in that sequence
* do not invent Alola numbers

When viewing the **National Dex**:

* show the complete supplied Pokédex dataset

If useful, Pokémon without an Alola number can display:

```text
Alola Dex —
```

inside their detail panel.

---

# 6. Pokédex visual treatment

Use the already-approved state system throughout the Pokédex.

### Unseen

Show only the Pokémon silhouette.

The Dex number may remain visible.

The Pokémon name may either remain hidden as `???` for a more game-like presentation or remain visible if usability is preferred.

For the current LuxDex direction, favour the more game-like treatment:

```text
#403
???
[silhouette]
```

### Seen

Show the actual sprite, but faded/desaturated.

Show the Pokémon name normally.

### Owned

Show the full-colour sprite.

Add the small Poké Ball ownership icon.

---

# 7. Dense Pokédex grid

The Pokédex should feel closer to an actual game Pokédex than a collection-management webpage.

Use a dense sprite grid.

Each entry should contain approximately:

* Dex number
* sprite/silhouette
* Pokémon name where appropriate
* subtle Seen/Owned state

Avoid large rectangular ecommerce-style cards.

The player should be able to scan a large number of Pokémon quickly.

---

# 8. Pokédex entry interaction

Selecting a Pokémon opens its LuxDex Pokémon panel/page.

Show:

* full sprite or current discovery treatment
* Pokémon name
* Alola Dex number
* National Dex number
* Seen / Owned state
* explicit Mark Seen / Mark Owned actions
* **Find in Penumbra**

The important LuxDex-specific action is:

**Find in Penumbra**

This should search the Penumbra encounter dataset and show every known location where that Pokémon/form can be encountered.

If the Pokémon has no encounter entry, state that clearly rather than inventing one.

---

# 9. Keep Pokédex and encounter identity linked

Pokédex entries and encounter records must resolve to the same stable Pokémon/form identity.

For example:

```text
rattata:forme-1
```

must remain distinct from:

```text
rattata
```

Do not merge regional or alternate forms merely because they share a National Pokédex species number.

Seen / Owned state applies to the corresponding form identity used by LuxDex.

---

# 10. Search remains global

Pokémon search should now search the complete Pokédex master dataset, not merely Pokémon that appear in the loaded encounter tables.

This means the user can search for any Pokémon in the supplied Pokédex.

The result can then indicate:

**Encounter locations available**

or

**No Penumbra encounter location found**

as appropriate.

---

# 11. Overall relationship

Think of the application as three connected tools:

### Areas

**What can I find here?**

Island → map → route → encounter zone → Pokémon.

### Pokémon

**Where can I find this Pokémon?**

Search Pokémon → Penumbra locations.

### Pokédex

**What have I discovered and owned?**

Complete Pokédex → ordered by Alola / National / alphabetical → discovery state.

All three views should use the same Pokémon identities and Seen/Owned state.

Do not treat Pokédex as merely another rendering of the encounter dump.
