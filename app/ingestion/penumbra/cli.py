"""Command-line entry points backed by the reusable Penumbra ingestion code."""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Sequence

from app.ingestion.penumbra.loader import DEFAULT_SOURCE_PATH, ensure_penumbra_dataset
from app.ingestion.penumbra.parser import parse_source
from app.ingestion.penumbra.validator import validate_dataset


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate or load Penumbra encounter source data")
    parser.add_argument(
        "command",
        choices=("validate", "load"),
        help="validate the source only, or validate and transactionally load PostgreSQL",
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_PATH)
    parser.add_argument("--database-url", help="override DATABASE_URL for the load command")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    if args.command == "validate":
        counts = validate_dataset(parse_source(args.source))
        print(json.dumps({"status": "valid", "counts": counts.to_dict()}, indent=2))
        return 0

    result = ensure_penumbra_dataset(args.database_url, args.source)
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
