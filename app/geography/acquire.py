"""Reproducibly acquire the pinned vanilla Ultra Sun encounter-table donor."""

from __future__ import annotations

import argparse
import hashlib
import subprocess
import tempfile
from pathlib import Path
from typing import Sequence

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SOURCE_REPOSITORY = "https://gist.github.com/a539739085e24af55dffdf443cb70eb2.git"
SOURCE_COMMIT = "e9f9a551a7ad34a66f6812aa77e526cd21ee79f3"
SOURCE_FILENAME = "Pokemon Ultra Sun - Encounter Tables.txt"
SOURCE_SHA256 = "80a4f0e768c4d4dcfdc0dd11b1dceae0d94049cba1cfb25c817cecbdb8a724e8"
DEFAULT_DESTINATION = (
    REPOSITORY_ROOT
    / "db"
    / "data"
    / "source"
    / "usum"
    / "vanilla-encounters"
    / SOURCE_COMMIT
    / SOURCE_FILENAME
)


class GeographySourceAcquisitionError(RuntimeError):
    """Raised when the pinned donor cannot be reproduced exactly."""


def _run_git(*arguments: str, cwd: Path | None = None) -> str:
    result = subprocess.run(
        ["git", *arguments],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def acquire_vanilla_encounters(destination: Path = DEFAULT_DESTINATION) -> Path:
    """Clone the pinned gist, verify its identity, and preserve its exact bytes."""

    with tempfile.TemporaryDirectory(prefix="luxdex-usum-") as temporary_directory:
        checkout = Path(temporary_directory) / "source"
        _run_git("clone", "--quiet", SOURCE_REPOSITORY, str(checkout))
        _run_git("checkout", "--quiet", SOURCE_COMMIT, cwd=checkout)
        resolved_commit = _run_git("rev-parse", "HEAD", cwd=checkout)
        if resolved_commit != SOURCE_COMMIT:
            raise GeographySourceAcquisitionError(
                f"expected donor commit {SOURCE_COMMIT}, got {resolved_commit}"
            )

        source_path = checkout / SOURCE_FILENAME
        source_bytes = source_path.read_bytes()
        actual_sha256 = hashlib.sha256(source_bytes).hexdigest()
        if actual_sha256 != SOURCE_SHA256:
            raise GeographySourceAcquisitionError(
                f"expected donor SHA-256 {SOURCE_SHA256}, got {actual_sha256}"
            )

        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(source_bytes)

    return destination


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", type=Path, default=DEFAULT_DESTINATION)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_argument_parser().parse_args(argv)
    path = acquire_vanilla_encounters(arguments.destination)
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
