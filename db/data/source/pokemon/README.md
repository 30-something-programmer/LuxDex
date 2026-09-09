# Pokémon source bundle

This directory preserves the minimal pinned donor inputs for the canonical Generation I–VII Pokémon master and local Ultra Sun/Ultra Moon sprites.

- `source-lock.json` is the authoritative acquisition manifest and records repository URLs, exact commits, acquisition date, source checksums, local sprite mappings, and explicitly missing form sprites.
- `pokeapi/8dfd1e309d4a1ca11f10b185412ed7dc8dd2b310/` contains the required unmodified PokeAPI CSV inputs and upstream licence.
- `pokeapi-sprites/712e6d9f915a1d2bdfbe991d04eea75e3ad950e7/` preserves the sprite donor licence.

Run `scripts/pull-pokemon-data.ps1` to reacquire and byte-verify the bundle. Runtime ingestion reads these committed files only; it never contacts upstream services. Derived canonical rows are loaded into PostgreSQL and are not written back over the donor files.
