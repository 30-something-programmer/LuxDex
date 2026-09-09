"""Semantic validation for a completely parsed Penumbra source dataset."""

from __future__ import annotations

from dataclasses import dataclass

from app.ingestion.penumbra.models import (
    EncounterPool,
    EncounterTable,
    ParsedDataset,
    RegressionCounts,
    TimeOfDay,
)


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    message: str
    source_line_number: int | None = None
    map_group_sequence: int | None = None
    table_number: int | None = None

    def __str__(self) -> str:
        context: list[str] = []
        if self.source_line_number is not None:
            context.append(f"line {self.source_line_number}")
        if self.map_group_sequence is not None:
            context.append(f"map group {self.map_group_sequence}")
        if self.table_number is not None:
            context.append(f"table {self.table_number}")
        return f"{', '.join(context)}: {self.message}" if context else self.message


class PenumbraValidationError(ValueError):
    def __init__(self, issues: list[ValidationIssue]) -> None:
        preview = "\n".join(f"- {issue}" for issue in issues[:20])
        remainder = len(issues) - 20
        if remainder > 0:
            preview += f"\n- … and {remainder} more issue(s)"
        super().__init__(f"Penumbra validation failed with {len(issues)} issue(s):\n{preview}")
        self.issues = tuple(issues)


def validate_dataset(dataset: ParsedDataset) -> RegressionCounts:
    issues: list[ValidationIssue] = []
    expected_group_sequences = list(range(1, len(dataset.map_groups) + 1))
    actual_group_sequences = [group.source_sequence for group in dataset.map_groups]
    if actual_group_sequences != expected_group_sequences:
        issues.append(ValidationIssue("map group source sequences are not contiguous and ordered"))

    for group in dataset.map_groups:
        context = {"map_group_sequence": group.source_sequence}
        if not group.locations:
            issues.append(ValidationIssue("Map header contains no location references", **context))
        if [location.source_order for location in group.locations] != list(
            range(1, len(group.locations) + 1)
        ):
            issues.append(ValidationIssue("map location source order is not contiguous", **context))
        if len(group.tables) != group.declared_table_count:
            issues.append(
                ValidationIssue(
                    f"declared {group.declared_table_count} table(s), parsed {len(group.tables)}",
                    source_line_number=group.source_line_start,
                    **context,
                )
            )

        expected_table_numbers = list(range(1, group.declared_table_count + 1))
        if [table.source_table_number for table in group.tables] != expected_table_numbers:
            issues.append(
                ValidationIssue(
                    "table numbers must be contiguous from 1 through the declared count",
                    source_line_number=group.source_line_start,
                    **context,
                )
            )
        if [table.source_order for table in group.tables] != expected_table_numbers:
            issues.append(ValidationIssue("table source order is not contiguous", **context))

        for table in group.tables:
            _validate_table(table, group.source_sequence, issues)

    if issues:
        raise PenumbraValidationError(issues)
    return calculate_regression_counts(dataset)


def _validate_table(
    table: EncounterTable,
    map_group_sequence: int,
    issues: list[ValidationIssue],
) -> None:
    for time_of_day in ("day", "night"):
        _validate_time_section(table, time_of_day, map_group_sequence, issues)


def _validate_time_section(
    table: EncounterTable,
    time_of_day: TimeOfDay,
    map_group_sequence: int,
    issues: list[ValidationIssue],
) -> None:
    pools = [pool for pool in table.pools if pool.time_of_day == time_of_day]
    context = {
        "map_group_sequence": map_group_sequence,
        "table_number": table.source_table_number,
    }
    if len(pools) != 9:
        issues.append(ValidationIssue(f"{time_of_day} section has {len(pools)} pools, expected 9", **context))
        return

    normal_pools = [pool for pool in pools if pool.pool_type == "normal"]
    sos_pools = [pool for pool in pools if pool.pool_type == "sos"]
    additional_pools = [pool for pool in pools if pool.pool_type == "additional_sos"]
    if len(normal_pools) != 1:
        issues.append(ValidationIssue(f"{time_of_day} section must contain one normal pool", **context))
    if [pool.sos_slot for pool in sos_pools] != list(range(1, 8)):
        issues.append(ValidationIssue(f"{time_of_day} SOS slots must be ordered 1 through 7", **context))
    if len(additional_pools) != 1:
        issues.append(ValidationIssue(f"{time_of_day} section must contain one Additional SOS pool", **context))
    if [pool.source_order for pool in pools] != list(range(1, 10)):
        issues.append(ValidationIssue(f"{time_of_day} pool order is not preserved", **context))

    for pool in pools:
        _validate_pool(pool, issues, context)


def _validate_pool(
    pool: EncounterPool,
    issues: list[ValidationIssue],
    context: dict[str, int],
) -> None:
    issue_context = {"source_line_number": pool.source_line_number, **context}
    if pool.source_entry_count != len(pool.encounters) + pool.empty_entry_count:
        issues.append(ValidationIssue("source entry accounting does not balance", **issue_context))
    encounter_orders = [encounter.source_order for encounter in pool.encounters]
    if encounter_orders != sorted(set(encounter_orders)):
        issues.append(ValidationIssue("encounter source order is not strictly increasing", **issue_context))
    if encounter_orders and (
        encounter_orders[0] < 1 or encounter_orders[-1] > pool.source_entry_count
    ):
        issues.append(ValidationIssue("encounter source order falls outside source entries", **issue_context))

    for encounter in pool.encounters:
        if not encounter.source_pokemon_name.strip() or encounter.source_pokemon_name == "(None)":
            issues.append(ValidationIssue("(None) or blank name became an encounter", **issue_context))
        if encounter.source_line_number != pool.source_line_number:
            issues.append(ValidationIssue("encounter trace line differs from its inline pool", **issue_context))

    if pool.pool_type == "additional_sos":
        if pool.sos_slot is not None or pool.min_level is not None or pool.max_level is not None:
            issues.append(ValidationIssue("Additional SOS pool invented slot or level data", **issue_context))
        if pool.rate_total_percent is not None or pool.empty_rate_total_percent is not None:
            issues.append(ValidationIssue("Additional SOS pool invented percentage data", **issue_context))
        if any(encounter.rate_percent is not None for encounter in pool.encounters):
            issues.append(ValidationIssue("Additional SOS encounter invented a rate", **issue_context))
        return

    if pool.min_level is None or pool.max_level is None or pool.min_level <= 0:
        issues.append(ValidationIssue("percentage pool has missing or invalid levels", **issue_context))
    elif pool.min_level > pool.max_level:
        issues.append(ValidationIssue("minimum level exceeds maximum level", **issue_context))
    if pool.pool_type == "normal" and pool.sos_slot is not None:
        issues.append(ValidationIssue("normal pool has an SOS slot", **issue_context))
    if pool.pool_type == "sos" and (pool.sos_slot is None or not 1 <= pool.sos_slot <= 7):
        issues.append(ValidationIssue("SOS slot is outside 1 through 7", **issue_context))
    if pool.empty_rate_total_percent != 0:
        issues.append(ValidationIssue("(None) source slots must have a 0% rate", **issue_context))
    if pool.rate_total_percent != 100:
        issues.append(
            ValidationIssue(
                f"{pool.pool_type} pool totals {pool.rate_total_percent}%, expected 100%",
                **issue_context,
            )
        )
    for encounter in pool.encounters:
        if encounter.rate_percent is None or not 0 <= encounter.rate_percent <= 100:
            issues.append(ValidationIssue("encounter rate is outside 0 through 100", **issue_context))


def calculate_regression_counts(dataset: ParsedDataset) -> RegressionCounts:
    pools = [
        pool
        for group in dataset.map_groups
        for table in group.tables
        for pool in table.pools
    ]
    encounters = [encounter for pool in pools for encounter in pool.encounters]
    tables = [table for group in dataset.map_groups for table in group.tables]
    return RegressionCounts(
        source_datasets=1,
        map_groups=len(dataset.map_groups),
        map_locations=sum(len(group.locations) for group in dataset.map_groups),
        encounter_tables=len(tables),
        encounter_pools=len(pools),
        normal_encounters=sum(
            len(pool.encounters) for pool in pools if pool.pool_type == "normal"
        ),
        sos_encounters=sum(len(pool.encounters) for pool in pools if pool.pool_type == "sos"),
        additional_sos_encounters=sum(
            len(pool.encounters) for pool in pools if pool.pool_type == "additional_sos"
        ),
        unique_pokemon_names=len({encounter.source_pokemon_name for encounter in encounters}),
        zero_table_map_groups=sum(not group.tables for group in dataset.map_groups),
        day_night_different_tables=sum(_day_and_night_differ(table) for table in tables),
        total_encounters=len(encounters),
        source_byte_count=dataset.metadata.byte_count,
        source_line_count=dataset.metadata.line_count,
        source_nonblank_line_count=dataset.metadata.nonblank_line_count,
        source_sha256=dataset.metadata.sha256,
    )


def _day_and_night_differ(table: EncounterTable) -> bool:
    def signature(time_of_day: TimeOfDay) -> tuple[object, ...]:
        return tuple(
            (
                pool.pool_type,
                pool.sos_slot,
                pool.min_level,
                pool.max_level,
                pool.source_entry_count,
                pool.empty_entry_count,
                tuple(
                    (
                        encounter.source_order,
                        encounter.source_pokemon_name,
                        encounter.rate_percent,
                    )
                    for encounter in pool.encounters
                ),
            )
            for pool in table.pools
            if pool.time_of_day == time_of_day
        )

    return signature("day") != signature("night")
