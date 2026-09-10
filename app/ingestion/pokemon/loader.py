"""Transactional and idempotent PostgreSQL loader for the Pokémon master."""

from __future__ import annotations

import json
import logging
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

from app.database import connect_database
from app.ingestion.pokemon.models import (
    ParsedPokemonDataset,
    PokemonLoadResult,
    PokemonRegressionCounts,
)
from app.ingestion.pokemon.parser import PARSER_VERSION, SOURCE_NAME, parse_pokemon_source
from app.ingestion.pokemon.source_config import SPRITE_FALLBACK_FAMILY
from app.ingestion.pokemon.validator import validate_pokemon_dataset

LOGGER = logging.getLogger(__name__)


def _log_event(event: str, **fields: Any) -> None:
    LOGGER.info(json.dumps({"event": event, **fields}, sort_keys=True, default=str))


def ensure_pokemon_dataset(database_url: str | None = None) -> PokemonLoadResult:
    # Sprite art changes far more often than taxonomy (species/forms/pokedex
    # numbers), so the parsed manifest_sha256 only fingerprints the taxonomy
    # portion of the lock (see parser.py). A taxonomy-unchanged run still
    # reconciles pokemon_sprite_asset rows via _sync_sprite_assets below,
    # without touching pokemon_species/pokemon_form - a full "replace" there
    # would delete and recreate every form row, which pokemon_collection_state's
    # foreign key (deliberately, to protect a profile's Seen/Owned history)
    # refuses once any real collection data references those forms.
    _log_event("pokemon_parse_started", parser_version=PARSER_VERSION)
    dataset = parse_pokemon_source()
    _log_event(
        "pokemon_parse_completed",
        species=len(dataset.species),
        forms=sum(len(species.forms) for species in dataset.species),
    )
    parsed_counts = validate_pokemon_dataset(dataset)
    _log_event("pokemon_validation_completed", **parsed_counts.to_dict())

    with connect_database(database_url) as connection:
        with connection.transaction():
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute("LOCK TABLE luxdex.source_dataset IN SHARE ROW EXCLUSIVE MODE")
                cursor.execute(
                    "SELECT id, sha256, parser_version FROM luxdex.source_dataset "
                    "WHERE source_name = %s",
                    (SOURCE_NAME,),
                )
                current = cursor.fetchone()
                if (
                    current
                    and current["sha256"] == dataset.metadata.manifest_sha256
                    and current["parser_version"] == PARSER_VERSION
                ):
                    sprite_changes = _sync_sprite_assets(cursor, current["id"], dataset)
                    counts = fetch_persisted_pokemon_counts(connection, current["id"])
                    _log_event(
                        "pokemon_dataset_skipped_unchanged",
                        dataset_id=current["id"],
                        sha256=dataset.metadata.manifest_sha256,
                        species=counts.species,
                        forms=counts.forms,
                        sprite_changes=sprite_changes,
                    )
                    return PokemonLoadResult("skipped", current["id"], counts)

                status = "replaced" if current else "loaded"
                if current:
                    _log_event(
                        "pokemon_dataset_replacement_started",
                        old_dataset_id=current["id"],
                        old_sha256=current["sha256"],
                        new_sha256=dataset.metadata.manifest_sha256,
                    )
                    cursor.execute(
                        "DELETE FROM luxdex.source_dataset WHERE id = %s",
                        (current["id"],),
                    )

                _log_event("pokemon_transaction_started", load_status=status)
                dataset_id = _insert_source(cursor, dataset)
                _insert_master(cursor, dataset_id, dataset)
                persisted_counts = fetch_persisted_pokemon_counts(connection, dataset_id)
                if persisted_counts != parsed_counts:
                    raise RuntimeError(
                        "persisted Pokémon regression counts differ from validated parsed counts: "
                        f"parsed={parsed_counts.to_dict()} persisted={persisted_counts.to_dict()}"
                    )

        _log_event(
            "pokemon_database_load_completed",
            status=status,
            dataset_id=dataset_id,
            **persisted_counts.to_dict(),
        )
        return PokemonLoadResult(status, dataset_id, persisted_counts)


def _find_dataset(connection: Connection) -> dict[str, Any] | None:
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            "SELECT id, sha256, parser_version FROM luxdex.source_dataset WHERE source_name = %s",
            (SOURCE_NAME,),
        )
        return cursor.fetchone()


def _sync_sprite_assets(cursor: Any, dataset_id: int, dataset: ParsedPokemonDataset) -> dict[str, int]:
    """Reconcile pokemon_sprite_asset with the parsed dataset for an unchanged
    taxonomy, without touching pokemon_species/pokemon_form (see the note in
    ensure_pokemon_dataset for why that matters)."""
    cursor.execute(
        """
        SELECT form.id, form.form_key
        FROM luxdex.pokemon_form AS form
        JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
        WHERE species.dataset_id = %s
        """,
        (dataset_id,),
    )
    form_ids = {row["form_key"]: row["id"] for row in cursor.fetchall()}

    expected: dict[int, tuple[Any, ...]] = {}
    for species in dataset.species:
        for form in species.forms:
            if form.sprite is None:
                continue
            expected[form_ids[form.form_key]] = (
                form.sprite.sprite_family,
                form.sprite.local_path,
                form.sprite.upstream_path,
                form.sprite.sha256,
                form.sprite.byte_count,
                form.sprite.width,
                form.sprite.height,
            )

    cursor.execute(
        """
        SELECT form_id, sprite_family, local_path, upstream_path, sha256, byte_count, width, height
        FROM luxdex.pokemon_sprite_asset
        WHERE form_id = ANY(%s)
        """,
        (list(form_ids.values()),),
    )
    existing = {
        row["form_id"]: (
            row["sprite_family"],
            row["local_path"],
            row["upstream_path"],
            row["sha256"],
            row["byte_count"],
            row["width"],
            row["height"],
        )
        for row in cursor.fetchall()
    }

    to_delete = [form_id for form_id in existing if form_id not in expected]
    to_upsert = [
        (form_id, *values) for form_id, values in expected.items() if existing.get(form_id) != values
    ]

    if to_delete:
        cursor.execute(
            "DELETE FROM luxdex.pokemon_sprite_asset WHERE form_id = ANY(%s)",
            (to_delete,),
        )
    if to_upsert:
        cursor.executemany(
            """
            INSERT INTO luxdex.pokemon_sprite_asset (
                form_id, sprite_family, local_path, upstream_path, sha256, byte_count, width, height
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (form_id) DO UPDATE SET
                sprite_family = EXCLUDED.sprite_family,
                local_path = EXCLUDED.local_path,
                upstream_path = EXCLUDED.upstream_path,
                sha256 = EXCLUDED.sha256,
                byte_count = EXCLUDED.byte_count,
                width = EXCLUDED.width,
                height = EXCLUDED.height
            """,
            to_upsert,
        )

    return {"deleted": len(to_delete), "upserted": len(to_upsert)}


def _insert_source(cursor: Any, dataset: ParsedPokemonDataset) -> int:
    metadata = dataset.metadata
    cursor.execute(
        """
        INSERT INTO luxdex.source_dataset (
            source_name,
            source_filename,
            sha256,
            byte_count,
            line_count,
            nonblank_line_count,
            parser_version
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            metadata.source_name,
            metadata.manifest_filename,
            metadata.manifest_sha256,
            metadata.manifest_byte_count,
            metadata.manifest_line_count,
            metadata.manifest_nonblank_line_count,
            metadata.parser_version,
        ),
    )
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError("Pokémon source dataset insert returned no identifier")
    dataset_id = int(row["id"])
    cursor.execute(
        """
        INSERT INTO luxdex.pokemon_source_dataset (
            dataset_id,
            data_repository,
            data_commit_sha,
            sprite_repository,
            sprite_commit_sha,
            acquisition_date,
            data_license_path,
            sprite_license_path
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            dataset_id,
            metadata.data_repository,
            metadata.data_commit_sha,
            metadata.sprite_repository,
            metadata.sprite_commit_sha,
            metadata.acquisition_date,
            metadata.data_license_path,
            metadata.sprite_license_path,
        ),
    )
    cursor.executemany(
        """
        INSERT INTO luxdex.pokemon_source_file (
            dataset_id,
            source_order,
            source_component,
            source_role,
            source_path,
            sha256,
            byte_count
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        [
            (
                dataset_id,
                source_file.source_order,
                source_file.source_component,
                source_file.source_role,
                source_file.source_path,
                source_file.sha256,
                source_file.byte_count,
            )
            for source_file in dataset.source_files
        ],
    )
    return dataset_id


def _insert_master(cursor: Any, dataset_id: int, dataset: ParsedPokemonDataset) -> None:
    cursor.executemany(
        """
        INSERT INTO luxdex.pokemon_species (
            dataset_id,
            national_dex_number,
            identifier,
            display_name,
            generation,
            is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        [
            (
                dataset_id,
                species.national_dex_number,
                species.identifier,
                species.display_name,
                species.generation,
                species.is_active,
            )
            for species in dataset.species
        ],
    )
    cursor.execute(
        "SELECT id, identifier FROM luxdex.pokemon_species WHERE dataset_id = %s",
        (dataset_id,),
    )
    species_ids = {row["identifier"]: row["id"] for row in cursor.fetchall()}
    cursor.executemany(
        """
        INSERT INTO luxdex.pokemon_species_source_mapping (
            species_id,
            upstream_species_id,
            upstream_identifier
        )
        VALUES (%s, %s, %s)
        """,
        [
            (
                species_ids[species.identifier],
                species.upstream_species_id,
                species.upstream_identifier,
            )
            for species in dataset.species
        ],
    )

    cursor.executemany(
        """
        INSERT INTO luxdex.pokemon_form (
            species_id,
            form_key,
            identifier,
            display_name,
            display_name_source,
            is_default,
            form_order,
            is_battle_only,
            is_mega,
            is_regional,
            regional_name,
            sprite_key
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        [
            (
                species_ids[species.identifier],
                form.form_key,
                form.identifier,
                form.display_name,
                form.display_name_source,
                form.is_default,
                form.form_order,
                form.is_battle_only,
                form.is_mega,
                form.is_regional,
                form.regional_name,
                form.sprite_key,
            )
            for species in dataset.species
            for form in species.forms
        ],
    )
    cursor.execute("SELECT id, form_key FROM luxdex.pokemon_form")
    form_ids = {row["form_key"]: row["id"] for row in cursor.fetchall()}
    cursor.executemany(
        """
        INSERT INTO luxdex.pokemon_form_source_mapping (
            form_id,
            upstream_pokemon_id,
            upstream_form_id,
            upstream_pokemon_identifier,
            upstream_form_identifier,
            introduced_version_group_id
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        [
            (
                form_ids[form.form_key],
                form.upstream_pokemon_id,
                form.upstream_form_id,
                form.upstream_pokemon_identifier,
                form.upstream_form_identifier,
                form.introduced_version_group_id,
            )
            for species in dataset.species
            for form in species.forms
        ],
    )

    cursor.executemany(
        """
        INSERT INTO luxdex.pokemon_pokedex (
            dataset_id,
            dex_key,
            display_name,
            upstream_pokedex_id,
            is_in_game
        )
        VALUES (%s, %s, %s, %s, %s)
        """,
        [
            (
                dataset_id,
                pokedex.dex_key,
                pokedex.display_name,
                pokedex.upstream_pokedex_id,
                pokedex.is_in_game,
            )
            for pokedex in dataset.pokedexes
        ],
    )
    cursor.execute(
        "SELECT id, dex_key FROM luxdex.pokemon_pokedex WHERE dataset_id = %s",
        (dataset_id,),
    )
    pokedex_ids = {row["dex_key"]: row["id"] for row in cursor.fetchall()}
    cursor.executemany(
        """
        INSERT INTO luxdex.pokemon_pokedex_number (pokedex_id, species_id, dex_number)
        VALUES (%s, %s, %s)
        """,
        [
            (
                pokedex_ids[pokedex.dex_key],
                species_ids[entry.species_identifier],
                entry.dex_number,
            )
            for pokedex in dataset.pokedexes
            for entry in pokedex.entries
        ],
    )

    cursor.executemany(
        """
        INSERT INTO luxdex.pokemon_sprite_asset (
            form_id,
            sprite_family,
            local_path,
            upstream_path,
            sha256,
            byte_count,
            width,
            height
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        [
            (
                form_ids[form.form_key],
                form.sprite.sprite_family,
                form.sprite.local_path,
                form.sprite.upstream_path,
                form.sprite.sha256,
                form.sprite.byte_count,
                form.sprite.width,
                form.sprite.height,
            )
            for species in dataset.species
            for form in species.forms
            if form.sprite is not None
        ],
    )


def fetch_persisted_pokemon_counts(
    connection: Connection,
    dataset_id: int,
) -> PokemonRegressionCounts:
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            "SELECT byte_count, line_count, sha256 FROM luxdex.source_dataset WHERE id = %s",
            (dataset_id,),
        )
        metadata = cursor.fetchone()
        if metadata is None:
            raise RuntimeError(f"Pokémon source dataset {dataset_id} does not exist")

        def scalar(query: str, parameters: tuple[Any, ...] = (dataset_id,)) -> int:
            cursor.execute(query, parameters)
            row = cursor.fetchone()
            if row is None:
                raise RuntimeError("Pokémon regression-count query returned no row")
            return int(next(iter(row.values())))

        source_datasets = scalar(
            "SELECT count(*) FROM luxdex.source_dataset WHERE id = %s AND source_name = 'pokemon-master-usum'"
        )
        source_files = scalar(
            "SELECT count(*) FROM luxdex.pokemon_source_file WHERE dataset_id = %s"
        )
        species = scalar("SELECT count(*) FROM luxdex.pokemon_species WHERE dataset_id = %s")
        forms = scalar(
            """
            SELECT count(*)
            FROM luxdex.pokemon_form AS form
            JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
            WHERE species.dataset_id = %s
            """
        )
        default_forms = scalar(
            """
            SELECT count(*)
            FROM luxdex.pokemon_form AS form
            JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
            WHERE species.dataset_id = %s AND form.is_default
            """
        )
        regional_forms = scalar(
            """
            SELECT count(*)
            FROM luxdex.pokemon_form AS form
            JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
            WHERE species.dataset_id = %s AND form.is_regional
            """
        )

        def dex_count(dex_key: str) -> int:
            return scalar(
                """
                SELECT count(*)
                FROM luxdex.pokemon_pokedex_number AS number
                JOIN luxdex.pokemon_pokedex AS pokedex ON pokedex.id = number.pokedex_id
                WHERE pokedex.dataset_id = %s AND pokedex.dex_key = %s
                """,
                (dataset_id, dex_key),
            )

        cursor.execute(
            """
            SELECT generation, count(*) AS species_count
            FROM luxdex.pokemon_species
            WHERE dataset_id = %s
            GROUP BY generation
            ORDER BY generation
            """,
            (dataset_id,),
        )
        generation_counts = tuple(
            (int(row["generation"]), int(row["species_count"]))
            for row in cursor.fetchall()
        )
        local_sprites = scalar(
            """
            SELECT count(*)
            FROM luxdex.pokemon_sprite_asset AS sprite
            JOIN luxdex.pokemon_form AS form ON form.id = sprite.form_id
            JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
            WHERE species.dataset_id = %s
            """
        )
        form_specific_sprites = scalar(
            """
            SELECT count(*)
            FROM luxdex.pokemon_sprite_asset AS sprite
            JOIN luxdex.pokemon_form AS form ON form.id = sprite.form_id
            JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
            WHERE species.dataset_id = %s AND NOT form.is_default
            """
        )
        fallback_sprites_used = scalar(
            """
            SELECT count(*)
            FROM luxdex.pokemon_sprite_asset AS sprite
            JOIN luxdex.pokemon_form AS form ON form.id = sprite.form_id
            JOIN luxdex.pokemon_species AS species ON species.id = form.species_id
            WHERE species.dataset_id = %s AND sprite.sprite_family = %s
            """,
            (dataset_id, SPRITE_FALLBACK_FAMILY),
        )
        dex_counts = {
            dex_key: dex_count(dex_key)
            for dex_key in (
                "national",
                "alola-usum",
                "melemele-usum",
                "akala-usum",
                "ulaula-usum",
                "poni-usum",
            )
        }

    return PokemonRegressionCounts(
        source_datasets=source_datasets,
        source_files=source_files,
        species=species,
        forms=forms,
        default_forms=default_forms,
        non_default_forms=forms - default_forms,
        regional_forms=regional_forms,
        national_dex_entries=dex_counts["national"],
        alola_usum_dex_entries=dex_counts["alola-usum"],
        melemele_usum_dex_entries=dex_counts["melemele-usum"],
        akala_usum_dex_entries=dex_counts["akala-usum"],
        ulaula_usum_dex_entries=dex_counts["ulaula-usum"],
        poni_usum_dex_entries=dex_counts["poni-usum"],
        species_by_generation=generation_counts,
        local_sprites=local_sprites,
        form_specific_sprites=form_specific_sprites,
        missing_sprite_mappings=forms - local_sprites,
        fallback_sprites_used=fallback_sprites_used,
        manifest_byte_count=int(metadata["byte_count"]),
        manifest_line_count=int(metadata["line_count"]),
        manifest_sha256=str(metadata["sha256"]),
    )
