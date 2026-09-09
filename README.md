# LuxDex

LuxDex is a LuxForge application whose backend publishes authoritative Penumbra encounter data and canonical Pokémon metadata to a presentation-only web client. The data flow is deliberately one way:

`preserved source/research data -> complete validation -> canonical mappings -> PostgreSQL -> repository/service layer -> read-only API`

The web application does not read, parse, or own canonical encounter data.

## MVP 0.1.0

The local-first MVP provides three player-facing workflows:

- **Areas** browses verified Penumbra locations, switches Day/Night and normal/SOS pools, and presents encounter rates, levels, and local sprites.
- **Pokémon Finder** searches canonical species and forms, then links each result to its grouped Penumbra occurrences.
- **Pokédex** browses the National or USUM Alola ordering with generation and collection filters.

Seen and Owned progress is persisted in PostgreSQL for the local profile and remains consistent across all three views. Canonical geography is intentionally partial: researched Melemele locations are available now, while islands without verified mappings display a mapping-in-progress state rather than fabricated places.

## Repository layout

- `app/` — FastAPI backend, ingestion and identity pipelines, repositories, services, and API routes.
- `web/` — standalone React/Vite frontend and local runtime assets. It owns presentation, not canonical data or persistence.
- `db/schema/` — authoritative, readable SQL schema inputs.
- `db/data/source/` — preserved authoritative raw datasets for later ingestion.
- `db/data/canonical/` — future derived/normalised SQL reference data that can be replayed into a rebuilt database.
- `docker/` — container builds, Compose configuration, and lifecycle commands.
- `build/` — canonical project metadata and the single `VERSION` file.
- `scripts/` — repeatable repository bootstrap and asset-acquisition utilities.
- `tests/` — backend and database integration tests; frontend tests live beside the React source under `web/src/`.
- `.venvs/app/` — ignored local Python environment created by the bootstrap script.
- `.dev/` — ignored scratch space.

Raw source files are retained unchanged so future ingestion can be replayed and traced. Derived data must live separately under `db/data/canonical/`; raw source files are never edited in place to resemble normalised data.

## Prerequisites

- Docker Desktop with Docker Compose
- PowerShell 7 or Windows PowerShell 5.1
- For local development: Python 3.11+ and Node.js 22+ with pnpm/Corepack

## Start with Docker

From PowerShell:

```powershell
.\docker\run.ps1 -Start
```

Running `.\docker\run.ps1` without arguments opens the lifecycle menu. The web UI is available at `http://localhost:52030`; the API is available at `http://localhost:52031`, including `GET /health`.

| Service | Container | Host port |
| --- | --- | --- |
| Web | `luxdex-web` | `52030` |
| API | `luxdex-app` | `52031` |
| PostgreSQL | `luxdex-db` | Not published |

All services communicate on the private `luxdex-internal` Docker network. Ports `52032`–`52039` remain reserved for future LuxDex services.

`Rebuild` rebuilds application images without Docker layer cache and restarts the stack while preserving the database volume and player collection. `Full Blowaway` removes only Compose resources belonging to LuxDex, including its database volume and service images, then rebuilds the schema, ingests both source datasets, builds their identity map, and publishes canonical geography before the API starts. Because the volume is deliberately destroyed, Full Blowaway recreates the `local` profile with an empty collection; mutable Seen/Owned state and its audit history are not seeded back. Normal startup is offline: each loader compares versioned source fingerprints and skips unchanged work.

## Penumbra data commands

After running `scripts/bootstrap.ps1`, validate the complete source without changing the database:

```powershell
.\scripts\validate-penumbra-data.ps1
```

Load the source into the Docker database, or skip it if the active source hash is unchanged:

```powershell
.\scripts\build-penumbra-data.ps1
```

The proof API exposes source metadata, raw map groups and locations, raw encounter tables with Day/Night pools, and raw Pokémon/form occurrence search:

- `GET /api/encounters/source`
- `GET /api/encounters/maps`
- `GET /api/encounters/maps/{map_group_id}`
- `GET /api/encounters/maps/{map_group_id}/tables`
- `GET /api/encounters/maps/{map_group_id}/tables/{table_number}`
- `GET /api/encounters/pokemon?name=Pichu`
- `GET /api/encounters/pokemon/rattata:alola`

## Pokémon master and identity mapping

The pinned Pokémon master and exact USUM sprite donor files are acquired explicitly with `scripts/pull-pokemon-data.ps1`; ordinary builds never download them. Validate or load the vendored dataset with:

```powershell
.\scripts\validate-pokemon-data.ps1
.\scripts\build-pokemon-data.ps1
```

Penumbra's literal `source_pokemon_name` is preserved. `scripts/build-penumbra-pokemon-map.ps1` derives a distinct raw-name inventory, applies deterministic exact matches and the reviewed exceptions in `db/data/canonical/identity/penumbra-pokemon-aliases.csv`, validates every target, and transactionally publishes only verified mappings. The complete generated audit is `db/data/canonical/identity/penumbra-pokemon-identity-report.json`.

Canonical Pokémon and mapping proof endpoints include:

- `GET /api/pokemon`
- `GET /api/pokemon/{canonical_key}`
- `GET /api/pokemon/{canonical_key}/forms`
- `GET /api/identity/penumbra`
- `GET /api/pokemon/search?q=Pichu`

## Canonical geography

Raw Penumbra map blocks and table numbers remain immutable implementation identities. The reviewed files under `db/data/canonical/geography/` separately map verified raw tables to backend-owned area groups, locations, encounter places, methods, and evidence. Unresolved tables remain absent from the mapping relation and are listed—without invented labels—in `geography-coverage-report.json`.

SciresM's vanilla Ultra Sun encounter dump is pinned beneath `db/data/source/usum/` as a structural research donor. Reproduce it explicitly with `scripts/pull-usum-geography-source.ps1`; normal builds never access the internet. Build or revalidate the geography transactionally with:

```powershell
.\scripts\build-geography.ps1
```

Proof endpoints are:

- `GET /api/geography/groups`
- `GET /api/geography/groups/{group_key}/locations`
- `GET /api/geography/locations/{location_key}`
- `GET /api/geography/locations/{location_key}/encounter-places`
- `GET /api/geography/encounter-places/{place_key}`

The frontend consumes two composed read models in addition to the proof endpoints:

- `GET /api/explore/areas/{group_key}/{location_key}` — verified places with Day/Night normal, SOS, and Additional SOS pools.
- `GET /api/explore/pokemon/{canonical_key}` — canonical form details and grouped player-facing Penumbra locations.

Areas, Pokémon Finder, and Pokédex use these APIs and the canonical Pokémon list directly. URL paths retain selected area/location or Pokémon form, sprites resolve only through backend-provided local asset paths, and loading/error/empty states never fall back to generated records.

## Local collection state

Seen/Owned progression is stored in PostgreSQL against the canonical Pokémon form and the bootstrapped `local` profile. A never-touched form has no state row and is Unseen. Advancing is strictly `Unseen → Seen → Owned`; advancing Owned is idempotent. The Pokémon detail panel provides deliberate downgrade/reset actions, and every actual transition writes an audit event in the same transaction as current state.

- `GET /api/collection` — all canonical forms with authoritative state.
- `GET /api/collection/summary` — exact form counts plus National and USUM Alola species counts.
- `GET /api/collection/{canonical_key}` — one form's state and historical timestamps.
- `POST /api/collection/{canonical_key}/advance` — forward-only quick progression.
- `PUT /api/collection/{canonical_key}` — explicit `unseen`, `seen`, or `owned` detail action.

Normal Stop, Start, Restart, and Rebuild operations preserve collection state because they retain `luxdex-db-data`. Full Blowaway intentionally deletes that volume, so it deletes mutable collection state and history while reconstructing canonical/reference datasets and the empty `local` profile. No Pokémon collection state is stored in browser storage.

## Local development

```powershell
.\scripts\bootstrap.ps1
.\.venvs\app\Scripts\python.exe -m uvicorn app.main:app --reload --port 52031
Set-Location web
pnpm dev
pnpm test
```

The Vite development server proxies `/api` to the local API. Use `VITE_API_BASE_URL` only when an explicit alternative API base is required. The workspace at `.vscode/luxdex.code-workspace` includes equivalent tasks.

The committed web fonts can be refreshed reproducibly from their pinned upstream revision with `.\scripts\pull-assets.ps1`. Normal UI rendering uses only local static assets.

## Release verification

Version `0.1.0` is sourced from `build/VERSION`. Before packaging a release, run the complete backend suite, frontend suite and production build, validate the Compose model, then perform a Full Blowaway to prove that schema creation and all canonical loaders remain replayable from the preserved source files. Full Blowaway intentionally resets the local collection profile.
