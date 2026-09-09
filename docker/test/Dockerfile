FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /opt/luxdex

COPY build/ ./build/
RUN python -m pip install --no-cache-dir "./build[dev]"

# The repository is bind-mounted over /opt/luxdex at run time (see docker/compose.yml's
# `test` service), so app/, db/, tests/ and web/ are never baked into this image; only
# the dependency set from build/pyproject.toml is. This keeps the image cache-friendly
# and guarantees the test run always sees the current working tree, not a stale COPY.
CMD ["python", "-m", "pytest", "-q"]
