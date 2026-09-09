# Contributing to LuxDex

Keep the repository contract intact:

- The repository root contains only `.gitignore`, `README.md`, `CONTRIBUTING.md`, and directories.
- `web/` is presentation and interaction only. It must not read raw source files or own canonical encounters, parsers, location mappings, Pokédex records, business rules, or application persistence.
- `app/` owns ingestion, validation, identity resolution, database access, API, and backend application logic. Runtime encounter reads go through PostgreSQL repositories/services rather than source files.
- `db/schema/` contains the authoritative raw SQL used to construct database objects.
- `db/data/source/` preserves authoritative inputs unchanged. Derived or normalised canonical data belongs separately under `db/data/canonical/` and is republished on database rebuild.
- Penumbra identity aliases belong only in `db/data/canonical/identity/`. Add an entry only when exact/benign-normalised matching is unsafe, name the canonical form key explicitly, and explain the evidence.
- Researched geography belongs only in `db/data/canonical/geography/`. A verified raw-table mapping must cite the pinned structural donor and a source that supports its player-facing place or method. Leave unsupported tables unresolved; never canonicalise `Table N`, `Zone N`, or similar placeholders.
- Map Studio geometry and sprite placement are presentation data under the `map_presentation_*` tables, seeded from `db/data/canonical/presentation/`. They may reference canonical keys but must never redefine encounter membership, rates, levels, time pools, or SOS truth.
- Do not add fabricated or demo canonical data to the frontend to compensate for an API that has not been built.
- Do not add Figma Make runtime dependencies, metadata, preview hooks, or generated mock persistence.
- Normal rendering must not depend on third-party static-asset hosts. Commit redistributable assets locally and keep their acquisition reproducible under `scripts/`; document assets that cannot legally be bundled.
- Docker containers, images, volumes, and other project-owned resources use the `luxdex-` prefix. Destructive Docker commands must target LuxDex resources only.
- Host ports must stay within the reserved `52030`–`52039` range. PostgreSQL remains unexposed unless development requires a port in that range.
- `build/VERSION` is the single application version source. Build metadata stays under `build/`.
- Python virtual environments belong under `.venvs/`, with the backend environment at `.venvs/app/`.

Before submitting a change, run `.\scripts\test.ps1 -All` (backend unit tests, backend database integration tests, and frontend tests), build the production frontend, validate Compose configuration, and verify that no remote runtime asset URLs or frontend-owned canonical data were introduced. For release changes, also run a Full Blowaway and confirm the clean stack reconstructs all canonical data from preserved sources; this deliberately resets local Seen/Owned state.

Database-backed backend tests live beside the others in `tests/app/` and are skipped unless `TEST_DATABASE_URL` is set; `.\scripts\test.ps1 -Integration` supplies it by running them inside a disposable container on `luxdex-internal` (`docker/test/Dockerfile`). PostgreSQL stays off the host network — do not add a published port as a substitute. Each database-backed test class provisions and drops its own `luxdex_test_*` database against `luxdex-db`; never point a test at the live `luxdex` database or weaken its constraints to make a test pass.
