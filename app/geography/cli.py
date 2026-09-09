"""Command-line entry point for canonical geography population and coverage reporting."""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Sequence

from app.geography.loader import (
    DEFAULT_CANONICAL_DIRECTORY,
    DEFAULT_REPORT_PATH,
    DEFAULT_SOURCE_LOCK_PATH,
    DEFAULT_VANILLA_SOURCE_PATH,
    build_geography,
)


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url")
    parser.add_argument("--canonical-directory", type=Path, default=DEFAULT_CANONICAL_DIRECTORY)
    parser.add_argument("--vanilla-source", type=Path, default=DEFAULT_VANILLA_SOURCE_PATH)
    parser.add_argument("--source-lock", type=Path, default=DEFAULT_SOURCE_LOCK_PATH)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT_PATH)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_argument_parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    result = build_geography(
        arguments.database_url,
        arguments.canonical_directory,
        arguments.vanilla_source,
        arguments.source_lock,
        arguments.report,
    )
    print(
        json.dumps(
            {
                "status": result.status,
                "build_id": result.build_id,
                "report_path": result.report_path,
                **result.summary,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
