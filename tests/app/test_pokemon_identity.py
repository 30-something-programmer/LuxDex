from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from app.identity.penumbra import (
    CanonicalForm,
    ExplicitAlias,
    IdentityResolutionError,
    normalise_identity,
    read_aliases,
    resolve_identities,
)


def canonical_form(
    form_key: str,
    display_name: str,
    *,
    species_key: str | None = None,
    species_name: str | None = None,
    form_order: int = 1,
    is_default: bool = True,
    sprite_path: str | None = "/assets/pokemon/sprites/test.png",
) -> CanonicalForm:
    resolved_species_key = species_key or form_key.split(":", 1)[0]
    resolved_species_name = species_name or display_name
    return CanonicalForm(
        id=abs(hash(form_key)) or 1,
        form_key=form_key,
        identifier=form_key.replace(":", "-"),
        form_display_name=display_name,
        form_order=form_order,
        is_default=is_default,
        species_id=abs(hash(resolved_species_key)) or 1,
        species_key=resolved_species_key,
        species_display_name=resolved_species_name,
        national_dex_number=1,
        alola_dex_number=None,
        local_sprite_path=sprite_path,
    )


def test_exact_and_punctuation_identities_are_deterministic() -> None:
    forms = (
        canonical_form("pichu", "Pichu"),
        canonical_form("mr-mime", "Mr. Mime"),
        canonical_form("farfetchd", "Farfetch'd"),
        canonical_form("type-null", "Type: Null"),
    )
    resolutions = resolve_identities(
        (("Pichu", 1), ("Mr. Mime", 2), ("Farfetch'd", 3), ("Type: Null", 4)),
        forms,
        (),
    )

    assert [resolution.form.form_key for resolution in resolutions if resolution.form] == [
        "pichu",
        "mr-mime",
        "farfetchd",
        "type-null",
    ]
    assert {resolution.mapping_method for resolution in resolutions} == {"exact"}


def test_benign_punctuation_normalisation_is_not_fuzzy_matching() -> None:
    forms = (canonical_form("mr-mime", "Mr. Mime"),)
    (resolution,) = resolve_identities((("  Mr   Mime ", 1),), forms, ())

    assert normalise_identity("Mr. Mime") == normalise_identity("  Mr   Mime ")
    assert resolution.mapping_method == "normalised_exact"
    assert resolution.form and resolution.form.form_key == "mr-mime"


def test_normal_and_regional_forms_coexist_via_explicit_species_alias() -> None:
    forms = (
        canonical_form("rattata", "Rattata", species_name="Rattata"),
        canonical_form(
            "rattata:alola",
            "Alolan Rattata",
            species_key="rattata",
            species_name="Rattata",
            form_order=2,
            is_default=False,
        ),
    )
    aliases = (
        ExplicitAlias(
            "Rattata (Forme 1)",
            "rattata:alola",
            "explicit_form_alias",
            "Verified Alolan form.",
        ),
    )
    resolutions = resolve_identities(
        (("Rattata", 5), ("Rattata (Forme 1)", 7)),
        forms,
        aliases,
    )

    assert [(item.form.form_key, item.mapping_method) for item in resolutions if item.form] == [
        ("rattata", "exact"),
        ("rattata:alola", "explicit_form_alias"),
    ]


def test_unresolved_identity_remains_unmapped() -> None:
    (resolution,) = resolve_identities(
        (("Not A Pokémon", 1),),
        (canonical_form("pichu", "Pichu"),),
        (),
    )

    assert resolution.form is None
    assert resolution.mapping_method is None
    assert resolution.pre_resolution_classification == "unresolved"


def test_invalid_alias_target_is_rejected() -> None:
    with pytest.raises(IdentityResolutionError, match="unknown canonical form"):
        resolve_identities(
            (("Rattata (Forme 1)", 1),),
            (canonical_form("rattata", "Rattata"),),
            (
                ExplicitAlias(
                    "Rattata (Forme 1)",
                    "rattata:not-real",
                    "explicit_form_alias",
                    "Invalid target fixture.",
                ),
            ),
        )


def test_duplicate_alias_source_is_rejected() -> None:
    csv_text = (
        "source_name,target_key,mapping_method,note\n"
        "Alias,pichu,explicit_alias,First.\n"
        "Alias,pikachu,explicit_alias,Second.\n"
    )
    with tempfile.TemporaryDirectory() as temporary_directory:
        path = Path(temporary_directory) / "aliases.csv"
        path.write_text(csv_text, encoding="utf-8")
        with pytest.raises(IdentityResolutionError, match="duplicate explicit alias"):
            read_aliases(path)


def test_missing_sprite_target_requires_explicit_acknowledgement() -> None:
    form = canonical_form(
        "meowstic:female",
        "Female Meowstic",
        species_key="meowstic",
        species_name="Meowstic",
        form_order=2,
        is_default=False,
        sprite_path=None,
    )
    with pytest.raises(IdentityResolutionError, match="without a local sprite"):
        resolve_identities(
            (("Meowstic (Forme 1)", 1),),
            (form,),
            (
                ExplicitAlias(
                    "Meowstic (Forme 1)",
                    "meowstic:female",
                    "explicit_form_alias",
                    "Female form.",
                ),
            ),
        )
