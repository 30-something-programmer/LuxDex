# Database construction

PostgreSQL is constructed from repository source when its Docker volume is first created.

1. `schema/*.sql` is applied in lexical order. This raw SQL is authoritative for database objects.
2. `data/canonical/*.sql` is applied in lexical order to republish derived/normalised canonical reference data.
3. Files under `data/source/` are preserved inputs only and are never executed by the bootstrap process.

The bootstrap shell script lives at `docker/db/initdb/10-bootstrap.sh` and is run by the official PostgreSQL image. SQL files must be idempotent so the same publication logic can also be reused safely by later tooling.

Application/user-generated records are persistent state and must remain conceptually distinct from rebuildable canonical reference data.

