CREATE TABLE IF NOT EXISTS luxdex.penumbra_pokemon_identity_build (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    penumbra_dataset_id bigint NOT NULL,
    pokemon_dataset_id bigint NOT NULL,
    alias_filename text NOT NULL,
    alias_sha256 text NOT NULL,
    resolver_version text NOT NULL,
    total_identity_count integer NOT NULL,
    exact_count integer NOT NULL,
    normalised_exact_count integer NOT NULL,
    explicit_alias_count integer NOT NULL,
    explicit_form_alias_count integer NOT NULL,
    unresolved_count integer NOT NULL,
    built_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT penumbra_pokemon_identity_build_penumbra_fkey
        FOREIGN KEY (penumbra_dataset_id)
        REFERENCES luxdex.source_dataset (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_pokemon_identity_build_pokemon_fkey
        FOREIGN KEY (pokemon_dataset_id)
        REFERENCES luxdex.pokemon_source_dataset (dataset_id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_pokemon_identity_build_penumbra_key
        UNIQUE (penumbra_dataset_id),
    CONSTRAINT penumbra_pokemon_identity_build_alias_filename_not_blank
        CHECK (btrim(alias_filename) <> ''),
    CONSTRAINT penumbra_pokemon_identity_build_alias_sha256_format
        CHECK (alias_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT penumbra_pokemon_identity_build_resolver_version_not_blank
        CHECK (btrim(resolver_version) <> ''),
    CONSTRAINT penumbra_pokemon_identity_build_counts_valid CHECK (
        total_identity_count >= 0
        AND exact_count >= 0
        AND normalised_exact_count >= 0
        AND explicit_alias_count >= 0
        AND explicit_form_alias_count >= 0
        AND unresolved_count >= 0
        AND total_identity_count = exact_count
            + normalised_exact_count
            + explicit_alias_count
            + explicit_form_alias_count
            + unresolved_count
    )
);

CREATE TABLE IF NOT EXISTS luxdex.penumbra_pokemon_source_identity (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    build_id bigint NOT NULL,
    source_pokemon_name text NOT NULL,
    occurrence_count integer NOT NULL,
    pre_resolution_classification text NOT NULL,
    resolution_note text NOT NULL,
    CONSTRAINT penumbra_pokemon_source_identity_build_fkey
        FOREIGN KEY (build_id)
        REFERENCES luxdex.penumbra_pokemon_identity_build (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_pokemon_source_identity_source_name_key
        UNIQUE (source_pokemon_name),
    CONSTRAINT penumbra_pokemon_source_identity_build_name_key
        UNIQUE (build_id, source_pokemon_name),
    CONSTRAINT penumbra_pokemon_source_identity_source_name_not_blank
        CHECK (btrim(source_pokemon_name) <> ''),
    CONSTRAINT penumbra_pokemon_source_identity_occurrence_count_positive
        CHECK (occurrence_count > 0),
    CONSTRAINT penumbra_pokemon_source_identity_classification_valid CHECK (
        pre_resolution_classification IN (
            'exact',
            'normalised_exact',
            'form_alias_required',
            'alias_required',
            'unresolved'
        )
    ),
    CONSTRAINT penumbra_pokemon_source_identity_resolution_note_not_blank
        CHECK (btrim(resolution_note) <> '')
);

CREATE TABLE IF NOT EXISTS luxdex.penumbra_pokemon_identity_map (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_identity_id bigint NOT NULL,
    pokemon_form_id bigint NOT NULL,
    mapping_method text NOT NULL,
    mapping_confidence text NOT NULL,
    mapping_note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT penumbra_pokemon_identity_map_source_fkey
        FOREIGN KEY (source_identity_id)
        REFERENCES luxdex.penumbra_pokemon_source_identity (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_pokemon_identity_map_form_fkey
        FOREIGN KEY (pokemon_form_id)
        REFERENCES luxdex.pokemon_form (id)
        ON DELETE CASCADE,
    CONSTRAINT penumbra_pokemon_identity_map_source_key
        UNIQUE (source_identity_id),
    CONSTRAINT penumbra_pokemon_identity_map_method_valid CHECK (
        mapping_method IN (
            'exact',
            'normalised_exact',
            'explicit_alias',
            'explicit_form_alias',
            'manual_verified'
        )
    ),
    CONSTRAINT penumbra_pokemon_identity_map_confidence_valid
        CHECK (mapping_confidence = 'verified'),
    CONSTRAINT penumbra_pokemon_identity_map_note_not_blank
        CHECK (btrim(mapping_note) <> '')
);

CREATE OR REPLACE VIEW luxdex.penumbra_encounter_resolved AS
SELECT
    encounter.id AS encounter_id,
    encounter.source_pokemon_name,
    identity_map.mapping_method,
    identity_map.mapping_confidence,
    form.id AS pokemon_form_id,
    form.form_key AS canonical_key,
    form.display_name AS canonical_display_name,
    species.id AS pokemon_species_id,
    species.identifier AS species_key,
    species.display_name AS species_display_name,
    species.national_dex_number,
    alola_number.dex_number AS alola_dex_number,
    sprite.local_path AS local_sprite_path
FROM luxdex.penumbra_encounter AS encounter
LEFT JOIN luxdex.penumbra_pokemon_source_identity AS source_identity
  ON source_identity.source_pokemon_name = encounter.source_pokemon_name
LEFT JOIN luxdex.penumbra_pokemon_identity_map AS identity_map
  ON identity_map.source_identity_id = source_identity.id
LEFT JOIN luxdex.pokemon_form AS form
  ON form.id = identity_map.pokemon_form_id
LEFT JOIN luxdex.pokemon_species AS species
  ON species.id = form.species_id
LEFT JOIN luxdex.pokemon_sprite_asset AS sprite
  ON sprite.form_id = form.id
LEFT JOIN luxdex.pokemon_pokedex AS alola_dex
  ON alola_dex.dataset_id = species.dataset_id
 AND alola_dex.dex_key = 'alola-usum'
LEFT JOIN luxdex.pokemon_pokedex_number AS alola_number
  ON alola_number.pokedex_id = alola_dex.id
 AND alola_number.species_id = species.id;

COMMENT ON TABLE luxdex.penumbra_pokemon_identity_build IS
    'One deterministic resolver run joining the active Penumbra source dataset to one canonical Pokémon dataset.';
COMMENT ON TABLE luxdex.penumbra_pokemon_source_identity IS
    'Complete distinct raw-name inventory derived from immutable Penumbra encounter rows, including unresolved identities.';
COMMENT ON TABLE luxdex.penumbra_pokemon_identity_map IS
    'Verified-only mapping from one literal Penumbra source identity to its most specific canonical Pokémon form.';
COMMENT ON VIEW luxdex.penumbra_encounter_resolved IS
    'Read-only identity projection retaining each literal encounter name while exposing its verified canonical form and local sprite.';
COMMENT ON COLUMN luxdex.penumbra_pokemon_source_identity.pre_resolution_classification IS
    'How the raw identity classified before explicit aliases were applied; this preserves the required source inventory audit.';
COMMENT ON COLUMN luxdex.penumbra_pokemon_identity_map.mapping_confidence IS
    'Persisted mappings are verified; unresolved identities remain in the source inventory without a mapping row.';
