CREATE TABLE IF NOT EXISTS luxdex.source_dataset (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_name text NOT NULL,
    source_filename text NOT NULL,
    sha256 text NOT NULL,
    byte_count bigint NOT NULL,
    line_count integer NOT NULL,
    nonblank_line_count integer NOT NULL,
    parser_version text NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT source_dataset_source_name_key UNIQUE (source_name),
    CONSTRAINT source_dataset_source_name_not_blank CHECK (btrim(source_name) <> ''),
    CONSTRAINT source_dataset_source_filename_not_blank CHECK (btrim(source_filename) <> ''),
    CONSTRAINT source_dataset_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT source_dataset_byte_count_nonnegative CHECK (byte_count >= 0),
    CONSTRAINT source_dataset_line_count_nonnegative CHECK (line_count >= 0),
    CONSTRAINT source_dataset_nonblank_line_count_valid CHECK (
        nonblank_line_count >= 0 AND nonblank_line_count <= line_count
    ),
    CONSTRAINT source_dataset_parser_version_not_blank CHECK (btrim(parser_version) <> '')
);

COMMENT ON TABLE luxdex.source_dataset IS
    'The single active imported version of each authoritative source dataset. Replacing a source cascades only through its derived source rows.';
COMMENT ON COLUMN luxdex.source_dataset.line_count IS
    'Physical logical line count, including blank lines.';
COMMENT ON COLUMN luxdex.source_dataset.nonblank_line_count IS
    'Nonblank logical line count, retained because historical source metadata used this convention.';
