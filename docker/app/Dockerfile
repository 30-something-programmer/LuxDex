FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /opt/luxdex

COPY build/ ./build/
RUN python -m pip install --no-cache-dir ./build

COPY app/ ./app/
COPY db/data/canonical/identity/ ./db/data/canonical/identity/
COPY db/data/source/ ./db/data/source/
COPY web/public/assets/pokemon/ ./web/public/assets/pokemon/

EXPOSE 8000

CMD ["python", "-m", "app.start"]
