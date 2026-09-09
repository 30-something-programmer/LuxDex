"""Container/local startup that ensures canonical data before serving the API."""

from __future__ import annotations

import logging

import uvicorn

from app.geography.loader import build_geography
from app.identity.penumbra import build_penumbra_pokemon_map
from app.ingestion.penumbra.loader import ensure_penumbra_dataset
from app.ingestion.pokemon.loader import ensure_pokemon_dataset
from app.schema import ensure_runtime_schema


class _HealthAccessFilter(logging.Filter):
    """Keep frequent container probes out of otherwise useful access logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        arguments = record.args
        return not (
            isinstance(arguments, tuple)
            and len(arguments) >= 3
            and arguments[2] in {"/health", "/api/health"}
        )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    logging.getLogger("uvicorn.access").addFilter(_HealthAccessFilter())
    ensure_runtime_schema()
    ensure_penumbra_dataset()
    ensure_pokemon_dataset()
    build_penumbra_pokemon_map()
    build_geography()
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
