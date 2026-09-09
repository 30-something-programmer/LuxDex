CREATE TABLE IF NOT EXISTS luxdex.penumbra_encounter_table (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_group_id bigint NOT NULL,
    source_table_number integer NOT NULL,
    source_order integer NOT NULL,
    source_line_start integer NOT NULL,
    source_line_end integer NOT NULL,
    CONSTRAINT penumbra_encounter_table_group_fkey
        FOREIGN KEY (map_group_id)
        REFERENCES luxdex.penumbra_map_group (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_encounter_table_group_number_key
        UNIQUE (map_group_id, source_table_number),
    CONSTRAINT penumbra_encounter_table_group_order_key
        UNIQUE (map_group_id, source_order),
    CONSTRAINT penumbra_encounter_table_number_positive CHECK (source_table_number > 0),
    CONSTRAINT penumbra_encounter_table_order_positive CHECK (source_order > 0),
    CONSTRAINT penumbra_encounter_table_source_lines_valid CHECK (
        source_line_start > 0 AND source_line_end >= source_line_start
    )
);

CREATE TABLE IF NOT EXISTS luxdex.penumbra_encounter_pool (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_table_id bigint NOT NULL,
    time_of_day text NOT NULL,
    pool_type text NOT NULL,
    sos_slot smallint,
    source_order smallint NOT NULL,
    min_level smallint,
    max_level smallint,
    source_line_number integer NOT NULL,
    source_entry_count smallint NOT NULL,
    empty_entry_count smallint NOT NULL,
    empty_rate_total_percent smallint,
    rate_total_percent smallint,
    CONSTRAINT penumbra_encounter_pool_table_fkey
        FOREIGN KEY (encounter_table_id)
        REFERENCES luxdex.penumbra_encounter_table (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_encounter_pool_natural_key
        UNIQUE NULLS NOT DISTINCT (encounter_table_id, time_of_day, pool_type, sos_slot),
    CONSTRAINT penumbra_encounter_pool_table_time_order_key
        UNIQUE (encounter_table_id, time_of_day, source_order),
    CONSTRAINT penumbra_encounter_pool_time_of_day_valid CHECK (
        time_of_day IN ('day', 'night')
    ),
    CONSTRAINT penumbra_encounter_pool_type_valid CHECK (
        pool_type IN ('normal', 'sos', 'additional_sos')
    ),
    CONSTRAINT penumbra_encounter_pool_shape_valid CHECK (
        (
            pool_type = 'normal'
            AND sos_slot IS NULL
            AND min_level IS NOT NULL
            AND max_level IS NOT NULL
            AND empty_rate_total_percent = 0
            AND rate_total_percent = 100
        )
        OR (
            pool_type = 'sos'
            AND sos_slot BETWEEN 1 AND 7
            AND min_level IS NOT NULL
            AND max_level IS NOT NULL
            AND empty_rate_total_percent = 0
            AND rate_total_percent = 100
        )
        OR (
            pool_type = 'additional_sos'
            AND sos_slot IS NULL
            AND min_level IS NULL
            AND max_level IS NULL
            AND empty_rate_total_percent IS NULL
            AND rate_total_percent IS NULL
        )
    ),
    CONSTRAINT penumbra_encounter_pool_source_order_valid CHECK (source_order BETWEEN 1 AND 9),
    CONSTRAINT penumbra_encounter_pool_levels_valid CHECK (
        min_level IS NULL OR (min_level > 0 AND max_level >= min_level)
    ),
    CONSTRAINT penumbra_encounter_pool_source_line_positive CHECK (source_line_number > 0),
    CONSTRAINT penumbra_encounter_pool_entry_counts_valid CHECK (
        source_entry_count >= 0
        AND empty_entry_count >= 0
        AND empty_entry_count <= source_entry_count
    ),
    CONSTRAINT penumbra_encounter_pool_rate_total_valid CHECK (
        rate_total_percent IS NULL OR rate_total_percent BETWEEN 0 AND 100
    ),
    CONSTRAINT penumbra_encounter_pool_empty_rate_total_valid CHECK (
        empty_rate_total_percent IS NULL
        OR empty_rate_total_percent BETWEEN 0 AND 100
    )
);

CREATE TABLE IF NOT EXISTS luxdex.penumbra_encounter (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_pool_id bigint NOT NULL,
    source_order smallint NOT NULL,
    source_pokemon_name text NOT NULL,
    rate_percent smallint,
    source_line_number integer NOT NULL,
    CONSTRAINT penumbra_encounter_pool_fkey
        FOREIGN KEY (encounter_pool_id)
        REFERENCES luxdex.penumbra_encounter_pool (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_encounter_pool_order_key
        UNIQUE (encounter_pool_id, source_order),
    CONSTRAINT penumbra_encounter_source_order_positive CHECK (source_order > 0),
    CONSTRAINT penumbra_encounter_pokemon_name_not_blank CHECK (
        btrim(source_pokemon_name) <> '' AND source_pokemon_name <> '(None)'
    ),
    CONSTRAINT penumbra_encounter_rate_valid CHECK (
        rate_percent IS NULL OR rate_percent BETWEEN 0 AND 100
    ),
    CONSTRAINT penumbra_encounter_source_line_positive CHECK (source_line_number > 0)
);

COMMENT ON TABLE luxdex.penumbra_encounter_table IS
    'A numbered encounter table exactly as declared within one source map group; no physical terrain meaning is inferred.';
COMMENT ON TABLE luxdex.penumbra_encounter_pool IS
    'One Day/Night normal, numbered SOS, or Additional SOS pool, including source-slot accounting and trace lines.';
COMMENT ON COLUMN luxdex.penumbra_encounter_pool.rate_total_percent IS
    'Total of percentage-bearing source entries. Additional SOS pools are NULL because their source line supplies no rates.';
COMMENT ON TABLE luxdex.penumbra_encounter IS
    'An ordered literal source Pokémon/form occurrence. Explicit (None) source slots are counted on the pool but not persisted here.';
COMMENT ON COLUMN luxdex.penumbra_encounter.rate_percent IS
    'NULL only when the Additional SOS source construct supplies a name without a percentage.';
