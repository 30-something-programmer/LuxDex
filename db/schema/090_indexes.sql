CREATE INDEX IF NOT EXISTS penumbra_map_location_raw_map_number_idx
    ON luxdex.penumbra_map_location (raw_map_number);

CREATE INDEX IF NOT EXISTS penumbra_map_location_name_prefix_idx
    ON luxdex.penumbra_map_location (lower(source_location_name) text_pattern_ops);

CREATE INDEX IF NOT EXISTS penumbra_encounter_pokemon_name_prefix_idx
    ON luxdex.penumbra_encounter (lower(source_pokemon_name) text_pattern_ops);

COMMENT ON INDEX luxdex.penumbra_map_location_name_prefix_idx IS
    'Supports case-insensitive prefix lookup without requiring a fuzzy-search extension.';
COMMENT ON INDEX luxdex.penumbra_encounter_pokemon_name_prefix_idx IS
    'Supports case-insensitive raw Pokémon/form prefix lookup.';
