from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest

from app.ingestion.penumbra.models import ParsedDataset
from app.ingestion.penumbra.parser import PenumbraParseError, parse_source, parse_text
from app.ingestion.penumbra.validator import PenumbraValidationError, validate_dataset
from penumbra_fixture import source_document

REAL_SOURCE = Path(__file__).resolve().parents[2] / "db/data/source/penumbra/wild-encounters.txt"


def validated_fixture() -> ParsedDataset:
    dataset = parse_text(source_document())
    validate_dataset(dataset)
    return dataset


def test_standard_normal_encounter_and_day_night_difference() -> None:
    dataset = validated_fixture()
    table = dataset.map_groups[0].tables[0]
    day_normal = table.pools[0]
    night_normal = table.pools[9]

    assert day_normal.encounters[0].source_pokemon_name == "Rattata (Forme 1)"
    assert day_normal.encounters[0].rate_percent == 99
    assert night_normal.encounters[0].source_pokemon_name == "Noctowl"
    assert validate_dataset(dataset).day_night_different_tables == 1


def test_zero_table_map_and_multiple_map_location_names() -> None:
    dataset = validated_fixture()
    assert [location.raw_map_number for location in dataset.map_groups[0].locations] == [1, 2]
    assert [location.source_location_name for location in dataset.map_groups[0].locations] == [
        "Test Path",
        "Test Bay",
    ]
    assert dataset.map_groups[1].declared_table_count == 0
    assert dataset.map_groups[1].tables == ()


def test_alternate_form_one_percent_and_one_hundred_percent() -> None:
    dataset = validated_fixture()
    pools = dataset.map_groups[0].tables[0].pools
    assert any(
        encounter.source_pokemon_name == "Rattata (Forme 1)"
        for encounter in pools[0].encounters
    )
    assert any(encounter.rate_percent == 1 for encounter in pools[0].encounters)
    assert pools[1].encounters[0].rate_percent == 100


def test_none_slot_is_accounted_for_but_not_persistable() -> None:
    dataset = validated_fixture()
    night_normal = dataset.map_groups[0].tables[0].pools[9]
    assert night_normal.source_entry_count == 2
    assert night_normal.empty_entry_count == 1
    assert night_normal.empty_rate_total_percent == 0
    assert [encounter.source_pokemon_name for encounter in night_normal.encounters] == ["Noctowl"]


def test_seven_sos_slots_and_replacement_are_preserved() -> None:
    dataset = validated_fixture()
    day_pools = dataset.map_groups[0].tables[0].pools[:9]
    sos_pools = [pool for pool in day_pools if pool.pool_type == "sos"]
    assert [pool.sos_slot for pool in sos_pools] == list(range(1, 8))
    assert sos_pools[0].encounters[0].source_pokemon_name == "Replacement"


def test_additional_sos_names_have_no_invented_rate_or_levels() -> None:
    dataset = validated_fixture()
    additional = dataset.map_groups[0].tables[0].pools[8]
    assert [encounter.source_pokemon_name for encounter in additional.encounters] == [
        "Castform",
        "Goomy",
    ]
    assert all(encounter.rate_percent is None for encounter in additional.encounters)
    assert additional.min_level is None
    assert additional.max_level is None


def test_malformed_percentage_is_rejected() -> None:
    dataset = parse_text(source_document().replace("Salamence (1%)", "Salamence (101%)", 1))
    with pytest.raises(PenumbraValidationError, match="totals 200%"):
        validate_dataset(dataset)


def test_malformed_level_range_is_rejected() -> None:
    dataset = parse_text(source_document(day_levels="6-5"))
    with pytest.raises(PenumbraValidationError, match="minimum level exceeds maximum level"):
        validate_dataset(dataset)


def test_malformed_table_count_is_rejected_with_line_context() -> None:
    source = source_document().replace("Tables: 1", "Tables: 2", 1)
    with pytest.raises(PenumbraParseError, match=r"line \d+"):
        parse_text(source)


def test_malformed_source_structure_is_rejected() -> None:
    source = source_document().replace("Map: ", "Location: ", 1)
    with pytest.raises(PenumbraParseError, match="expected Map: header"):
        parse_text(source)


def test_validator_rejects_an_out_of_range_sos_slot() -> None:
    dataset = validated_fixture()
    first_group = dataset.map_groups[0]
    first_table = first_group.tables[0]
    invalid_pool = replace(first_table.pools[1], sos_slot=8)
    invalid_table = replace(first_table, pools=(first_table.pools[0], invalid_pool, *first_table.pools[2:]))
    invalid_group = replace(first_group, tables=(invalid_table,))
    invalid_dataset = replace(dataset, map_groups=(invalid_group, dataset.map_groups[1]))
    with pytest.raises(PenumbraValidationError, match="SOS slots must be ordered 1 through 7"):
        validate_dataset(invalid_dataset)


def test_complete_real_source_regression_counts() -> None:
    counts = validate_dataset(parse_source(REAL_SOURCE))
    assert counts.to_dict() == {
        "source_datasets": 1,
        "map_groups": 336,
        "map_locations": 380,
        "encounter_tables": 397,
        "encounter_pools": 7146,
        "normal_encounters": 4757,
        "sos_encounters": 32946,
        "additional_sos_encounters": 220,
        "unique_pokemon_names": 570,
        "zero_table_map_groups": 262,
        "day_night_different_tables": 75,
        "total_encounters": 37923,
        "source_byte_count": 889667,
        "source_line_count": 10078,
        "source_nonblank_line_count": 9284,
        "source_sha256": "14d2d30bbd3abecc45a6fd3255e920bc620b9f8ea16d797f883419ae1aefb4f4",
    }
