"""Idempotent runtime schema publication needed by volume-preserving rebuilds."""

from __future__ import annotations

from pathlib import Path

from app.database import connect_database


def ensure_runtime_schema() -> None:
    schema_directory = Path(__file__).resolve().parents[1] / "db" / "schema"
    with connect_database() as connection:
        for filename in ("070_collection.sql", "080_map_presentation.sql", "090_indexes.sql"):
            connection.execute((schema_directory / filename).read_text(encoding="utf-8"))
