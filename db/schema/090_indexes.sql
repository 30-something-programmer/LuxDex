CREATE INDEX IF NOT EXISTS penumbra_map_location_raw_map_number_idx
    ON luxdex.penumbra_map_location (raw_map_number);

CREATE INDEX IF NOT EXISTS penumbra_map_location_name_prefix_idx
    ON luxdex.penumbra_map_location (lower(source_location_name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS penumbra_encounter_pokemon_name_prefix_idx
    ON luxdex.penumbra_encounter (lower(source_pokemon_name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS pokemon_source_file_dataset_idx
    ON luxdex.pokemon_source_file (dataset_id);

CREATE INDEX IF NOT EXISTS pokemon_species_generation_national_idx
    ON luxdex.pokemon_species (generation, national_dex_number);

CREATE INDEX IF NOT EXISTS pokemon_species_display_name_idx
    ON luxdex.pokemon_species (lower(display_name), national_dex_number);

CREATE INDEX IF NOT EXISTS pokemon_form_species_order_idx
    ON luxdex.pokemon_form (species_id, form_order, id);

CREATE INDEX IF NOT EXISTS pokemon_pokedex_number_species_idx
    ON luxdex.pokemon_pokedex_number (species_id, pokedex_id);

COMMENT ON INDEX luxdex.penumbra_map_location_name_prefix_idx IS
    'Supports case-insensitive prefix lookup without requiring a fuzzy-search extension.';
COMMENT ON INDEX luxdex.penumbra_encounter_pokemon_name_prefix_idx IS
    'Supports case-insensitive raw Pokémon/form prefix lookup.';
