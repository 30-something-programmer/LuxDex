"""Container/local startup that ensures canonical data before serving the API."""

from __future__ import annotations

import logging

import uvicorn

from app.ingestion.penumbra.loader import ensure_penumbra_dataset


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    ensure_penumbra_dataset()
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
