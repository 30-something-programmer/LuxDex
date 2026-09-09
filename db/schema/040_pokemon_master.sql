CREATE TABLE IF NOT EXISTS luxdex.pokemon_source_dataset (
    dataset_id bigint PRIMARY KEY,
    data_repository text NOT NULL,
    data_commit_sha text NOT NULL,
    sprite_repository text NOT NULL,
    sprite_commit_sha text NOT NULL,
    acquisition_date date NOT NULL,
    data_license_path text NOT NULL,
    sprite_license_path text NOT NULL,
    CONSTRAINT pokemon_source_dataset_dataset_fkey
        FOREIGN KEY (dataset_id)
        REFERENCES luxdex.source_dataset (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_source_dataset_data_repository_not_blank
        CHECK (btrim(data_repository) <> ''),
    CONSTRAINT pokemon_source_dataset_data_commit_sha_format
        CHECK (data_commit_sha ~ '^[0-9a-f]{40}$'),
    CONSTRAINT pokemon_source_dataset_sprite_repository_not_blank
        CHECK (btrim(sprite_repository) <> ''),
    CONSTRAINT pokemon_source_dataset_sprite_commit_sha_format
        CHECK (sprite_commit_sha ~ '^[0-9a-f]{40}$'),
    CONSTRAINT pokemon_source_dataset_data_license_path_not_blank
        CHECK (btrim(data_license_path) <> ''),
    CONSTRAINT pokemon_source_dataset_sprite_license_path_not_blank
        CHECK (btrim(sprite_license_path) <> '')
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_source_file (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id bigint NOT NULL,
    source_order smallint NOT NULL,
    source_component text NOT NULL,
    source_role text NOT NULL,
    source_path text NOT NULL,
    sha256 text NOT NULL,
    byte_count bigint NOT NULL,
    CONSTRAINT pokemon_source_file_dataset_fkey
        FOREIGN KEY (dataset_id)
        REFERENCES luxdex.pokemon_source_dataset (dataset_id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_source_file_dataset_order_key
        UNIQUE (dataset_id, source_order),
    CONSTRAINT pokemon_source_file_dataset_path_key
        UNIQUE (dataset_id, source_component, source_path),
    CONSTRAINT pokemon_source_file_source_order_positive CHECK (source_order > 0),
    CONSTRAINT pokemon_source_file_component_valid
        CHECK (source_component IN ('pokeapi-data', 'pokeapi-sprites')),
    CONSTRAINT pokemon_source_file_role_valid
        CHECK (source_role IN ('data', 'license', 'manifest')),
    CONSTRAINT pokemon_source_file_path_not_blank CHECK (btrim(source_path) <> ''),
    CONSTRAINT pokemon_source_file_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT pokemon_source_file_byte_count_positive CHECK (byte_count > 0)
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_species (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id bigint NOT NULL,
    national_dex_number smallint NOT NULL,
    identifier text NOT NULL,
    display_name text NOT NULL,
    generation smallint NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT pokemon_species_dataset_fkey
        FOREIGN KEY (dataset_id)
        REFERENCES luxdex.pokemon_source_dataset (dataset_id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_species_dataset_national_key
        UNIQUE (dataset_id, national_dex_number),
    CONSTRAINT pokemon_species_dataset_identifier_key
        UNIQUE (dataset_id, identifier),
    CONSTRAINT pokemon_species_national_range
        CHECK (national_dex_number BETWEEN 1 AND 807),
    CONSTRAINT pokemon_species_identifier_format
        CHECK (identifier ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT pokemon_species_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT pokemon_species_generation_range CHECK (generation BETWEEN 1 AND 7)
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_species_source_mapping (
    species_id bigint PRIMARY KEY,
    upstream_species_id integer NOT NULL,
    upstream_identifier text NOT NULL,
    CONSTRAINT pokemon_species_source_mapping_species_fkey
        FOREIGN KEY (species_id)
        REFERENCES luxdex.pokemon_species (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_species_source_mapping_upstream_id_key
        UNIQUE (upstream_species_id),
    CONSTRAINT pokemon_species_source_mapping_identifier_not_blank
        CHECK (btrim(upstream_identifier) <> ''),
    CONSTRAINT pokemon_species_source_mapping_id_positive
        CHECK (upstream_species_id > 0)
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_form (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    species_id bigint NOT NULL,
    form_key text NOT NULL,
    identifier text NOT NULL,
    display_name text NOT NULL,
    display_name_source text NOT NULL,
    is_default boolean NOT NULL,
    form_order integer NOT NULL,
    is_battle_only boolean NOT NULL,
    is_mega boolean NOT NULL,
    is_regional boolean NOT NULL,
    regional_name text,
    sprite_key text NOT NULL,
    CONSTRAINT pokemon_form_species_fkey
        FOREIGN KEY (species_id)
        REFERENCES luxdex.pokemon_species (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_form_form_key_key UNIQUE (form_key),
    CONSTRAINT pokemon_form_sprite_key_key UNIQUE (sprite_key),
    CONSTRAINT pokemon_form_species_identifier_key UNIQUE (species_id, identifier),
    CONSTRAINT pokemon_form_form_key_format
        CHECK (form_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)?$'),
    CONSTRAINT pokemon_form_identifier_format
        CHECK (identifier ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT pokemon_form_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT pokemon_form_display_name_source_valid CHECK (
        display_name_source IN (
            'species_name',
            'pokemon_form_name',
            'form_name',
            'derived_form_identifier'
        )
    ),
    CONSTRAINT pokemon_form_order_positive CHECK (form_order > 0),
    CONSTRAINT pokemon_form_regional_shape CHECK (
        (is_regional AND regional_name IS NOT NULL AND btrim(regional_name) <> '')
        OR (NOT is_regional AND regional_name IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS pokemon_form_one_default_per_species_idx
    ON luxdex.pokemon_form (species_id)
    WHERE is_default;

CREATE TABLE IF NOT EXISTS luxdex.pokemon_form_source_mapping (
    form_id bigint PRIMARY KEY,
    upstream_pokemon_id integer NOT NULL,
    upstream_form_id integer NOT NULL,
    upstream_pokemon_identifier text NOT NULL,
    upstream_form_identifier text,
    introduced_version_group_id integer NOT NULL,
    CONSTRAINT pokemon_form_source_mapping_form_fkey
        FOREIGN KEY (form_id)
        REFERENCES luxdex.pokemon_form (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_form_source_mapping_upstream_form_id_key
        UNIQUE (upstream_form_id),
    CONSTRAINT pokemon_form_source_mapping_upstream_pair_key
        UNIQUE (upstream_pokemon_id, upstream_form_id),
    CONSTRAINT pokemon_form_source_mapping_pokemon_id_positive
        CHECK (upstream_pokemon_id > 0),
    CONSTRAINT pokemon_form_source_mapping_form_id_positive
        CHECK (upstream_form_id > 0),
    CONSTRAINT pokemon_form_source_mapping_pokemon_identifier_not_blank
        CHECK (btrim(upstream_pokemon_identifier) <> ''),
    CONSTRAINT pokemon_form_source_mapping_form_identifier_not_blank
        CHECK (upstream_form_identifier IS NULL OR btrim(upstream_form_identifier) <> ''),
    CONSTRAINT pokemon_form_source_mapping_version_group_positive
        CHECK (introduced_version_group_id > 0)
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_pokedex (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id bigint NOT NULL,
    dex_key text NOT NULL,
    display_name text NOT NULL,
    upstream_pokedex_id integer NOT NULL,
    is_in_game boolean NOT NULL,
    CONSTRAINT pokemon_pokedex_dataset_fkey
        FOREIGN KEY (dataset_id)
        REFERENCES luxdex.pokemon_source_dataset (dataset_id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_pokedex_dataset_key_key UNIQUE (dataset_id, dex_key),
    CONSTRAINT pokemon_pokedex_dataset_upstream_id_key UNIQUE (dataset_id, upstream_pokedex_id),
    CONSTRAINT pokemon_pokedex_key_format
        CHECK (dex_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT pokemon_pokedex_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT pokemon_pokedex_upstream_id_positive CHECK (upstream_pokedex_id > 0)
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_pokedex_number (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pokedex_id bigint NOT NULL,
    species_id bigint NOT NULL,
    dex_number smallint NOT NULL,
    CONSTRAINT pokemon_pokedex_number_pokedex_fkey
        FOREIGN KEY (pokedex_id)
        REFERENCES luxdex.pokemon_pokedex (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_pokedex_number_species_fkey
        FOREIGN KEY (species_id)
        REFERENCES luxdex.pokemon_species (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_pokedex_number_dex_number_key UNIQUE (pokedex_id, dex_number),
    CONSTRAINT pokemon_pokedex_number_dex_species_key UNIQUE (pokedex_id, species_id),
    CONSTRAINT pokemon_pokedex_number_positive CHECK (dex_number > 0)
);

CREATE TABLE IF NOT EXISTS luxdex.pokemon_sprite_asset (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    form_id bigint NOT NULL,
    sprite_family text NOT NULL,
    local_path text NOT NULL,
    upstream_path text NOT NULL,
    sha256 text NOT NULL,
    byte_count integer NOT NULL,
    width smallint NOT NULL,
    height smallint NOT NULL,
    CONSTRAINT pokemon_sprite_asset_form_fkey
        FOREIGN KEY (form_id)
        REFERENCES luxdex.pokemon_form (id)
        ON DELETE CASCADE,
    CONSTRAINT pokemon_sprite_asset_form_key UNIQUE (form_id),
    CONSTRAINT pokemon_sprite_asset_local_path_key UNIQUE (local_path),
    CONSTRAINT pokemon_sprite_asset_family_not_blank CHECK (btrim(sprite_family) <> ''),
    CONSTRAINT pokemon_sprite_asset_local_path_format
        CHECK (local_path ~ '^/assets/pokemon/sprites/[a-z0-9][a-z0-9-]*[.]png$'),
    CONSTRAINT pokemon_sprite_asset_upstream_path_not_blank
        CHECK (btrim(upstream_path) <> ''),
    CONSTRAINT pokemon_sprite_asset_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT pokemon_sprite_asset_byte_count_positive CHECK (byte_count > 0),
    CONSTRAINT pokemon_sprite_asset_dimensions_positive CHECK (width > 0 AND height > 0)
);

COMMENT ON TABLE luxdex.pokemon_source_dataset IS
    'Pinned PokéAPI data and sprite donor revisions extending the shared source_dataset record.';
COMMENT ON TABLE luxdex.pokemon_source_file IS
    'Checksums for the minimal vendored donor files and generated sprite manifest used by one Pokémon import.';
COMMENT ON TABLE luxdex.pokemon_species IS
    'Canonical active National Pokédex species through Zeraora (#807), separate from version-specific Pokédex numbering.';
COMMENT ON TABLE luxdex.pokemon_form IS
    'Stable LuxDex form identities introduced no later than Ultra Sun/Ultra Moon; one default form is enforced per species.';
COMMENT ON TABLE luxdex.pokemon_pokedex_number IS
    'National, USUM Alola, and USUM island sub-dex memberships copied from pinned upstream relationships.';
COMMENT ON TABLE luxdex.pokemon_sprite_asset IS
    'An exact local Gen VII USUM front sprite mapping for a form; a missing row means no correct form-specific donor asset was found.';
