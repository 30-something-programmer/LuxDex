"""Deterministic Penumbra raw-name to canonical Pokémon form resolver."""

from __future__ import annotations

import csv
import hashlib
import json
import logging
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

from psycopg import Connection
from psycopg.rows import dict_row

from app.database import connect_database
from app.ingestion.penumbra.parser import SOURCE_NAME as PENUMBRA_SOURCE_NAME
from app.ingestion.pokemon.parser import SOURCE_NAME as POKEMON_SOURCE_NAME

LOGGER = logging.getLogger(__name__)
RESOLVER_VERSION = "1.0.0"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ALIAS_PATH = (
    REPOSITORY_ROOT
    / "db"
    / "data"
    / "canonical"
    / "identity"
    / "penumbra-pokemon-aliases.csv"
)
DEFAULT_REPORT_PATH = (
    REPOSITORY_ROOT
    / "db"
    / "data"
    / "canonical"
    / "identity"
    / "penumbra-pokemon-identity-report.json"
)

_FORME_PATTERN = re.compile(r"^(?P<species>.+) \(Forme (?P<form_index>\d+)\)$")
_WHITESPACE_PATTERN = re.compile(r"\s+")
_APOSTROPHE_TRANSLATION = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u02bc": "'",
        "\uff07": "'",
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
    }
)


class IdentityResolutionError(ValueError):
    """Raised when source identities or explicit aliases are not deterministic."""


@dataclass(frozen=True)
class CanonicalForm:
    id: int
    form_key: str
    identifier: str
    form_display_name: str
    form_order: int
    is_default: bool
    species_id: int
    species_key: str
    species_display_name: str
    national_dex_number: int
    alola_dex_number: int | None
    local_sprite_path: str | None


@dataclass(frozen=True)
class ExplicitAlias:
    source_name: str
    target_key: str
    mapping_method: str
    note: str


@dataclass(frozen=True)
class IdentityResolution:
    source_name: str
    occurrence_count: int
    pre_resolution_classification: str
    form: CanonicalForm | None
    mapping_method: str | None
    mapping_note: str

    @property
    def is_resolved(self) -> bool:
        return self.form is not None


@dataclass(frozen=True)
class ResolutionInputs:
    penumbra_dataset_id: int
    penumbra_sha256: str
    pokemon_dataset_id: int
    pokemon_sha256: str
    source_identities: tuple[tuple[str, int], ...]
    canonical_forms: tuple[CanonicalForm, ...]


@dataclass(frozen=True)
class IdentityBuildResult:
    status: str
    build_id: int
    summary: dict[str, int]
    unresolved: tuple[str, ...]
    report_path: str


def normalise_identity(value: str) -> str:
    """Normalise benign typography without discarding accents or form semantics."""

    normalized = unicodedata.normalize("NFKC", value).translate(_APOSTROPHE_TRANSLATION)
    normalized = re.sub(r"\s*:\s*", ":", normalized)
    normalized = re.sub(r"\.(?=\s|$)", "", normalized)
    return _WHITESPACE_PATTERN.sub(" ", normalized).strip().casefold()


def read_aliases(alias_path: Path = DEFAULT_ALIAS_PATH) -> tuple[ExplicitAlias, ...]:
    raw_bytes = alias_path.read_bytes()
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise IdentityResolutionError(f"alias file must be UTF-8: {alias_path}") from error

    reader = csv.DictReader(text.splitlines())
    expected_fields = ["source_name", "target_key", "mapping_method", "note"]
    if reader.fieldnames != expected_fields:
        raise IdentityResolutionError(
            f"alias columns must be {expected_fields!r}, got {reader.fieldnames!r}"
        )

    aliases: list[ExplicitAlias] = []
    seen_sources: set[str] = set()
    for line_number, row in enumerate(reader, start=2):
        alias = ExplicitAlias(
            source_name=(row["source_name"] or "").strip(),
            target_key=(row["target_key"] or "").strip(),
            mapping_method=(row["mapping_method"] or "").strip(),
            note=(row["note"] or "").strip(),
        )
        if not all((alias.source_name, alias.target_key, alias.mapping_method, alias.note)):
            raise IdentityResolutionError(f"blank alias field at {alias_path}:{line_number}")
        if alias.mapping_method not in {"explicit_alias", "explicit_form_alias", "manual_verified"}:
            raise IdentityResolutionError(
                f"invalid explicit mapping method {alias.mapping_method!r} at "
                f"{alias_path}:{line_number}"
            )
        if alias.source_name in seen_sources:
            raise IdentityResolutionError(
                f"duplicate explicit alias for {alias.source_name!r} at {alias_path}:{line_number}"
            )
        seen_sources.add(alias.source_name)
        aliases.append(alias)
    return tuple(aliases)


def _single_candidate(
    index: dict[str, set[str]],
    lookup: str,
) -> str | None:
    candidates = index.get(lookup, set())
    if len(candidates) > 1:
        raise IdentityResolutionError(
            f"identity {lookup!r} is ambiguous across canonical forms: {sorted(candidates)!r}"
        )
    return next(iter(candidates), None)


def resolve_identities(
    source_identities: Iterable[tuple[str, int]],
    canonical_forms: Iterable[CanonicalForm],
    aliases: Iterable[ExplicitAlias],
) -> tuple[IdentityResolution, ...]:
    forms = tuple(canonical_forms)
    explicit_aliases = tuple(aliases)
    forms_by_key = {form.form_key: form for form in forms}
    if len(forms_by_key) != len(forms):
        raise IdentityResolutionError("canonical form keys are not unique")

    exact_index: dict[str, set[str]] = {}
    normalized_index: dict[str, set[str]] = {}
    for form in forms:
        candidate_names = [form.form_display_name]
        if form.is_default:
            candidate_names.append(form.species_display_name)
        for candidate_name in candidate_names:
            exact_index.setdefault(candidate_name, set()).add(form.form_key)
            normalized_index.setdefault(normalise_identity(candidate_name), set()).add(form.form_key)

    aliases_by_source = {alias.source_name: alias for alias in explicit_aliases}
    if len(aliases_by_source) != len(explicit_aliases):
        raise IdentityResolutionError("explicit alias source names are not unique")

    source_rows = tuple(source_identities)
    source_names = {source_name for source_name, _ in source_rows}
    if len(source_names) != len(source_rows):
        raise IdentityResolutionError("Penumbra source identity inventory contains duplicates")

    unknown_alias_sources = sorted(set(aliases_by_source) - source_names)
    if unknown_alias_sources:
        raise IdentityResolutionError(
            f"explicit aliases do not exist in Penumbra encounter data: {unknown_alias_sources!r}"
        )

    resolutions: list[IdentityResolution] = []
    for source_name, occurrence_count in source_rows:
        exact_key = _single_candidate(exact_index, source_name)
        normalized_key = _single_candidate(normalized_index, normalise_identity(source_name))
        alias = aliases_by_source.get(source_name)

        if exact_key is not None:
            if alias is not None:
                raise IdentityResolutionError(
                    f"alias {source_name!r} is unnecessary because it has a unique exact match"
                )
            resolutions.append(
                IdentityResolution(
                    source_name=source_name,
                    occurrence_count=occurrence_count,
                    pre_resolution_classification="exact",
                    form=forms_by_key[exact_key],
                    mapping_method="exact",
                    mapping_note="Unique exact canonical English species/form display-name match.",
                )
            )
            continue

        if normalized_key is not None:
            if alias is not None:
                raise IdentityResolutionError(
                    f"alias {source_name!r} is unnecessary because benign normalisation is unique"
                )
            resolutions.append(
                IdentityResolution(
                    source_name=source_name,
                    occurrence_count=occurrence_count,
                    pre_resolution_classification="normalised_exact",
                    form=forms_by_key[normalized_key],
                    mapping_method="normalised_exact",
                    mapping_note="Unique canonical display-name match after benign typography normalisation.",
                )
            )
            continue

        if alias is None:
            classification = (
                "form_alias_required" if _FORME_PATTERN.fullmatch(source_name) else "unresolved"
            )
            resolutions.append(
                IdentityResolution(
                    source_name=source_name,
                    occurrence_count=occurrence_count,
                    pre_resolution_classification=classification,
                    form=None,
                    mapping_method=None,
                    mapping_note="No unique exact, normalised, or explicit alias target was found.",
                )
            )
            continue

        target = forms_by_key.get(alias.target_key)
        if target is None:
            raise IdentityResolutionError(
                f"alias {source_name!r} targets unknown canonical form {alias.target_key!r}"
            )

        form_match = _FORME_PATTERN.fullmatch(source_name)
        expected_classification = "form_alias_required" if form_match else "alias_required"
        if alias.mapping_method == "explicit_form_alias":
            if form_match is None:
                raise IdentityResolutionError(
                    f"explicit form alias {source_name!r} does not use Penumbra Forme notation"
                )
            source_species = form_match.group("species")
            form_index = int(form_match.group("form_index"))
            if source_species != target.species_display_name:
                raise IdentityResolutionError(
                    f"form alias {source_name!r} crosses species to {target.species_display_name!r}"
                )
            if target.form_order != form_index + 1:
                raise IdentityResolutionError(
                    f"form alias {source_name!r} targets form order {target.form_order}, "
                    f"expected {form_index + 1}"
                )

        if target.local_sprite_path is None and "sprite" not in alias.note.casefold():
            raise IdentityResolutionError(
                f"alias {source_name!r} targets {target.form_key!r} without a local sprite; "
                "the alias note must acknowledge that explicitly"
            )

        resolutions.append(
            IdentityResolution(
                source_name=source_name,
                occurrence_count=occurrence_count,
                pre_resolution_classification=expected_classification,
                form=target,
                mapping_method=alias.mapping_method,
                mapping_note=alias.note,
            )
        )

    return tuple(resolutions)


def _fetch_inputs(connection: Connection[Any]) -> ResolutionInputs:
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            "SELECT id, sha256 FROM luxdex.source_dataset WHERE source_name = %s",
            (PENUMBRA_SOURCE_NAME,),
        )
        penumbra = cursor.fetchone()
        if penumbra is None:
            raise IdentityResolutionError("the Penumbra source dataset is not loaded")

        cursor.execute(
            """
            SELECT dataset.id, dataset.sha256
            FROM luxdex.source_dataset AS dataset
            JOIN luxdex.pokemon_source_dataset AS pokemon
              ON pokemon.dataset_id = dataset.id
            WHERE dataset.source_name = %s
            """,
            (POKEMON_SOURCE_NAME,),
        )
        pokemon = cursor.fetchone()
        if pokemon is None:
            raise IdentityResolutionError("the canonical Pokémon dataset is not loaded")

        cursor.execute(
            """
            SELECT encounter.source_pokemon_name, count(*)::integer AS occurrence_count
            FROM luxdex.penumbra_encounter AS encounter
            JOIN luxdex.penumbra_encounter_pool AS pool
              ON pool.id = encounter.encounter_pool_id
            JOIN luxdex.penumbra_encounter_table AS encounter_table
              ON encounter_table.id = pool.encounter_table_id
            JOIN luxdex.penumbra_map_group AS map_group
              ON map_group.id = encounter_table.map_group_id
            WHERE map_group.dataset_id = %s
            GROUP BY encounter.source_pokemon_name
            ORDER BY encounter.source_pokemon_name
            """,
            (penumbra["id"],),
        )
        source_identities = tuple(
            (str(row["source_pokemon_name"]), int(row["occurrence_count"]))
            for row in cursor.fetchall()
        )

        cursor.execute(
            """
            SELECT
                form.id,
                form.form_key,
                form.identifier,
                form.display_name AS form_display_name,
                form.form_order,
                form.is_default,
                species.id AS species_id,
                species.identifier AS species_key,
                species.display_name AS species_display_name,
                species.national_dex_number,
                alola.dex_number AS alola_dex_number,
                sprite.local_path AS local_sprite_path
            FROM luxdex.pokemon_form AS form
            JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
            LEFT JOIN luxdex.pokemon_sprite_asset AS sprite ON sprite.form_id = form.id
            LEFT JOIN luxdex.pokemon_pokedex AS alola_dex
              ON alola_dex.dataset_id = species.dataset_id
             AND alola_dex.dex_key = 'alola-usum'
            LEFT JOIN luxdex.pokemon_pokedex_number AS alola
              ON alola.pokedex_id = alola_dex.id
             AND alola.species_id = species.id
            WHERE species.dataset_id = %s AND species.is_active
            ORDER BY species.national_dex_number, form.form_order, form.id
            """,
            (pokemon["id"],),
        )
        canonical_forms = tuple(CanonicalForm(**dict(row)) for row in cursor.fetchall())

    return ResolutionInputs(
        penumbra_dataset_id=int(penumbra["id"]),
        penumbra_sha256=str(penumbra["sha256"]),
        pokemon_dataset_id=int(pokemon["id"]),
        pokemon_sha256=str(pokemon["sha256"]),
        source_identities=source_identities,
        canonical_forms=canonical_forms,
    )


def _summary(resolutions: Sequence[IdentityResolution]) -> dict[str, int]:
    methods = Counter(resolution.mapping_method for resolution in resolutions)
    return {
        "total_raw_identities": len(resolutions),
        "resolved": sum(resolution.is_resolved for resolution in resolutions),
        "exact": methods["exact"],
        "normalised_exact": methods["normalised_exact"],
        "explicit_alias": methods["explicit_alias"],
        "explicit_form_alias": methods["explicit_form_alias"],
        "manual_verified": methods["manual_verified"],
        "unresolved": methods[None],
        "mapped_targets_without_local_sprite": sum(
            resolution.form is not None and resolution.form.local_sprite_path is None
            for resolution in resolutions
        ),
    }


def _form_patterns(resolutions: Sequence[IdentityResolution]) -> list[dict[str, int | str]]:
    identity_counts: Counter[int] = Counter()
    occurrence_counts: Counter[int] = Counter()
    for resolution in resolutions:
        match = _FORME_PATTERN.fullmatch(resolution.source_name)
        if match:
            form_index = int(match.group("form_index"))
            identity_counts[form_index] += 1
            occurrence_counts[form_index] += resolution.occurrence_count
    return [
        {
            "pattern": f"(Forme {form_index})",
            "unique_identity_count": identity_counts[form_index],
            "encounter_occurrence_count": occurrence_counts[form_index],
        }
        for form_index in sorted(identity_counts)
    ]


def _relative_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPOSITORY_ROOT.resolve()).as_posix()
    except ValueError:
        return str(path.resolve())


def _build_report(
    inputs: ResolutionInputs,
    resolutions: Sequence[IdentityResolution],
    alias_path: Path,
    alias_sha256: str,
) -> dict[str, Any]:
    summary = _summary(resolutions)
    return {
        "format_version": 1,
        "resolver_version": RESOLVER_VERSION,
        "source_versions": {
            "penumbra_sha256": inputs.penumbra_sha256,
            "pokemon_master_sha256": inputs.pokemon_sha256,
            "alias_file": _relative_path(alias_path),
            "alias_sha256": alias_sha256,
        },
        "automatic_resolution_rules": [
            "unique exact canonical English species/default-form or form display name",
            "unique benign Unicode/whitespace/canonical-punctuation normalised display name",
            "otherwise require an explicit reviewed alias; no fuzzy or global Forme rule",
        ],
        "pre_resolution_inventory": dict(
            Counter(resolution.pre_resolution_classification for resolution in resolutions)
        ),
        "summary": summary,
        "form_patterns": _form_patterns(resolutions),
        "unresolved": [
            {
                "source_pokemon_name": resolution.source_name,
                "occurrence_count": resolution.occurrence_count,
                "reason": resolution.mapping_note,
            }
            for resolution in resolutions
            if not resolution.is_resolved
        ],
        "mapped_targets_without_local_sprite": [
            {
                "source_pokemon_name": resolution.source_name,
                "form_key": resolution.form.form_key,
                "note": resolution.mapping_note,
            }
            for resolution in resolutions
            if resolution.form is not None and resolution.form.local_sprite_path is None
        ],
        "identities": [
            {
                "source_pokemon_name": resolution.source_name,
                "occurrence_count": resolution.occurrence_count,
                "pre_resolution_classification": resolution.pre_resolution_classification,
                "status": "verified" if resolution.is_resolved else "unresolved",
                "mapping_method": resolution.mapping_method,
                "form_key": resolution.form.form_key if resolution.form else None,
                "display_name": resolution.form.form_display_name if resolution.form else None,
                "local_sprite_path": resolution.form.local_sprite_path if resolution.form else None,
                "mapping_note": resolution.mapping_note,
            }
            for resolution in resolutions
        ],
    }


def _write_report(report_path: Path, report: dict[str, Any]) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _encounter_fingerprint(connection: Connection[Any], penumbra_dataset_id: int) -> tuple[int, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                count(*)::integer,
                md5(string_agg(
                    encounter.id::text || chr(31)
                    || encounter.encounter_pool_id::text || chr(31)
                    || encounter.source_order::text || chr(31)
                    || encounter.source_pokemon_name || chr(31)
                    || COALESCE(encounter.rate_percent::text, '') || chr(31)
                    || encounter.source_line_number::text,
                    chr(30) ORDER BY encounter.id
                ))
            FROM luxdex.penumbra_encounter AS encounter
            JOIN luxdex.penumbra_encounter_pool AS pool
              ON pool.id = encounter.encounter_pool_id
            JOIN luxdex.penumbra_encounter_table AS encounter_table
              ON encounter_table.id = pool.encounter_table_id
            JOIN luxdex.penumbra_map_group AS map_group
              ON map_group.id = encounter_table.map_group_id
            WHERE map_group.dataset_id = %s
            """,
            (penumbra_dataset_id,),
        )
        row = cursor.fetchone()
    if row is None:
        raise IdentityResolutionError("could not fingerprint Penumbra encounter rows")
    return int(row[0]), str(row[1])


def _find_unchanged_build(
    connection: Connection[Any],
    inputs: ResolutionInputs,
    alias_sha256: str,
    summary: dict[str, int],
) -> int | None:
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            SELECT build.id
            FROM luxdex.penumbra_pokemon_identity_build AS build
            WHERE build.penumbra_dataset_id = %s
              AND build.pokemon_dataset_id = %s
              AND build.alias_sha256 = %s
              AND build.resolver_version = %s
              AND build.total_identity_count = %s
              AND build.exact_count = %s
              AND build.normalised_exact_count = %s
              AND build.explicit_alias_count = %s
              AND build.explicit_form_alias_count = %s
              AND build.unresolved_count = %s
              AND (
                  SELECT count(*)
                  FROM luxdex.penumbra_pokemon_source_identity AS identity
                  WHERE identity.build_id = build.id
              ) = %s
              AND (
                  SELECT count(*)
                  FROM luxdex.penumbra_pokemon_identity_map AS identity_map
                  JOIN luxdex.penumbra_pokemon_source_identity AS identity
                    ON identity.id = identity_map.source_identity_id
                  WHERE identity.build_id = build.id
              ) = %s
            """,
            (
                inputs.penumbra_dataset_id,
                inputs.pokemon_dataset_id,
                alias_sha256,
                RESOLVER_VERSION,
                summary["total_raw_identities"],
                summary["exact"],
                summary["normalised_exact"],
                summary["explicit_alias"],
                summary["explicit_form_alias"],
                summary["unresolved"],
                summary["total_raw_identities"],
                summary["resolved"],
            ),
        )
        row = cursor.fetchone()
    return int(row["id"]) if row else None


def _persist_resolutions(
    connection: Connection[Any],
    inputs: ResolutionInputs,
    resolutions: Sequence[IdentityResolution],
    alias_path: Path,
    alias_sha256: str,
    summary: dict[str, int],
) -> tuple[str, int]:
    unchanged_build_id = _find_unchanged_build(
        connection, inputs, alias_sha256, summary
    )
    if unchanged_build_id is not None:
        return "skipped", unchanged_build_id

    before_fingerprint = _encounter_fingerprint(connection, inputs.penumbra_dataset_id)
    with connection.transaction():
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                "LOCK TABLE luxdex.penumbra_pokemon_identity_build IN SHARE ROW EXCLUSIVE MODE"
            )
            unchanged_build_id = _find_unchanged_build(
                connection, inputs, alias_sha256, summary
            )
            if unchanged_build_id is not None:
                return "skipped", unchanged_build_id

            cursor.execute(
                "DELETE FROM luxdex.penumbra_pokemon_identity_build "
                "WHERE penumbra_dataset_id = %s",
                (inputs.penumbra_dataset_id,),
            )
            status = "replaced" if cursor.rowcount else "loaded"
            cursor.execute(
                """
                INSERT INTO luxdex.penumbra_pokemon_identity_build (
                    penumbra_dataset_id,
                    pokemon_dataset_id,
                    alias_filename,
                    alias_sha256,
                    resolver_version,
                    total_identity_count,
                    exact_count,
                    normalised_exact_count,
                    explicit_alias_count,
                    explicit_form_alias_count,
                    unresolved_count
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    inputs.penumbra_dataset_id,
                    inputs.pokemon_dataset_id,
                    _relative_path(alias_path),
                    alias_sha256,
                    RESOLVER_VERSION,
                    summary["total_raw_identities"],
                    summary["exact"],
                    summary["normalised_exact"],
                    summary["explicit_alias"],
                    summary["explicit_form_alias"],
                    summary["unresolved"],
                ),
            )
            build_row = cursor.fetchone()
            if build_row is None:
                raise RuntimeError("identity build insert returned no identifier")
            build_id = int(build_row["id"])

            cursor.executemany(
                """
                INSERT INTO luxdex.penumbra_pokemon_source_identity (
                    build_id,
                    source_pokemon_name,
                    occurrence_count,
                    pre_resolution_classification,
                    resolution_note
                )
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        build_id,
                        resolution.source_name,
                        resolution.occurrence_count,
                        resolution.pre_resolution_classification,
                        resolution.mapping_note,
                    )
                    for resolution in resolutions
                ],
            )
            cursor.execute(
                """
                SELECT id, source_pokemon_name
                FROM luxdex.penumbra_pokemon_source_identity
                WHERE build_id = %s
                """,
                (build_id,),
            )
            source_identity_ids = {
                str(row["source_pokemon_name"]): int(row["id"])
                for row in cursor.fetchall()
            }
            cursor.executemany(
                """
                INSERT INTO luxdex.penumbra_pokemon_identity_map (
                    source_identity_id,
                    pokemon_form_id,
                    mapping_method,
                    mapping_confidence,
                    mapping_note
                )
                VALUES (%s, %s, %s, 'verified', %s)
                """,
                [
                    (
                        source_identity_ids[resolution.source_name],
                        resolution.form.id,
                        resolution.mapping_method,
                        resolution.mapping_note,
                    )
                    for resolution in resolutions
                    if resolution.form is not None
                ],
            )

            cursor.execute(
                """
                SELECT
                    (SELECT count(*) FROM luxdex.penumbra_pokemon_source_identity
                     WHERE build_id = %s) AS identity_count,
                    (SELECT count(*)
                     FROM luxdex.penumbra_pokemon_identity_map AS identity_map
                     JOIN luxdex.penumbra_pokemon_source_identity AS identity
                       ON identity.id = identity_map.source_identity_id
                     WHERE identity.build_id = %s) AS mapping_count
                """,
                (build_id, build_id),
            )
            persisted_counts = cursor.fetchone()
            if persisted_counts is None or (
                int(persisted_counts["identity_count"]) != summary["total_raw_identities"]
                or int(persisted_counts["mapping_count"]) != summary["resolved"]
            ):
                raise RuntimeError("persisted identity-map counts differ from validated results")

            after_fingerprint = _encounter_fingerprint(
                connection, inputs.penumbra_dataset_id
            )
            if after_fingerprint != before_fingerprint:
                raise RuntimeError("Penumbra source encounter rows changed during identity build")

    return status, build_id


def build_penumbra_pokemon_map(
    database_url: str | None = None,
    alias_path: Path = DEFAULT_ALIAS_PATH,
    report_path: Path = DEFAULT_REPORT_PATH,
) -> IdentityBuildResult:
    """Resolve, validate, report, then transactionally persist the complete identity map."""

    alias_bytes = alias_path.read_bytes()
    alias_sha256 = hashlib.sha256(alias_bytes).hexdigest()
    aliases = read_aliases(alias_path)

    with connect_database(database_url) as connection:
        inputs = _fetch_inputs(connection)
        resolutions = resolve_identities(
            inputs.source_identities,
            inputs.canonical_forms,
            aliases,
        )
        report = _build_report(inputs, resolutions, alias_path, alias_sha256)
        _write_report(report_path, report)
        status, build_id = _persist_resolutions(
            connection,
            inputs,
            resolutions,
            alias_path,
            alias_sha256,
            report["summary"],
        )

    unresolved = tuple(
        resolution.source_name for resolution in resolutions if not resolution.is_resolved
    )
    LOGGER.info(
        json.dumps(
            {
                "event": "penumbra_pokemon_identity_build_completed",
                "status": status,
                "build_id": build_id,
                **report["summary"],
            },
            sort_keys=True,
        )
    )
    return IdentityBuildResult(
        status=status,
        build_id=build_id,
        summary=report["summary"],
        unresolved=unresolved,
        report_path=_relative_path(report_path),
    )
