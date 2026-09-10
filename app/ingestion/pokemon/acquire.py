"""Acquire the minimal pinned PokéAPI taxonomy data.

Sprite art is handled separately: it is vendored locally by a maintainer rather
than acquired from a live git donor. See
db/data/source/pokemon/local-sprite-vendor/PROVENANCE.md and
app/ingestion/pokemon/vendor_local_sprites.py.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Sequence

from app.ingestion.pokemon.source_config import (
    ACQUISITION_DATE,
    DATA_COMMIT_SHA,
    DATA_PATHS,
    DATA_REPOSITORY,
    REPOSITORY_ROOT,
    SOURCE_LOCK_PATH,
    TARGET_NATIONAL_MAX,
    data_destination,
)


class PokemonAcquisitionError(RuntimeError):
    pass


def _run(arguments: list[str], cwd: Path | None = None, input_text: str | None = None) -> str:
    completed = subprocess.run(
        arguments,
        cwd=cwd,
        input=input_text,
        text=True,
        encoding="utf-8",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode:
        command = " ".join(arguments[:3])
        raise PokemonAcquisitionError(
            f"command failed ({command}): {completed.stderr.strip()}"
        )
    return completed.stdout


def _checkout_sparse(repository: str, commit_sha: str, paths: Sequence[str], target: Path) -> None:
    _run(["git", "init", "--quiet", str(target)])
    _run(["git", "remote", "add", "origin", repository], cwd=target)
    _run(["git", "config", "core.sparseCheckout", "true"], cwd=target)
    sparse_file = target / ".git" / "info" / "sparse-checkout"
    sparse_file.write_text("".join(f"/{path}\n" for path in paths), encoding="utf-8")
    _run(["git", "fetch", "--quiet", "--depth", "1", "origin", commit_sha], cwd=target)
    _run(["git", "checkout", "--quiet", "--detach", "FETCH_HEAD"], cwd=target)
    actual_commit = _run(["git", "rev-parse", "HEAD"], cwd=target).strip()
    if actual_commit != commit_sha:
        raise PokemonAcquisitionError(
            f"expected commit {commit_sha}, checked out {actual_commit} from {repository}"
        )


def _csv_rows(root: Path, relative_path: str) -> list[dict[str, str]]:
    with (root / relative_path).open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def select_target_forms(
    data_root: Path,
) -> list[tuple[dict[str, str], dict[str, str], dict[str, str]]]:
    species = {
        int(row["id"]): row
        for row in _csv_rows(data_root, "data/v2/csv/pokemon_species.csv")
    }
    pokemon = {
        int(row["id"]): row for row in _csv_rows(data_root, "data/v2/csv/pokemon.csv")
    }
    version_groups = _csv_rows(data_root, "data/v2/csv/version_groups.csv")
    usum_rows = [row for row in version_groups if row["identifier"] == "ultra-sun-ultra-moon"]
    if len(usum_rows) != 1:
        raise PokemonAcquisitionError("expected exactly one Ultra Sun/Ultra Moon version group")
    usum_order = int(usum_rows[0]["order"])
    version_orders = {int(row["id"]): int(row["order"]) for row in version_groups}

    target: list[tuple[dict[str, str], dict[str, str], dict[str, str]]] = []
    for form in _csv_rows(data_root, "data/v2/csv/pokemon_forms.csv"):
        pokemon_row = pokemon[int(form["pokemon_id"])]
        species_row = species[int(pokemon_row["species_id"])]
        introduced_group = int(form["introduced_in_version_group_id"])
        if (
            int(species_row["id"]) <= TARGET_NATIONAL_MAX
            and version_orders[introduced_group] <= usum_order
        ):
            target.append((form, pokemon_row, species_row))
    return target


def build_form_key(
    form: dict[str, str],
    pokemon: dict[str, str],
    species: dict[str, str],
) -> str:
    is_default = pokemon["is_default"] == "1" and form["is_default"] == "1"
    if is_default:
        return species["identifier"]
    form_identifier = form["form_identifier"]
    if not form_identifier:
        raise PokemonAcquisitionError(
            f"non-default form {form['id']} has no stable upstream form identifier"
        )
    return f"{species['identifier']}:{form_identifier}"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as source:
        header = source.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise PokemonAcquisitionError(f"not a valid PNG with an IHDR header: {path}")
    return struct.unpack(">II", header[16:24])


def _file_record(
    stage_root: Path,
    component: str,
    role: str,
    source_path: str,
    destination_path: Path,
) -> dict[str, Any]:
    source = stage_root / source_path
    return {
        "source_component": component,
        "source_role": role,
        "source_path": source_path,
        "destination_path": destination_path.relative_to(REPOSITORY_ROOT).as_posix(),
        "sha256": _sha256(source),
        "byte_count": source.stat().st_size,
    }


def _build_data_lock(data_stage: Path) -> dict[str, Any]:
    """Build the taxonomy-data half of the lock (data_source + files).

    The sprite half (sprite_source/sprites/missing_sprites) is owned by
    vendor_local_sprites.py and is left untouched here.
    """
    files = [
        _file_record(
            data_stage,
            "pokeapi-data",
            "license" if path == "LICENSE.md" else "data",
            path,
            data_destination(path),
        )
        for path in DATA_PATHS
    ]
    return {
        "format_version": 1,
        "acquisition_date": ACQUISITION_DATE,
        "data_source": {"repository": DATA_REPOSITORY, "commit_sha": DATA_COMMIT_SHA},
        "files": files,
    }


def _publish_data(lock: dict[str, Any], data_stage: Path) -> None:
    for row in lock["files"]:
        source = data_stage / row["source_path"]
        destination = REPOSITORY_ROOT / row["destination_path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)


def _read_existing_lock() -> dict[str, Any] | None:
    if not SOURCE_LOCK_PATH.exists():
        return None
    return json.loads(SOURCE_LOCK_PATH.read_text(encoding="utf-8"))


def acquire(create_lock: bool = False) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="luxdex-pokemon-") as temporary_directory:
        temporary_root = Path(temporary_directory)
        data_stage = temporary_root / "pokeapi"
        _checkout_sparse(DATA_REPOSITORY, DATA_COMMIT_SHA, DATA_PATHS, data_stage)
        candidate_data_lock = _build_data_lock(data_stage)
        existing_lock = _read_existing_lock()
        sprite_section = {
            key: (existing_lock or {}).get(key, default)
            for key, default in (
                ("sprite_source", {}),
                ("sprites", []),
                ("missing_sprites", []),
            )
        }
        candidate_lock = {**candidate_data_lock, **sprite_section}

        if create_lock:
            SOURCE_LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
            SOURCE_LOCK_PATH.write_text(
                json.dumps(candidate_lock, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
        else:
            if existing_lock is None:
                raise PokemonAcquisitionError(
                    f"source lock is missing: {SOURCE_LOCK_PATH}; a deliberate maintainer update is required"
                )
            expected_data_lock = {
                key: existing_lock[key]
                for key in ("format_version", "acquisition_date", "data_source", "files")
            }
            if candidate_data_lock != expected_data_lock:
                raise PokemonAcquisitionError(
                    "pinned taxonomy donor content differs from source-lock.json; refusing to publish"
                )

        _publish_data(candidate_lock, data_stage)
        return {
            "data_commit_sha": DATA_COMMIT_SHA,
            "source_files": len(candidate_lock["files"]),
            "local_sprites": len(candidate_lock.get("sprites", [])),
            "missing_sprites": len(candidate_lock.get("missing_sprites", [])),
        }


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--create-lock",
        action="store_true",
        help="maintainer-only: replace the checksum lock for the pinned revisions",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_argument_parser().parse_args(argv)
    print(json.dumps(acquire(arguments.create_lock), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
