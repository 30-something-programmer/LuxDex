#!/bin/sh
set -eu

apply_sql_directory() {
    directory="$1"
    label="$2"

    echo "LuxDex: applying ${label} from ${directory}"
    found=0
    for sql_file in "${directory}"/*.sql; do
        if [ ! -f "${sql_file}" ]; then
            continue
        fi

        found=1
        echo "LuxDex: applying ${sql_file}"
        psql \
            --set ON_ERROR_STOP=1 \
            --username "${POSTGRES_USER}" \
            --dbname "${POSTGRES_DB}" \
            --file "${sql_file}"
    done

    if [ "${found}" -eq 0 ]; then
        echo "LuxDex: no ${label} SQL files found"
    fi
}

apply_sql_directory /opt/luxdex/db/schema "schema"
apply_sql_directory /opt/luxdex/db/data/canonical "canonical data"

