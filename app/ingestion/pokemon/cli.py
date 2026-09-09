"""Command-line entry points for Pokémon source validation and population."""

from __future__ import annotations

import argparse
import json
import logging
from typing import Sequence

from app.ingestion.pokemon.loader import ensure_pokemon_dataset
from app.ingestion.pokemon.parser import parse_pokemon_source
from app.ingestion.pokemon.validator import validate_pokemon_dataset


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "load"))
    parser.add_argument("--database-url", help="override DATABASE_URL for the load command")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_argument_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    if arguments.command == "validate":
        counts = validate_pokemon_dataset(parse_pokemon_source())
        print(json.dumps({"status": "valid", "counts": counts.to_dict()}, indent=2))
        return 0

    result = ensure_pokemon_dataset(arguments.database_url)
    print(
        json.dumps(
            {
                "status": result.status,
                "dataset_id": result.dataset_id,
                "counts": result.counts.to_dict(),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

