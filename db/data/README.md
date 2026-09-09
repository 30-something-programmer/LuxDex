# LuxDex data

- `source/` contains authoritative raw datasets and purposeful research donors preserved without content transformation. These files provide traceability back to their source form; pinned acquisition metadata lives beside them.
- `canonical/` contains reviewable derived inputs and generated audits kept separate from authoritative sources. Penumbra-to-Pokémon aliases live in `canonical/identity/`. Researched player-facing area groups, locations, encounter places, table mappings, and evidence live in `canonical/geography/`.

Do not edit raw source data to make it fit an application schema, and do not expose source files directly to the frontend. The backend must parse and validate the source completely before publishing relational data to PostgreSQL. Runtime queries use PostgreSQL, not these files or optional derived outputs.
