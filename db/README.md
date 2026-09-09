# Database construction

PostgreSQL is constructed from repository source when its Docker volume is first created.

1. `schema/*.sql` is applied in lexical order. This raw SQL is authoritative for database objects.
2. `data/canonical/*.sql` is applied in lexical order to republish any derived/normalised SQL reference data.
3. Files under `data/source/` are preserved inputs and are never executed as SQL.
4. Before serving requests, the backend completely parses and validates the authoritative Penumbra source, then loads it transactionally when no matching active source hash exists.

The bootstrap shell script lives at `docker/db/initdb/10-bootstrap.sh` and is run by the official PostgreSQL image. SQL files must be idempotent so the same publication logic can also be reused safely by later tooling.

The Penumbra schema is split by responsibility:

- `010_source_dataset.sql` records source identity, calculated metadata, parser version, and import time.
- `020_penumbra_maps.sql` preserves each ordered `Map:` block and every ordered raw map/location reference within it.
- `030_penumbra_encounters.sql` stores raw encounter tables, Day/Night normal and SOS pools, and literal raw Pokémon/form names with source-line provenance.
- `090_indexes.sql` supports raw map-number, location-name, and Pokémon-name lookups.

`source_dataset` is the root of the rebuildable source graph. Deleting a replaced dataset cascades only through its map groups, locations, tables, pools, and encounters. The loader validates the complete replacement first and performs deletion plus reload in one transaction, so a failure rolls back to the previous active dataset. An unchanged SHA-256 is skipped; a changed source atomically replaces the single active Penumbra dataset.

Application/user-generated records are persistent state and must remain conceptually distinct from rebuildable canonical reference data.
