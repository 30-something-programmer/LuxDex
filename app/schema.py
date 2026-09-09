"""Idempotent runtime schema publication needed by volume-preserving rebuilds."""

from __future__ import annotations

from pathlib import Path

from app.database import connect_database


def ensure_runtime_schema() -> None:
    schema_path = Path(__file__).resolve().parents[1] / "db" / "schema" / "070_collection.sql"
    sql = schema_path.read_text(encoding="utf-8")
    with connect_database() as connection:
        connection.execute(sql)
