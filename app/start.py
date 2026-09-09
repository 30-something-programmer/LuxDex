"""Container/local startup that ensures canonical data before serving the API."""

from __future__ import annotations

import logging

import uvicorn

from app.geography.loader import build_geography
from app.identity.penumbra import build_penumbra_pokemon_map
from app.ingestion.penumbra.loader import ensure_penumbra_dataset
from app.ingestion.pokemon.loader import ensure_pokemon_dataset


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    ensure_penumbra_dataset()
    ensure_pokemon_dataset()
    build_penumbra_pokemon_map()
    build_geography()
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
