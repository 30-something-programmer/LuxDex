FROM postgres:17-alpine

COPY db/schema/ /opt/luxdex/db/schema/
COPY db/data/canonical/ /opt/luxdex/db/data/canonical/
COPY docker/db/initdb/ /docker-entrypoint-initdb.d/
