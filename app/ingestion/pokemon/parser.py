"""Parse and verify the pinned PokéAPI master-data and sprite lock."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import struct
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

from app.ingestion.pokemon.acquire import build_form_key, select_target_forms
from app.ingestion.pokemon.models import (
    MissingSprite,
    ParsedPokemonDataset,
    Pokedex,
    PokedexEntry,
    PokemonForm,
    PokemonSourceMetadata,
    PokemonSpecies,
    SourceFile,
    SpriteAsset,
)
from app.ingestion.pokemon.source_config import (
    ACQUISITION_DATE,
    DATA_COMMIT_SHA,
    DATA_PATHS,
    DATA_REPOSITORY,
    REPOSITORY_ROOT,
    SOURCE_LOCK_PATH,
    SOURCE_ROOT,
    SPRITE_DESTINATION,
    SPRITE_LICENSE_PATH,
    TARGET_NATIONAL_MAX,
    TARGET_POKEDEXES,
)

PARSER_VERSION = "1.0.0"
SOURCE_NAME = "pokemon-master-usum"
_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
_LOCAL_SPRITE_PATTERN = re.compile(r"^/assets/pokemon/sprites/[a-z0-9][a-z0-9-]*[.]png$")


class PokemonParseError(ValueError):
    pass


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
        raise PokemonParseError(f"invalid local PNG: {path}")
    return struct.unpack(">II", header[16:24])


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def _require_mapping(value: object, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise PokemonParseError(f"{context} must be a JSON object")
    return value


def _require_list(value: object, context: str) -> list[Any]:
    if not isinstance(value, list):
        raise PokemonParseError(f"{context} must be a JSON array")
    return value


def _resolve_repository_path(relative_path: str) -> Path:
    candidate = (REPOSITORY_ROOT / relative_path).resolve()
    repository_root = REPOSITORY_ROOT.resolve()
    if candidate != repository_root and repository_root not in candidate.parents:
        raise PokemonParseError(f"source lock path escapes the repository: {relative_path}")
    return candidate


def _verify_source_files(lock: dict[str, Any]) -> tuple[SourceFile, ...]:
    raw_files = _require_list(lock.get("files"), "files")
    expected_paths = set(DATA_PATHS)
    actual_paths = {str(_require_mapping(row, "file").get("source_path")) for row in raw_files}
    if actual_paths != expected_paths or len(raw_files) != len(expected_paths):
        raise PokemonParseError("source lock does not contain exactly the required donor files")

    source_files: list[SourceFile] = []
    for source_order, raw_row in enumerate(raw_files, start=1):
        row = _require_mapping(raw_row, f"files[{source_order - 1}]")
        destination_path = str(row.get("destination_path", ""))
        local_file = _resolve_repository_path(destination_path)
        if not local_file.is_file():
            raise PokemonParseError(f"required donor file is missing: {destination_path}")
        expected_sha = str(row.get("sha256", ""))
        if not _SHA256_PATTERN.fullmatch(expected_sha):
            raise PokemonParseError(f"invalid source checksum in lock: {destination_path}")
        actual_sha = _sha256(local_file)
        if actual_sha != expected_sha:
            raise PokemonParseError(
                f"checksum mismatch for {destination_path}: expected {expected_sha}, found {actual_sha}"
            )
        actual_size = local_file.stat().st_size
        expected_size = int(row.get("byte_count", -1))
        if actual_size != expected_size:
            raise PokemonParseError(
                f"byte-count mismatch for {destination_path}: expected {expected_size}, found {actual_size}"
            )
        source_files.append(
            SourceFile(
                source_order=source_order,
                source_component=str(row["source_component"]),  # type: ignore[arg-type]
                source_role=str(row["source_role"]),  # type: ignore[arg-type]
                source_path=str(row["source_path"]),
                destination_path=destination_path,
                sha256=expected_sha,
                byte_count=expected_size,
            )
        )
    return tuple(source_files)


def _verify_sprites(
    lock: dict[str, Any],
) -> tuple[dict[str, SpriteAsset], tuple[MissingSprite, ...]]:
    raw_sprites = _require_list(lock.get("sprites"), "sprites")
    sprites: dict[str, SpriteAsset] = {}
    expected_filenames: set[str] = set()
    for index, raw_row in enumerate(raw_sprites):
        row = _require_mapping(raw_row, f"sprites[{index}]")
        form_key = str(row.get("form_key", ""))
        local_path = str(row.get("local_path", ""))
        if form_key in sprites:
            raise PokemonParseError(f"duplicate sprite form key: {form_key}")
        if not _LOCAL_SPRITE_PATTERN.fullmatch(local_path):
            raise PokemonParseError(f"sprite path is not a safe local runtime URL: {local_path}")
        filename = Path(local_path).name
        local_file = SPRITE_DESTINATION / filename
        if not local_file.is_file():
            raise PokemonParseError(f"local sprite is missing: {local_path}")
        expected_sha = str(row.get("sha256", ""))
        if _sha256(local_file) != expected_sha:
            raise PokemonParseError(f"local sprite checksum mismatch: {local_path}")
        expected_size = int(row.get("byte_count", -1))
        if local_file.stat().st_size != expected_size:
            raise PokemonParseError(f"local sprite byte-count mismatch: {local_path}")
        dimensions = _png_dimensions(local_file)
        expected_dimensions = (int(row.get("width", 0)), int(row.get("height", 0)))
        if dimensions != expected_dimensions:
            raise PokemonParseError(f"local sprite dimensions differ from lock: {local_path}")
        expected_filenames.add(filename)
        sprite_family = str(row.get("sprite_family", ""))
        if not sprite_family.strip():
            raise PokemonParseError(f"sprite lock row is missing sprite_family: {form_key}")
        sprites[form_key] = SpriteAsset(
            form_key=form_key,
            sprite_family=sprite_family,
            local_path=local_path,
            upstream_path=str(row["upstream_path"]),
            sha256=expected_sha,
            byte_count=expected_size,
            width=dimensions[0],
            height=dimensions[1],
        )

    local_filenames = {path.name for path in SPRITE_DESTINATION.glob("*.png")}
    if local_filenames != expected_filenames:
        extra = sorted(local_filenames - expected_filenames)
        missing = sorted(expected_filenames - local_filenames)
        raise PokemonParseError(
            f"local sprite directory differs from lock; extra={extra[:10]}, missing={missing[:10]}"
        )

    raw_missing = _require_list(lock.get("missing_sprites"), "missing_sprites")
    missing_sprites = tuple(
        MissingSprite(
            form_key=str(_require_mapping(row, "missing sprite")["form_key"]),
            reason=str(_require_mapping(row, "missing sprite")["reason"]),
            checked_paths=tuple(
                str(path)
                for path in _require_list(
                    _require_mapping(row, "missing sprite")["checked_paths"],
                    "checked_paths",
                )
            ),
        )
        for row in raw_missing
    )
    return sprites, missing_sprites


def _display_name(
    species_name: str,
    form_identifier: str,
    english_form_name: dict[str, str] | None,
    is_default: bool,
) -> tuple[str, str]:
    if english_form_name and english_form_name["pokemon_name"]:
        return english_form_name["pokemon_name"], "pokemon_form_name"
    if is_default:
        return species_name, "species_name"
    if english_form_name and english_form_name["form_name"]:
        return f"{species_name} ({english_form_name['form_name']})", "form_name"
    readable_identifier = form_identifier.replace("-", " ").title()
    return f"{species_name} ({readable_identifier})", "derived_form_identifier"


def parse_pokemon_source(lock_path: Path = SOURCE_LOCK_PATH) -> ParsedPokemonDataset:
    raw_manifest = lock_path.read_bytes()
    try:
        lock = _require_mapping(json.loads(raw_manifest.decode("utf-8")), "source lock")
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PokemonParseError(f"invalid UTF-8 JSON source lock: {error}") from error

    data_source = _require_mapping(lock.get("data_source"), "data_source")
    sprite_source = _require_mapping(lock.get("sprite_source"), "sprite_source")
    if lock.get("format_version") != 1:
        raise PokemonParseError("unsupported source-lock format version")
    if data_source != {"repository": DATA_REPOSITORY, "commit_sha": DATA_COMMIT_SHA}:
        raise PokemonParseError("data source provenance differs from the pinned configuration")
    if not str(sprite_source.get("repository", "")).strip():
        raise PokemonParseError("sprite_source.repository must be present and non-blank")
    if lock.get("acquisition_date") != ACQUISITION_DATE:
        raise PokemonParseError("source acquisition date differs from the pinned configuration")

    source_files = _verify_source_files(lock)
    sprites, missing_sprites = _verify_sprites(lock)
    file_paths = {
        source_file.source_path: _resolve_repository_path(source_file.destination_path)
        for source_file in source_files
    }
    csv_root = file_paths["data/v2/csv/pokemon_species.csv"].parents[0]

    languages = _read_csv(csv_root / "languages.csv")
    english_rows = [row for row in languages if row["identifier"] == "en"]
    if len(english_rows) != 1:
        raise PokemonParseError("expected one English language row")
    english_language_id = int(english_rows[0]["id"])

    species_rows = _read_csv(csv_root / "pokemon_species.csv")
    species_names = {
        int(row["pokemon_species_id"]): row["name"]
        for row in _read_csv(csv_root / "pokemon_species_names.csv")
        if int(row["local_language_id"]) == english_language_id
    }
    pokemon_rows = {int(row["id"]): row for row in _read_csv(csv_root / "pokemon.csv")}
    form_name_rows = {
        int(row["pokemon_form_id"]): row
        for row in _read_csv(csv_root / "pokemon_form_names.csv")
        if int(row["local_language_id"]) == english_language_id
    }
    pokedex_rows = {int(row["id"]): row for row in _read_csv(csv_root / "pokedexes.csv")}
    pokedex_names = {
        int(row["pokedex_id"]): row["name"]
        for row in _read_csv(csv_root / "pokedex_prose.csv")
        if int(row["local_language_id"]) == english_language_id
    }
    dex_rows = _read_csv(csv_root / "pokemon_dex_numbers.csv")
    national_numbers = {
        int(row["species_id"]): int(row["pokedex_number"])
        for row in dex_rows
        if int(row["pokedex_id"]) == 1 and int(row["pokedex_number"]) <= TARGET_NATIONAL_MAX
    }
    target_species_rows = {
        int(row["id"]): row
        for row in species_rows
        if int(row["id"]) in national_numbers
    }

    forms_by_species: dict[int, list[PokemonForm]] = {
        species_id: [] for species_id in target_species_rows
    }
    for form_row, pokemon_row, species_row in select_target_forms(csv_root.parents[2]):
        species_id = int(species_row["id"])
        if species_id not in target_species_rows:
            continue
        is_default = pokemon_row["is_default"] == "1" and form_row["is_default"] == "1"
        form_key = build_form_key(form_row, pokemon_row, species_row)
        display_name, display_name_source = _display_name(
            species_names[species_id],
            form_row["form_identifier"],
            form_name_rows.get(int(form_row["id"])),
            is_default,
        )
        is_regional = form_row["form_identifier"] == "alola"
        forms_by_species[species_id].append(
            PokemonForm(
                form_key=form_key,
                identifier=form_row["identifier"],
                display_name=display_name,
                display_name_source=display_name_source,  # type: ignore[arg-type]
                is_default=is_default,
                form_order=int(form_row["form_order"]),
                is_battle_only=form_row["is_battle_only"] == "1",
                is_mega=form_row["is_mega"] == "1",
                is_regional=is_regional,
                regional_name="Alola" if is_regional else None,
                sprite_key=form_key,
                upstream_pokemon_id=int(pokemon_row["id"]),
                upstream_form_id=int(form_row["id"]),
                upstream_pokemon_identifier=pokemon_row["identifier"],
                upstream_form_identifier=form_row["form_identifier"] or None,
                introduced_version_group_id=int(form_row["introduced_in_version_group_id"]),
                sprite=sprites.get(form_key),
            )
        )

    species = tuple(
        PokemonSpecies(
            national_dex_number=national_numbers[species_id],
            identifier=row["identifier"],
            display_name=species_names[species_id],
            generation=int(row["generation_id"]),
            is_active=True,
            upstream_species_id=species_id,
            upstream_identifier=row["identifier"],
            forms=tuple(
                sorted(
                    forms_by_species[species_id],
                    key=lambda form: (not form.is_default, form.form_order, form.form_key),
                )
            ),
        )
        for species_id, row in sorted(
            target_species_rows.items(), key=lambda item: national_numbers[item[0]]
        )
    )

    species_identifier_by_id = {
        species_item.upstream_species_id: species_item.identifier for species_item in species
    }
    pokedexes: list[Pokedex] = []
    for upstream_id, (dex_key, is_in_game) in TARGET_POKEDEXES.items():
        upstream = pokedex_rows.get(upstream_id)
        if upstream is None:
            raise PokemonParseError(f"required Pokédex {upstream_id} is missing")
        entries = tuple(
            sorted(
                (
                    PokedexEntry(
                        species_identifier=species_identifier_by_id[int(row["species_id"])],
                        dex_number=int(row["pokedex_number"]),
                    )
                    for row in dex_rows
                    if int(row["pokedex_id"]) == upstream_id
                    and int(row["species_id"]) in species_identifier_by_id
                ),
                key=lambda entry: entry.dex_number,
            )
        )
        pokedexes.append(
            Pokedex(
                dex_key=dex_key,
                display_name=pokedex_names[upstream_id],
                upstream_pokedex_id=upstream_id,
                is_in_game=is_in_game,
                entries=entries,
            )
        )

    form_keys = {form.form_key for item in species for form in item.forms}
    locked_keys = set(sprites) | {missing.form_key for missing in missing_sprites}
    if form_keys != locked_keys:
        raise PokemonParseError(
            "sprite lock coverage does not match target forms; "
            f"missing={sorted(form_keys - locked_keys)[:10]}, extra={sorted(locked_keys - form_keys)[:10]}"
        )

    manifest_text = raw_manifest.decode("utf-8")
    data_license = next(
        file.destination_path
        for file in source_files
        if file.source_component == "pokeapi-data" and file.source_role == "license"
    )
    sprite_license = (SOURCE_ROOT / SPRITE_LICENSE_PATH).relative_to(REPOSITORY_ROOT).as_posix()
    metadata = PokemonSourceMetadata(
        source_name=SOURCE_NAME,
        manifest_filename=lock_path.name,
        manifest_path=lock_path.resolve(),
        manifest_sha256=hashlib.sha256(raw_manifest).hexdigest(),
        manifest_byte_count=len(raw_manifest),
        manifest_line_count=len(manifest_text.splitlines()),
        manifest_nonblank_line_count=sum(bool(line.strip()) for line in manifest_text.splitlines()),
        parser_version=PARSER_VERSION,
        data_repository=DATA_REPOSITORY,
        data_commit_sha=DATA_COMMIT_SHA,
        sprite_repository=str(sprite_source["repository"]),
        sprite_commit_sha=str(sprite_source["commit_sha"]),
        acquisition_date=date.fromisoformat(ACQUISITION_DATE),
        data_license_path=data_license,
        sprite_license_path=sprite_license,
    )
    return ParsedPokemonDataset(
        metadata=metadata,
        source_files=source_files,
        species=species,
        pokedexes=tuple(pokedexes),
        missing_sprites=missing_sprites,
    )
