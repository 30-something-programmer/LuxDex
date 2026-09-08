Keep the current LuxDex visual design, navigation, colour palette, typography, island tabs, island map, bottom navigation, Pokémon state styling and overall layout.

Do **not** redesign the application.

This iteration is specifically about making the selected route feel spatial.

# Goal

When I select a route such as:

**Melemele → Route 1 (Hau'oli Outskirts)**

I do not want the encounter areas represented primarily as a long row of buttons such as:

Tall Grass
Short Grass
Surfing
Fishing
Zone 5
Zone 6
Zone 7
etc.

Instead, create a **stylised top-down route map** that represents the different encounter areas spatially.

The purpose is to answer:

**"Where on this route can I encounter these Pokémon?"**

---

# Route map

Add a large top-down schematic for the currently selected route.

It should occupy meaningful space in the centre of the page rather than leaving most of the screen empty.

Do not use a literal screenshot of Pokémon Ultra Sun / Ultra Moon.

Create a simplified, attractive, game-like route schematic inspired by Pokémon overworld maps.

For Route 1 this might visually contain elements such as:

* paths
* grass patches
* coastline / water
* buildings or landmarks where appropriate
* transitions to adjacent locations
* encounter areas

The map does not have to reproduce exact game geometry yet.

It should communicate **relative encounter zones** clearly.

---

# Encounter zones

Each encounter table should correspond to a selectable zone on the route map.

Where the encounter type is confidently known, label it naturally:

* Tall Grass
* Short Grass
* Surfing
* Fishing
* etc.

Where the source does not provide enough information to identify the physical area, do NOT invent a specific habitat.

Instead use neutral temporary labels:

* Area A
* Area B
* Area C
* etc.

Do not display:

* Table 5
* Table 6
* Zone 5
* Zone 6

as primary player-facing labels.

The raw table number may remain internally for data mapping.

---

# Pokémon displayed directly on the map

The map itself should show Pokémon sprites associated with the selected encounter zone.

For example, a grass patch may have several Pokémon sprites hovering around or above it.

Do not place every sprite directly on top of each other.

Use a compact arrangement around the zone.

The sprites should use the current discovery-state system:

### Unseen

Pokémon silhouette.

### Seen

Real sprite, faded/desaturated.

### Owned

Full-colour sprite with a small Poké Ball badge.

This status treatment must work directly on the route map.

---

# Interaction

Clicking an encounter zone should select it.

The selected zone should become visually highlighted.

When selected, show its encounter information in a compact panel beside or beneath the map:

* zone name
* Day / Night
* level range
* Pokémon
* encounter %
* Seen / Owned status
* SOS availability

Clicking a Pokémon sprite should open the existing Pokémon detail panel.

---

# Day / Night

Keep the existing Day / Night toggle.

Changing Day/Night should update the Pokémon visible on the route map.

If the encounter pool changes at night, the sprites displayed on the map should change appropriately.

---

# SOS

Do not clutter the normal route map with every SOS possibility.

Keep SOS as a secondary expandable mode.

When SOS is enabled, either:

* replace the displayed normal Pokémon with SOS-capable results

or

* add a clearly differentiated SOS overlay

Use the existing pink/coral SOS visual language.

Rare SOS results such as 1% encounters should stand out.

---

# Existing encounter grid

The current card grid can remain as a secondary detailed view.

However, the **route map should become the primary visual representation**.

A sensible layout would be:

```text
Island tabs

Island map / route navigation | Route title + Day/Night

                              [ ROUTE MAP ]

                              [ selected encounter-zone details ]

                              [ compact Pokémon grid / SOS ]
```

The exact arrangement can vary, but prioritise the spatial map.

---

# Remove the long zone-button strip

The current sequence:

Tall Grass | Short Grass | Surfing | Fishing | Zone 5 | Zone 6 | Zone 7 ...

takes too much horizontal space and exposes implementation detail.

Replace it with the interactive route map.

A small compact zone selector may remain as a fallback accessibility/navigation control, but it should not dominate the screen.

---

# Keep the island hierarchy

Retain the current navigation hierarchy:

**Island → Island map → Route → Route map → Encounter zone → Pokémon**

This is the intended LuxDex navigation model.

The small island map currently shown for Melemele should continue to select the route.

The new route map appears once the user has entered that route.

---

# Character

Make the route map feel like part of a Pokémon companion application.

Use:

* soft terrain shapes
* grass clusters
* water
* paths
* small landmarks
* subtle borders
* playful location markers
* compact Pokémon sprites

Avoid:

* GIS/map software styling
* real-world road-map styling
* business-dashboard diagrams
* plain rectangular boxes pretending to be a map

It should feel like a stylised handheld-game map.

---

# Important data constraint

Do not fabricate encounter relationships.

Use the encounter data already loaded by LuxDex.

The route map is a **presentation layer over the existing encounter tables**.

Where we do not yet know exactly where a table exists physically within the original game route, represent it as a neutral area on the schematic instead of claiming an exact location.

This first version is allowed to be a schematic.

---

# Success condition

For Route 1, I should be able to glance at the page and understand:

* what parts of the route contain encounters
* which Pokémon belong to each part
* what I have never seen
* what I have seen
* what I own
* where Surfing/Fishing encounters occur
* what changes between Day and Night

without needing to understand the underlying encounter-table numbers.

Implement this as an evolution of the current LuxDex screen, not a new design.
