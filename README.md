# LuxDex

LuxDex is a LuxForge application whose backend publishes authoritative Penumbra encounter data to a presentation-only web client. The data flow is deliberately one way:

`raw Penumbra source -> complete parse and validation -> PostgreSQL -> repository/service layer -> read-only API`

The web application does not read, parse, or own canonical encounter data.

## Repository layout

- `app/` — FastAPI backend, Penumbra ingestion pipeline, repositories, services, and API routes.
- `web/` — standalone React/Vite frontend and local runtime assets. It owns presentation, not canonical data or persistence.
- `db/schema/` — authoritative, readable SQL schema inputs.
- `db/data/source/` — preserved authoritative raw datasets for later ingestion.
- `db/data/canonical/` — future derived/normalised SQL reference data that can be replayed into a rebuilt database.
- `docker/` — container builds, Compose configuration, and lifecycle commands.
- `build/` — canonical project metadata and the single `VERSION` file.
- `scripts/` — repeatable repository bootstrap and asset-acquisition utilities.
- `tests/` — backend tests.
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

`Rebuild` rebuilds application images without Docker layer cache and restarts the stack while preserving the database volume. `Full Blowaway` removes only Compose resources belonging to LuxDex, including its database volume and service images, then rebuilds the schema and ingests the Penumbra source before the API starts. On normal startup, the backend compares the source SHA-256 with the active dataset and skips parsing when it is unchanged.

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

## Local development

```powershell
.\scripts\bootstrap.ps1
.\.venvs\app\Scripts\python.exe -m uvicorn app.main:app --reload --port 52031
Set-Location web
pnpm dev
```

The Vite development server proxies `/api` to the local API. Use `VITE_API_BASE_URL` only when an explicit alternative API base is required. The workspace at `.vscode/luxdex.code-workspace` includes equivalent tasks.

The committed web fonts can be refreshed reproducibly from their pinned upstream revision with `.\scripts\pull-assets.ps1`. Normal UI rendering uses only local static assets.
