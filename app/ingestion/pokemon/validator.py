"""Semantic validation for the canonical USUM-era Pokémon master."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from app.ingestion.pokemon.models import ParsedPokemonDataset, PokemonRegressionCounts


@dataclass(frozen=True, slots=True)
class PokemonValidationIssue:
    message: str
    species_identifier: str | None = None
    form_key: str | None = None

    def __str__(self) -> str:
        context = self.form_key or self.species_identifier
        return f"{context}: {self.message}" if context else self.message


class PokemonValidationError(ValueError):
    def __init__(self, issues: list[PokemonValidationIssue]) -> None:
        preview = "\n".join(f"- {issue}" for issue in issues[:30])
        super().__init__(
            f"Pokémon master validation failed with {len(issues)} issue(s):\n{preview}"
        )
        self.issues = tuple(issues)


def validate_pokemon_dataset(dataset: ParsedPokemonDataset) -> PokemonRegressionCounts:
    issues: list[PokemonValidationIssue] = []
    species = dataset.species
    expected_numbers = list(range(1, 808))
    national_numbers = [item.national_dex_number for item in species]
    if len(species) != 807:
        issues.append(PokemonValidationIssue(f"expected 807 species, found {len(species)}"))
    if national_numbers != expected_numbers:
        issues.append(PokemonValidationIssue("National numbers are not the complete ordered 1..807 range"))
    if len({item.identifier for item in species}) != len(species):
        issues.append(PokemonValidationIssue("species identifiers are not unique"))
    if len({item.upstream_species_id for item in species}) != len(species):
        issues.append(PokemonValidationIssue("upstream species identifiers are not unique"))

    zeraora = next((item for item in species if item.national_dex_number == 807), None)
    if zeraora is None or zeraora.identifier != "zeraora" or zeraora.display_name != "Zeraora":
        issues.append(PokemonValidationIssue("National #807 must be Zeraora"))

    form_keys: set[str] = set()
    sprite_keys: set[str] = set()
    upstream_form_ids: set[int] = set()
    for item in species:
        context = {"species_identifier": item.identifier}
        if not item.display_name.strip():
            issues.append(PokemonValidationIssue("display name is blank", **context))
        if not 1 <= item.generation <= 7:
            issues.append(PokemonValidationIssue("generation is outside I through VII", **context))
        if not item.is_active:
            issues.append(PokemonValidationIssue("target species is not active", **context))
        defaults = [form for form in item.forms if form.is_default]
        if len(defaults) != 1:
            issues.append(
                PokemonValidationIssue(
                    f"expected one default form, found {len(defaults)}",
                    **context,
                )
            )
        elif defaults[0].form_key != item.identifier:
            issues.append(PokemonValidationIssue("default form key differs from species identifier", **context))

        for form in item.forms:
            form_context = {"species_identifier": item.identifier, "form_key": form.form_key}
            if form.form_key in form_keys:
                issues.append(PokemonValidationIssue("form key is duplicated", **form_context))
            form_keys.add(form.form_key)
            if form.sprite_key in sprite_keys:
                issues.append(PokemonValidationIssue("sprite key is duplicated", **form_context))
            sprite_keys.add(form.sprite_key)
            if form.upstream_form_id in upstream_form_ids:
                issues.append(PokemonValidationIssue("upstream form id is duplicated", **form_context))
            upstream_form_ids.add(form.upstream_form_id)
            if not form.display_name.strip():
                issues.append(PokemonValidationIssue("display name is blank", **form_context))
            if form.display_name_source not in {
                "species_name",
                "pokemon_form_name",
                "form_name",
                "derived_form_identifier",
            }:
                issues.append(PokemonValidationIssue("display-name provenance is invalid", **form_context))
            if form.is_regional != (form.upstream_form_identifier == "alola"):
                issues.append(PokemonValidationIssue("regional flag differs from upstream Alola form", **form_context))
            if form.is_regional and form.regional_name != "Alola":
                issues.append(PokemonValidationIssue("Alola form has an invalid regional name", **form_context))
            if not form.is_regional and form.regional_name is not None:
                issues.append(PokemonValidationIssue("non-regional form has a regional name", **form_context))
            if form.sprite is not None:
                if form.sprite.form_key != form.form_key:
                    issues.append(PokemonValidationIssue("sprite maps to a different form key", **form_context))
                if not form.sprite.local_path.startswith("/assets/pokemon/sprites/"):
                    issues.append(PokemonValidationIssue("sprite is not a local runtime path", **form_context))
                if "://" in form.sprite.local_path:
                    issues.append(PokemonValidationIssue("sprite path contains a remote host", **form_context))

    regional_forms = [form for item in species for form in item.forms if form.is_regional]
    if len(regional_forms) != 18:
        issues.append(PokemonValidationIssue(f"expected 18 Alola forms, found {len(regional_forms)}"))
    for expected_key in ("rattata:alola", "meowth:alola", "grimer:alola", "raichu:alola"):
        if expected_key not in form_keys:
            issues.append(PokemonValidationIssue(f"required regional form is missing: {expected_key}"))

    pokedexes = {pokedex.dex_key: pokedex for pokedex in dataset.pokedexes}
    expected_dex_keys = {
        "national",
        "alola-usum",
        "melemele-usum",
        "akala-usum",
        "ulaula-usum",
        "poni-usum",
    }
    if set(pokedexes) != expected_dex_keys:
        issues.append(PokemonValidationIssue("required National/USUM Pokédex scopes are incomplete"))
    species_identifiers = {item.identifier for item in species}
    for pokedex in dataset.pokedexes:
        entry_numbers = [entry.dex_number for entry in pokedex.entries]
        if entry_numbers != list(range(1, len(pokedex.entries) + 1)):
            issues.append(PokemonValidationIssue(f"{pokedex.dex_key} numbering is not contiguous"))
        if len({entry.species_identifier for entry in pokedex.entries}) != len(pokedex.entries):
            issues.append(PokemonValidationIssue(f"{pokedex.dex_key} contains duplicate species"))
        if any(entry.species_identifier not in species_identifiers for entry in pokedex.entries):
            issues.append(PokemonValidationIssue(f"{pokedex.dex_key} references an unknown species"))

    national = pokedexes.get("national")
    if national is None or len(national.entries) != 807:
        issues.append(PokemonValidationIssue("National Pokédex must contain 807 entries"))
    elif any(
        entry.dex_number != item.national_dex_number
        or entry.species_identifier != item.identifier
        for entry, item in zip(national.entries, species, strict=True)
    ):
        issues.append(PokemonValidationIssue("National Pokédex entries differ from species identity"))

    alola = pokedexes.get("alola-usum")
    if alola is None or len(alola.entries) != 403:
        issues.append(PokemonValidationIssue("USUM Alola Pokédex must contain 403 entries"))
    elif alola.entries[-1] != next(
        entry for entry in alola.entries if entry.dex_number == 403
    ) or alola.entries[-1].species_identifier != "zeraora":
        issues.append(PokemonValidationIssue("USUM Alola #403 must be Zeraora"))

    missing_keys = {missing.form_key for missing in dataset.missing_sprites}
    available_keys = {
        form.form_key for item in species for form in item.forms if form.sprite is not None
    }
    if missing_keys & available_keys:
        issues.append(PokemonValidationIssue("a form is both sprite-mapped and marked missing"))
    if missing_keys | available_keys != form_keys:
        issues.append(PokemonValidationIssue("sprite coverage does not classify every form"))
    default_without_sprite = [
        form.form_key
        for item in species
        for form in item.forms
        if form.is_default and form.sprite is None
    ]
    if default_without_sprite:
        issues.append(
            PokemonValidationIssue(
                f"default forms lack local sprites: {default_without_sprite[:10]}"
            )
        )

    if issues:
        raise PokemonValidationError(issues)
    return calculate_pokemon_regression_counts(dataset)


def calculate_pokemon_regression_counts(
    dataset: ParsedPokemonDataset,
) -> PokemonRegressionCounts:
    forms = [form for species in dataset.species for form in species.forms]
    pokedex_counts = {pokedex.dex_key: len(pokedex.entries) for pokedex in dataset.pokedexes}
    generation_counts = Counter(species.generation for species in dataset.species)
    return PokemonRegressionCounts(
        source_datasets=1,
        source_files=len(dataset.source_files),
        species=len(dataset.species),
        forms=len(forms),
        default_forms=sum(form.is_default for form in forms),
        non_default_forms=sum(not form.is_default for form in forms),
        regional_forms=sum(form.is_regional for form in forms),
        national_dex_entries=pokedex_counts["national"],
        alola_usum_dex_entries=pokedex_counts["alola-usum"],
        melemele_usum_dex_entries=pokedex_counts["melemele-usum"],
        akala_usum_dex_entries=pokedex_counts["akala-usum"],
        ulaula_usum_dex_entries=pokedex_counts["ulaula-usum"],
        poni_usum_dex_entries=pokedex_counts["poni-usum"],
        species_by_generation=tuple(sorted(generation_counts.items())),
        local_sprites=sum(form.sprite is not None for form in forms),
        form_specific_sprites=sum(not form.is_default and form.sprite is not None for form in forms),
        missing_sprite_mappings=len(dataset.missing_sprites),
        fallback_sprites_used=0,
        manifest_byte_count=dataset.metadata.manifest_byte_count,
        manifest_line_count=dataset.metadata.manifest_line_count,
        manifest_sha256=dataset.metadata.manifest_sha256,
    )
