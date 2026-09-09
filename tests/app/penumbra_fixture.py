"""Small source-format fixtures; these are validation inputs, not application data."""

from __future__ import annotations


def section(
    table_number: int,
    time_of_day: str,
    normal: str = "Alpha (100%)",
    *,
    levels: str = "5-6",
    sos_slots: dict[int, str] | None = None,
    additional: str = "(None)",
) -> list[str]:
    configured_sos = sos_slots or {}
    return [
        f"Table {table_number} ({time_of_day}):",
        f"Encounters (Levels {levels}): {normal}",
        *[
            f"SOS Slot {slot} (Levels {levels}): {configured_sos.get(slot, normal)}"
            for slot in range(1, 8)
        ],
        f"Additional SOS encounters: {additional}",
        "",
    ]


def source_document(
    *,
    map_header: str = "001 - Test Path / 002 - Test Bay",
    day_normal: str = "Rattata (Forme 1) (99%), Salamence (1%)",
    night_normal: str = "Noctowl (100%), (None) (0%)",
    day_levels: str = "5-6",
    night_levels: str = "7-7",
    additional: str = "Castform, Goomy",
) -> str:
    day_sos = {1: "Replacement (100%)"}
    lines = [
        "==========",
        f"Map: {map_header}",
        "Tables: 1",
        *section(
            1,
            "Day",
            day_normal,
            levels=day_levels,
            sos_slots=day_sos,
            additional=additional,
        ),
        *section(
            1,
            "Night",
            night_normal,
            levels=night_levels,
            additional=additional,
        ),
        "==========",
        "==========",
        "Map: 099 - Empty Place",
        "Tables: 0",
        "==========",
    ]
    return "\n".join(lines) + "\n"
