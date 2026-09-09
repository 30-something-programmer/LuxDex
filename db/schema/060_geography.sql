CREATE TABLE IF NOT EXISTS luxdex.geography_build (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    penumbra_dataset_id bigint NOT NULL,
    pokemon_dataset_id bigint NOT NULL,
    identity_build_id bigint NOT NULL,
    canonical_bundle_sha256 text NOT NULL,
    mapper_version text NOT NULL,
    vanilla_source_filename text NOT NULL,
    vanilla_source_sha256 text NOT NULL,
    vanilla_source_commit text NOT NULL,
    total_table_count integer NOT NULL,
    verified_table_count integer NOT NULL,
    unresolved_table_count integer NOT NULL,
    built_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT geography_build_penumbra_fkey
        FOREIGN KEY (penumbra_dataset_id)
        REFERENCES luxdex.source_dataset (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_build_pokemon_fkey
        FOREIGN KEY (pokemon_dataset_id)
        REFERENCES luxdex.pokemon_source_dataset (dataset_id)
        ON DELETE CASCADE,
    CONSTRAINT geography_build_identity_fkey
        FOREIGN KEY (identity_build_id)
        REFERENCES luxdex.penumbra_pokemon_identity_build (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_build_penumbra_key UNIQUE (penumbra_dataset_id),
    CONSTRAINT geography_build_bundle_sha256_format
        CHECK (canonical_bundle_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT geography_build_mapper_version_not_blank
        CHECK (btrim(mapper_version) <> ''),
    CONSTRAINT geography_build_vanilla_filename_not_blank
        CHECK (btrim(vanilla_source_filename) <> ''),
    CONSTRAINT geography_build_vanilla_sha256_format
        CHECK (vanilla_source_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT geography_build_vanilla_commit_format
        CHECK (vanilla_source_commit ~ '^[0-9a-f]{40}$'),
    CONSTRAINT geography_build_counts_valid CHECK (
        total_table_count >= 0
        AND verified_table_count >= 0
        AND unresolved_table_count >= 0
        AND total_table_count = verified_table_count + unresolved_table_count
    )
);

CREATE TABLE IF NOT EXISTS luxdex.geography_area_group (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    build_id bigint NOT NULL,
    group_key text NOT NULL,
    display_name text NOT NULL,
    display_order smallint NOT NULL,
    group_type text NOT NULL,
    CONSTRAINT geography_area_group_build_fkey
        FOREIGN KEY (build_id)
        REFERENCES luxdex.geography_build (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_area_group_build_key UNIQUE (build_id, group_key),
    CONSTRAINT geography_area_group_build_order_key UNIQUE (build_id, display_order),
    CONSTRAINT geography_area_group_key_format
        CHECK (group_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT geography_area_group_display_name_not_blank
        CHECK (btrim(display_name) <> ''),
    CONSTRAINT geography_area_group_display_order_positive
        CHECK (display_order > 0),
    CONSTRAINT geography_area_group_type_valid
        CHECK (group_type IN ('island', 'other', 'special'))
);

CREATE TABLE IF NOT EXISTS luxdex.geography_location (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    area_group_id bigint NOT NULL,
    location_key text NOT NULL,
    display_name text NOT NULL,
    location_type text NOT NULL,
    display_order smallint NOT NULL,
    description text,
    CONSTRAINT geography_location_group_fkey
        FOREIGN KEY (area_group_id)
        REFERENCES luxdex.geography_area_group (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_location_key_key UNIQUE (location_key),
    CONSTRAINT geography_location_group_order_key UNIQUE (area_group_id, display_order),
    CONSTRAINT geography_location_key_format
        CHECK (location_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT geography_location_display_name_not_blank
        CHECK (btrim(display_name) <> ''),
    CONSTRAINT geography_location_type_not_blank
        CHECK (btrim(location_type) <> ''),
    CONSTRAINT geography_location_display_order_positive
        CHECK (display_order > 0),
    CONSTRAINT geography_location_description_not_blank
        CHECK (description IS NULL OR btrim(description) <> '')
);

CREATE TABLE IF NOT EXISTS luxdex.geography_encounter_place (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_id bigint NOT NULL,
    place_key text NOT NULL,
    display_name text NOT NULL,
    subtitle text,
    encounter_method text NOT NULL,
    requirement text,
    display_order smallint NOT NULL,
    mapping_status text NOT NULL,
    CONSTRAINT geography_encounter_place_location_fkey
        FOREIGN KEY (location_id)
        REFERENCES luxdex.geography_location (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_encounter_place_key_key UNIQUE (place_key),
    CONSTRAINT geography_encounter_place_location_order_key
        UNIQUE (location_id, display_order),
    CONSTRAINT geography_encounter_place_key_format
        CHECK (place_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT geography_encounter_place_display_name_not_blank
        CHECK (btrim(display_name) <> ''),
    CONSTRAINT geography_encounter_place_no_placeholder_name CHECK (
        display_name !~* '^\s*(table|zone)\s+[0-9a-z]+\s*$'
        AND display_name !~* '^\s*area\s+[a-z]\s*$'
    ),
    CONSTRAINT geography_encounter_place_subtitle_not_blank
        CHECK (subtitle IS NULL OR btrim(subtitle) <> ''),
    CONSTRAINT geography_encounter_place_method_valid CHECK (
        encounter_method IN (
            'grass',
            'surf',
            'fishing',
            'bubbling_fishing',
            'cave',
            'moving_shadow',
            'berry_pile',
            'special',
            'other'
        )
    ),
    CONSTRAINT geography_encounter_place_requirement_not_blank
        CHECK (requirement IS NULL OR btrim(requirement) <> ''),
    CONSTRAINT geography_encounter_place_display_order_positive
        CHECK (display_order > 0),
    CONSTRAINT geography_encounter_place_status_verified
        CHECK (mapping_status = 'verified')
);

CREATE TABLE IF NOT EXISTS luxdex.geography_source_reference (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    build_id bigint NOT NULL,
    source_key text NOT NULL,
    source_title text NOT NULL,
    source_url text NOT NULL,
    source_type text NOT NULL,
    accessed_on date NOT NULL,
    source_note text NOT NULL,
    CONSTRAINT geography_source_reference_build_fkey
        FOREIGN KEY (build_id)
        REFERENCES luxdex.geography_build (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_source_reference_build_key UNIQUE (build_id, source_key),
    CONSTRAINT geography_source_reference_key_format
        CHECK (source_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT geography_source_reference_title_not_blank
        CHECK (btrim(source_title) <> ''),
    CONSTRAINT geography_source_reference_url_not_blank
        CHECK (btrim(source_url) <> ''),
    CONSTRAINT geography_source_reference_type_valid CHECK (
        source_type IN (
            'structured_dump',
            'location_reference',
            'walkthrough',
            'supporting_reference'
        )
    ),
    CONSTRAINT geography_source_reference_note_not_blank
        CHECK (btrim(source_note) <> '')
);

CREATE TABLE IF NOT EXISTS luxdex.geography_encounter_place_table_map (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    encounter_place_id bigint NOT NULL,
    penumbra_encounter_table_id bigint NOT NULL,
    mapping_method text NOT NULL,
    mapping_status text NOT NULL,
    mapping_note text NOT NULL,
    CONSTRAINT geography_table_map_place_fkey
        FOREIGN KEY (encounter_place_id)
        REFERENCES luxdex.geography_encounter_place (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_table_map_penumbra_table_fkey
        FOREIGN KEY (penumbra_encounter_table_id)
        REFERENCES luxdex.penumbra_encounter_table (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_table_map_penumbra_table_key
        UNIQUE (penumbra_encounter_table_id),
    CONSTRAINT geography_table_map_method_valid CHECK (
        mapping_method IN (
            'explicit_documentation',
            'vanilla_pool_match',
            'explicit_method_match',
            'route_subarea_match',
            'manual_verified'
        )
    ),
    CONSTRAINT geography_table_map_status_verified
        CHECK (mapping_status = 'verified'),
    CONSTRAINT geography_table_map_note_not_blank
        CHECK (btrim(mapping_note) <> '')
);

CREATE TABLE IF NOT EXISTS luxdex.geography_mapping_evidence (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_mapping_id bigint NOT NULL,
    source_reference_id bigint NOT NULL,
    evidence_order smallint NOT NULL,
    source_locator text NOT NULL,
    evidence_note text NOT NULL,
    CONSTRAINT geography_mapping_evidence_mapping_fkey
        FOREIGN KEY (table_mapping_id)
        REFERENCES luxdex.geography_encounter_place_table_map (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_mapping_evidence_source_fkey
        FOREIGN KEY (source_reference_id)
        REFERENCES luxdex.geography_source_reference (id)
        ON DELETE CASCADE,
    CONSTRAINT geography_mapping_evidence_mapping_order_key
        UNIQUE (table_mapping_id, evidence_order),
    CONSTRAINT geography_mapping_evidence_mapping_source_key
        UNIQUE (table_mapping_id, source_reference_id),
    CONSTRAINT geography_mapping_evidence_order_positive
        CHECK (evidence_order > 0),
    CONSTRAINT geography_mapping_evidence_locator_not_blank
        CHECK (btrim(source_locator) <> ''),
    CONSTRAINT geography_mapping_evidence_note_not_blank
        CHECK (btrim(evidence_note) <> '')
);

CREATE OR REPLACE FUNCTION luxdex.require_geography_mapping_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    mapping_id bigint;
BEGIN
    IF TG_TABLE_NAME = 'geography_mapping_evidence' THEN
        mapping_id := OLD.table_mapping_id;
    ELSE
        mapping_id := NEW.id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM luxdex.geography_encounter_place_table_map AS table_map
        WHERE table_map.id = mapping_id
    ) AND NOT EXISTS (
        SELECT 1
        FROM luxdex.geography_mapping_evidence AS evidence
        WHERE evidence.table_mapping_id = mapping_id
    ) THEN
        RAISE EXCEPTION 'verified geography table mapping % requires evidence', mapping_id;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS geography_table_map_requires_evidence
    ON luxdex.geography_encounter_place_table_map;
CREATE CONSTRAINT TRIGGER geography_table_map_requires_evidence
AFTER INSERT OR UPDATE ON luxdex.geography_encounter_place_table_map
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION luxdex.require_geography_mapping_evidence();

DROP TRIGGER IF EXISTS geography_evidence_delete_preserves_requirement
    ON luxdex.geography_mapping_evidence;
CREATE CONSTRAINT TRIGGER geography_evidence_delete_preserves_requirement
AFTER DELETE OR UPDATE ON luxdex.geography_mapping_evidence
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION luxdex.require_geography_mapping_evidence();

CREATE OR REPLACE VIEW luxdex.geography_encounter_full AS
SELECT
    area_group.group_key,
    area_group.display_name AS group_display_name,
    location.location_key,
    location.display_name AS location_display_name,
    place.place_key,
    place.display_name AS place_display_name,
    place.subtitle AS place_subtitle,
    place.encounter_method,
    place.requirement,
    table_map.mapping_method AS geography_mapping_method,
    table_map.mapping_status AS geography_mapping_status,
    map_group.source_sequence AS raw_map_group_sequence,
    map_group.raw_header AS raw_map_header,
    encounter_table.source_table_number,
    pool.time_of_day,
    pool.pool_type,
    pool.sos_slot,
    pool.min_level,
    pool.max_level,
    encounter.source_order AS encounter_order,
    encounter.source_pokemon_name,
    encounter.rate_percent,
    resolved.canonical_key,
    resolved.canonical_display_name,
    resolved.species_key,
    resolved.species_display_name,
    resolved.national_dex_number,
    resolved.alola_dex_number,
    resolved.local_sprite_path
FROM luxdex.geography_encounter_place_table_map AS table_map
JOIN luxdex.geography_encounter_place AS place
  ON place.id = table_map.encounter_place_id
JOIN luxdex.geography_location AS location
  ON location.id = place.location_id
JOIN luxdex.geography_area_group AS area_group
  ON area_group.id = location.area_group_id
JOIN luxdex.penumbra_encounter_table AS encounter_table
  ON encounter_table.id = table_map.penumbra_encounter_table_id
JOIN luxdex.penumbra_map_group AS map_group
  ON map_group.id = encounter_table.map_group_id
JOIN luxdex.penumbra_encounter_pool AS pool
  ON pool.encounter_table_id = encounter_table.id
JOIN luxdex.penumbra_encounter AS encounter
  ON encounter.encounter_pool_id = pool.id
LEFT JOIN luxdex.penumbra_encounter_resolved AS resolved
  ON resolved.encounter_id = encounter.id;

CREATE INDEX IF NOT EXISTS geography_build_pokemon_idx
    ON luxdex.geography_build (pokemon_dataset_id);
CREATE INDEX IF NOT EXISTS geography_build_identity_idx
    ON luxdex.geography_build (identity_build_id);
CREATE INDEX IF NOT EXISTS geography_area_group_build_order_idx
    ON luxdex.geography_area_group (build_id, display_order, id);
CREATE INDEX IF NOT EXISTS geography_location_group_order_idx
    ON luxdex.geography_location (area_group_id, display_order, id);
CREATE INDEX IF NOT EXISTS geography_encounter_place_location_order_idx
    ON luxdex.geography_encounter_place (location_id, display_order, id);
CREATE INDEX IF NOT EXISTS geography_source_reference_build_idx
    ON luxdex.geography_source_reference (build_id, id);
CREATE INDEX IF NOT EXISTS geography_table_map_place_idx
    ON luxdex.geography_encounter_place_table_map (encounter_place_id, id);
CREATE INDEX IF NOT EXISTS geography_mapping_evidence_source_idx
    ON luxdex.geography_mapping_evidence (source_reference_id, table_mapping_id);

COMMENT ON TABLE luxdex.geography_build IS
    'One deterministic researched geography build tied to the exact Penumbra, Pokémon, identity, canonical bundle, and pinned vanilla structural donor versions.';
COMMENT ON TABLE luxdex.geography_area_group IS
    'Backend-owned top-level navigation groups, including the four Alola islands and a non-island fallback group.';
COMMENT ON TABLE luxdex.geography_location IS
    'Canonical player-facing locations; these are independent of raw Penumbra Map blocks.';
COMMENT ON TABLE luxdex.geography_encounter_place IS
    'Verified player-understandable encounter contexts within canonical locations.';
COMMENT ON TABLE luxdex.geography_encounter_place_table_map IS
    'Verified many-raw-tables-to-one-place mapping that preserves each raw Penumbra table identity.';
COMMENT ON TABLE luxdex.geography_mapping_evidence IS
    'Ordered evidence explaining each verified raw-table-to-place mapping.';
COMMENT ON VIEW luxdex.geography_encounter_full IS
    'End-to-end backend join from player geography through raw Penumbra encounters to canonical Pokémon forms and local sprites.';
