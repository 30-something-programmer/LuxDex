CREATE TABLE IF NOT EXISTS luxdex.penumbra_map_group (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id bigint NOT NULL,
    source_sequence integer NOT NULL,
    raw_header text NOT NULL,
    declared_table_count integer NOT NULL,
    source_line_start integer NOT NULL,
    source_line_end integer NOT NULL,
    CONSTRAINT penumbra_map_group_dataset_fkey
        FOREIGN KEY (dataset_id)
        REFERENCES luxdex.source_dataset (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_map_group_dataset_sequence_key
        UNIQUE (dataset_id, source_sequence),
    CONSTRAINT penumbra_map_group_source_sequence_positive CHECK (source_sequence > 0),
    CONSTRAINT penumbra_map_group_raw_header_not_blank CHECK (btrim(raw_header) <> ''),
    CONSTRAINT penumbra_map_group_declared_table_count_nonnegative CHECK (declared_table_count >= 0),
    CONSTRAINT penumbra_map_group_source_lines_valid CHECK (
        source_line_start > 0 AND source_line_end >= source_line_start
    )
);

CREATE TABLE IF NOT EXISTS luxdex.penumbra_map_location (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_group_id bigint NOT NULL,
    source_order smallint NOT NULL,
    raw_map_number integer NOT NULL,
    source_location_name text NOT NULL,
    raw_reference text NOT NULL,
    CONSTRAINT penumbra_map_location_group_fkey
        FOREIGN KEY (map_group_id)
        REFERENCES luxdex.penumbra_map_group (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_map_location_group_order_key
        UNIQUE (map_group_id, source_order),
    CONSTRAINT penumbra_map_location_source_order_positive CHECK (source_order > 0),
    CONSTRAINT penumbra_map_location_raw_map_number_nonnegative CHECK (raw_map_number >= 0),
    CONSTRAINT penumbra_map_location_name_not_blank CHECK (btrim(source_location_name) <> ''),
    CONSTRAINT penumbra_map_location_raw_reference_not_blank CHECK (btrim(raw_reference) <> '')
);

COMMENT ON TABLE luxdex.penumbra_map_group IS
    'One Map: block from the authoritative Penumbra source; it is not a player-facing LuxDex location.';
COMMENT ON TABLE luxdex.penumbra_map_location IS
    'An ordered, literal map-number/location reference parsed from a Penumbra Map: header.';
