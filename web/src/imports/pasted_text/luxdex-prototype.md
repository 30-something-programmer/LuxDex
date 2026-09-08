# LuxDex

Create a polished, functional prototype for **LuxDex**, a lightweight encounter companion for Pokémon Ultra Sun / Ultra Moon specifically using the **Penumbra ROM mod encounter data supplied with this prompt**.

LuxDex is not intended to be a full Pokédex, battle calculator or strategy website.

Its purpose is extremely focused:

**While playing Penumbra, I want to quickly see which Pokémon are available in my current area, see how they are encountered, and mark them as Seen or Caught. I should also be able to search for a Pokémon and immediately discover where I can encounter it.**

---

# Core design inspiration

Take loose UX inspiration from the lower-screen map / DexNav-style interfaces used in Pokémon Omega Ruby and Alpha Sapphire.

Do NOT recreate the ORAS interface pixel-for-pixel.

Instead borrow the useful ideas:

* location-first navigation
* visual Pokémon tiles
* compact information
* a sense of exploring an area
* completion/progress visible directly on the area
* game-like rather than spreadsheet-like presentation
* strong use of Pokémon sprites rather than text lists

The resulting design should feel like something that could sit beside a 3DS while I play.

It should be cheerful, tactile and game-like, while still being a modern LuxForge application.

Avoid generic SaaS dashboard styling.

Do not use giant analytics cards, business-dashboard layouts or unnecessarily large whitespace.

---

# Pokémon artwork

**Pokémon must be represented using actual Pokémon sprites.**

Do not use:

* coloured circles with initials
* generic monster illustrations
* emoji
* text-only cards

For the functional prototype, load real Pokémon sprite PNGs from a public sprite source such as PokéAPI where practical.

Use the supplied species names as the encounter authority.

The dataset contains alternate forms such as:

* Rattata (Forme 1)
* Meowth (Forme 1)
* Grimer (Forme 1)

Preserve the distinction between forms.

If an exact alternate-form sprite cannot automatically be resolved, retain the correct encounter name and use the nearest appropriate sprite as a prototype fallback rather than hiding the Pokémon.

---

# Main application structure

Use three primary views:

## 1. AREAS

This should be the default view.

The user selects or searches for an area such as:

* Route 1
* Route 2
* Route 3
* Hau'oli City
* Melemele Sea
* Kala'e Bay
* etc.

The supplied data has numbered Map records and some records relate to several named areas.

Do not discard these mappings.

An area may have multiple encounter tables.

Some maps have zero encounter tables.

Do not invent encounter data where none exists.

### Area header

Show something similar to:

**Route 1**

Penumbra Encounter Guide

Then compact controls for:

[ DAY ] [ NIGHT ]

and, where the location contains several tables:

[ Area 1 ] [ Area 2 ] [ Area 3 ]

The source currently names these Table 1, Table 2 etc. If no semantic terrain name is known, keep neutral labels rather than inventing names such as "Tall Grass" or "Cave".

Also display the level range for the selected encounter table:

**Lv. 4–6**

---

# Area Pokémon grid

This is the heart of LuxDex.

Display every standard encounter as a compact Pokémon tile.

Example using one of the supplied Route 1 tables:

Yungoos — 20%
Caterpie — 10%
Buneary — 10%
Ledyba — 10%
Pichu — 10%
Grubbin — 10%
Alolan Rattata — 10%
Pikipek — 10%
Spinarak — 5%
Happiny — 5%

Each tile should prominently show:

* actual sprite
* Pokémon name
* encounter percentage
* Seen/Caught state

The sprite should be the dominant visual element.

Encounter rate should be readable without opening the Pokémon.

Do not make every Pokémon a huge card. This screen needs enough visual density that roughly 8–12 Pokémon can be scanned easily.

Think closer to a game selection screen than an ecommerce catalogue.

---

# Seen / Caught tracking

Tracking needs to be exceptionally easy.

There are three states:

### UNSEEN

Normal sprite still visible.

Use a subdued treatment around the tile rather than hiding the identity of the Pokémon.

### SEEN

Clearly indicate the Pokémon has been encountered.

Possible visual treatment:

* small eye icon
* illuminated border
* "Seen" badge

### CAUGHT

Very obvious completion state.

Use something like:

* small Poké Ball marker
* checkmark
* brighter completed tile treatment

A caught Pokémon inherently counts as seen.

## Interaction

Make the status control directly available on every Pokémon tile.

A simple interaction could cycle:

**Unseen → Seen → Caught**

but the current state must always be obvious.

Opening the Pokémon should also expose explicit:

[ MARK SEEN ]

[ MARK CAUGHT ]

actions.

Do not bury these actions in settings or menus.

Persist these states locally in the prototype so that navigating between locations doesn't reset progress.

Caught/Seen status is **global to the Pokémon/form**, not specific to a single location.

If I catch a Pokémon on Route 1 and later see it listed on another route, it should already display as caught there.

---

# Area completion

Borrow the useful feeling of ORAS's area-completion interface.

At the top or side of the area view show a compact indicator such as:

**Caught 7 / 10**

or

**7 of 10 caught**

Potentially accompany this with a row of tiny Poké Ball indicators.

Do not make completion percentage the dominant purpose of the app; it is secondary feedback.

---

# SOS encounters

The dataset contains:

* standard encounters
* SOS Slot 1
* SOS Slot 2
* SOS Slot 3
* SOS Slot 4
* SOS Slot 5
* SOS Slot 6
* SOS Slot 7
* additional SOS encounters where applicable

This information matters, but **do not dump all seven SOS tables onto the main screen.**

The default area grid should show NORMAL encounters.

Provide an obvious secondary control:

**Normal | SOS**

or an expandable:

**SOS Encounters**

section.

When SOS is opened, consolidate the information intelligently.

For each Pokémon show:

* sprite
* Pokémon
* SOS encounter percentage
* which SOS slot(s) it can occur in
* whether it replaces/evolves from another standard encounter where this can be inferred directly from the supplied table

Do NOT invent relationships the data does not establish.

If several SOS slots contain the same result, present them compactly rather than duplicating seven identical cards.

For example:

**Pikachu**
10%
SOS slots 1–4

is preferable to four separate Pikachu cards.

Special SOS Pokémon should stand out visually.

For example, the source contains situations such as an ordinary Bagon encounter where an SOS slot can produce **Salamence at 1%**.

Make rare/special SOS results easy to notice.

---

# Day and Night

Day/night selection must alter the encounter pool immediately.

Use a simple sun/moon toggle.

If Day and Night encounter pools are identical, the control can remain but should not create visually duplicated information.

Where species or percentages differ, update the grid.

Do not combine Day and Night percentages into one confusing card.

---

# 2. POKÉMON SEARCH

The second major workflow should invert the data.

I should be able to search:

**Shinx**

and receive every Penumbra encounter location where Shinx occurs.

This is essentially the "viewfinder" part of LuxDex.

Search should be quick and prominent.

Support fuzzy text filtering as the user types.

A Pokémon result page should show:

* large sprite
* Pokémon name
* Seen / Caught status
* all known locations from the supplied Penumbra encounter dataset

Each location result should show:

* area name
* encounter percentage
* level range
* Day / Night availability
* whether it is a normal encounter or SOS encounter
* SOS slot where relevant

Example presentation:

**Route 3**
Lv. 16–19
10%
Day & Night

or

**Route 3**
SOS
1%
Slot 1
Day & Night

Tapping a location takes the user straight into that encounter table in the Areas view.

---

# 3. PROGRESS / DEX

Provide a lightweight overall collection screen.

This is NOT a full traditional Pokédex.

Show Pokémon represented by sprites in a dense grid with filters:

[ All ] [ Unseen ] [ Seen ] [ Caught ]

Also provide:

* search
* caught count
* seen count

Clicking a Pokémon opens its LuxDex encounter page.

This screen exists mainly to answer:

**"What haven't I caught yet?"**

---

# Pokémon quick panel

Clicking or tapping a Pokémon anywhere should open a compact detail panel or modal.

Show:

* sprite
* Pokémon name
* current Seen/Caught state
* Mark Seen
* Mark Caught
* encounter rate for the currently selected location
* level range
* Normal/SOS
* Day/Night
* link/action to "Find elsewhere"

Do not add irrelevant traditional Pokédex information such as:

* base stats
* abilities
* moves
* breeding
* evolution chains
* competitive information

unless it is required specifically to explain an encounter.

LuxDex is an encounter tool.

---

# Location navigation

The encounter source contains hundreds of map records, so a giant flat dropdown is not acceptable.

Use:

* searchable location selector
* recent locations
* sensible grouping where it can be established from the supplied data
* map/order IDs internally

Allow quick Previous Area / Next Area navigation for playthrough use.

A user walking from Route 1 to Route 2 should not need to return to the home page.

On desktop, a collapsible area navigator is acceptable.

On mobile, use a slide-over location picker.

---

# Data handling rules

The supplied Penumbra encounter dump is the source of truth.

Its general hierarchy is:

Map
→ zero or more encounter Tables
→ Day/Night
→ level range
→ Standard Encounters
→ SOS Slots 1–7
→ Additional SOS Encounters

Preserve this hierarchy internally even if the UI simplifies it.

Important:

* multiple map IDs can refer to the same named location
* a map can reference multiple named locations
* locations can contain multiple tables
* tables can have different level ranges
* Day and Night can differ
* SOS pools can differ by slot
* some maps contain no encounter tables
* encounter rates can be unusual values such as 1%, 5%, 13%, 15%, 20%, 25%, 30%, 33%, 35%, 40%, 45%, 50%, 60%, 100%, etc.
* "(None) (0%)" is not a Pokémon and must never appear as a Pokémon card

Do not normalize or "correct" encounter values.

Represent exactly what the supplied Penumbra data says.

---

# Visual direction

LuxDex should look playful and polished.

Aim for:

* Pokémon-game-like tactile UI
* rounded panels
* compact layouts
* colourful but restrained accents
* soft depth
* clear hierarchy
* strong sprite presentation
* crisp small typography
* subtle map/topographic motifs
* excellent hover and selected states
* obvious Day/Night state
* obvious Seen/Caught state

Consider using a warm off-white or very light neutral background with strong coloured interface accents rather than an all-white SaaS page.

The application can incorporate a subtle LuxForge identity, but Pokémon encounter discovery should dominate.

Avoid excessive gradients and glassmorphism.

Avoid building a literal Nintendo 3DS frame around the UI.

It should **feel inspired by a game interface**, not like an emulator skin.

---

# Desktop layout concept

A good desktop composition could be:

LEFT

Compact location navigation / map-list hybrid.

CENTRE

Selected location title, day/night selector and Pokémon encounter grid.

RIGHT

Contextual Pokémon / SOS / completion panel.

However, feel free to improve this if another composition makes encounter scanning faster.

---

# Mobile layout

Mobile is important because this is likely to be used next to the console.

Prioritise:

1. Area name
2. Day/Night
3. Pokémon sprites
4. Encounter %
5. Seen/Caught controls

Use approximately 3 Pokémon tiles per row where screen width permits.

Make buttons comfortably tappable.

Keep scrolling efficient.

A bottom navigation bar may contain:

**Areas | Pokémon | Progress**

---

# Prototype functionality

Make the Figma Make prototype meaningfully interactive.

Implement:

* switching locations
* switching encounter tables
* switching Day/Night
* Normal/SOS switching
* Pokémon search
* Pokémon → location lookup
* marking Seen
* marking Caught
* status persistence while navigating
* All / Unseen / Seen / Caught filtering
* Pokémon detail panel
* area completion updating when status changes

Use realistic encounter data from the supplied Penumbra file rather than lorem ipsum.

Populate several complete locations from the actual source so the prototype demonstrates dense areas, simple areas and SOS encounters.

The implementation/data model should be designed so the complete supplied dataset can be loaded without redesigning the UI.

---

# Most important UX test

Imagine I am actively playing Pokémon Penumbra.

I enter Route 2.

Within a few seconds I should be able to:

1. Select Route 2.
2. See actual sprites of everything I can encounter.
3. See their encounter rates and levels.
4. Switch between Day and Night.
5. Immediately tell what I have already caught.
6. Mark something Seen or Caught with one interaction.
7. Inspect SOS encounters if I care about them.
8. Search a Pokémon I want and find where it appears.

If the design makes any of those tasks cumbersome, simplify it.

The final result should feel like a **small companion tool I would genuinely keep open while playing**, rather than a database viewer.
