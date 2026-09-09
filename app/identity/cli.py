"""Command-line entry point for the Penumbra Pokémon identity map."""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Sequence

from app.identity.penumbra import (
    DEFAULT_ALIAS_PATH,
    DEFAULT_REPORT_PATH,
    build_penumbra_pokemon_map,
)


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url")
    parser.add_argument("--aliases", type=Path, default=DEFAULT_ALIAS_PATH)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT_PATH)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_argument_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    result = build_penumbra_pokemon_map(
        arguments.database_url,
        arguments.aliases,
        arguments.report,
    )
    print(
        json.dumps(
            {
                "status": result.status,
                "build_id": result.build_id,
                "report_path": result.report_path,
                **result.summary,
                "unresolved_names": list(result.unresolved),
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
