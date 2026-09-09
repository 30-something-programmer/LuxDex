# Database construction

PostgreSQL is constructed from repository source when its Docker volume is first created.

1. `schema/*.sql` is applied in lexical order. This raw SQL is authoritative for database objects.
2. `data/canonical/*.sql` is applied in lexical order to republish any derived/normalised SQL reference data.
3. Files under `data/source/` are preserved inputs and are never executed as SQL.
4. Before serving requests, the backend validates and loads Penumbra, then the pinned Pokémon master, then the deterministic identity map. Each stage is transactional and dependency ordered.

The bootstrap shell script lives at `docker/db/initdb/10-bootstrap.sh` and is run by the official PostgreSQL image. SQL files must be idempotent so the same publication logic can also be reused safely by later tooling.

The Penumbra schema is split by responsibility:

- `010_source_dataset.sql` records source identity, calculated metadata, parser version, and import time.
- `020_penumbra_maps.sql` preserves each ordered `Map:` block and every ordered raw map/location reference within it.
- `030_penumbra_encounters.sql` stores raw encounter tables, Day/Night normal and SOS pools, and literal raw Pokémon/form names with source-line provenance.
- `040_pokemon_master.sql` stores National/USUM Pokédex species, forms, source mappings, and exact local sprite metadata.
- `050_penumbra_pokemon_identity.sql` stores a complete raw-name inventory, verified mappings, build provenance, and the shared resolved-encounter projection.
- `090_indexes.sql` supports source, canonical identity, and Pokédex lookups.

`source_dataset` is the root of each rebuildable source graph. Replacing either dependency cascades its derived rows and identity build; startup then rebuilds the map. Loaders validate complete replacements before their short write transaction, so failures roll back to the previous active state. Unchanged fingerprints are skipped.

Application/user-generated records are persistent state and must remain conceptually distinct from rebuildable canonical reference data.
