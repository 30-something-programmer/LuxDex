"""Minimal LuxDex API entrypoint for the foundation pass."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

import psycopg
from fastapi import FastAPI, Response, status
from pydantic import BaseModel


def _read_version() -> str:
    version_file = Path(__file__).resolve().parents[1] / "build" / "VERSION"
    return version_file.read_text(encoding="utf-8").strip()


VERSION = _read_version()
app = FastAPI(title="LuxDex API", version=VERSION)


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: Literal["luxdex-app"] = "luxdex-app"
    version: str
    database: Literal["ok", "not_configured", "unavailable"]


def _database_health() -> Literal["ok", "not_configured", "unavailable"]:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return "not_configured"

    try:
        with psycopg.connect(database_url, connect_timeout=2) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
    except psycopg.Error:
        return "unavailable"

    return "ok"


@app.get("/health", response_model=HealthResponse)
def health(response: Response) -> HealthResponse:
    """Report API and configured database readiness."""
    database = _database_health()
    if database == "unavailable":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        application_status: Literal["ok", "degraded"] = "degraded"
    else:
        application_status = "ok"

    return HealthResponse(
        status=application_status,
        version=VERSION,
        database=database,
    )

