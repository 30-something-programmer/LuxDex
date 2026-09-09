# LuxDex

LuxDex is a LuxForge application whose future backend will publish Penumbra encounter and Pokédex data to a presentation-only web client. Pass 1 establishes the development, build, database, and Docker foundations; it intentionally contains no encounter parser or product dataset API.

## Repository layout

- `app/` — FastAPI backend. `GET /health` is the only endpoint in this pass.
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

`Rebuild` rebuilds application images without Docker layer cache and restarts the stack while preserving the database volume. `Full Blowaway` removes only Compose resources belonging to LuxDex, including its database volume and service images, then rebuilds and replays schema and canonical SQL data from repository source.

## Local development

```powershell
.\scripts\bootstrap.ps1
.\.venvs\app\Scripts\python.exe -m uvicorn app.main:app --reload --port 52031
Set-Location web
pnpm dev
```

The Vite development server proxies `/api` to the local API. Use `VITE_API_BASE_URL` only when an explicit alternative API base is required. The workspace at `.vscode/luxdex.code-workspace` includes equivalent tasks.

The committed web fonts can be refreshed reproducibly from their pinned upstream revision with `.\scripts\pull-assets.ps1`. Normal UI rendering uses only local static assets.
