"""Shared PostgreSQL connection configuration."""

from __future__ import annotations

import os

import psycopg


def get_database_url(explicit_url: str | None = None) -> str:
    database_url = explicit_url or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for PostgreSQL-backed LuxDex operations")
    return database_url


def connect_database(database_url: str | None = None) -> psycopg.Connection:
    return psycopg.connect(get_database_url(database_url))
