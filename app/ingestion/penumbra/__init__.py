"""Penumbra wild-encounter ingestion."""

from app.ingestion.penumbra.parser import parse_source
from app.ingestion.penumbra.validator import validate_dataset

__all__ = ["parse_source", "validate_dataset"]
