from __future__ import annotations

import logging

from app.start import _HealthAccessFilter


def _access_record(path: str) -> logging.LogRecord:
    return logging.LogRecord(
        "uvicorn.access",
        logging.INFO,
        __file__,
        1,
        '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1:1", "GET", path, "1.1", 200),
        None,
    )


def test_health_access_filter_hides_only_probe_routes() -> None:
    access_filter = _HealthAccessFilter()

    assert not access_filter.filter(_access_record("/health"))
    assert not access_filter.filter(_access_record("/api/health"))
    assert access_filter.filter(_access_record("/api/pokemon"))
