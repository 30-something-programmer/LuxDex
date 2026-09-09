# LuxDex data

- `source/` contains authoritative raw datasets preserved without content transformation. These files are ingestion inputs and provide traceability back to their source form.
- `canonical/` contains reviewable derived inputs and generated audits kept separate from authoritative sources. Penumbra-to-Pokémon aliases live in `canonical/identity/`; obvious mappings remain derived in code and are not duplicated there.

Do not edit raw source data to make it fit an application schema, and do not expose source files directly to the frontend. The backend must parse and validate the source completely before publishing relational data to PostgreSQL. Runtime queries use PostgreSQL, not these files or optional derived outputs.
