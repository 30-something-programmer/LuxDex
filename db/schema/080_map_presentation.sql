CREATE TABLE IF NOT EXISTS luxdex.map_presentation_node (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    node_key text NOT NULL UNIQUE,
    parent_id bigint,
    layer smallint NOT NULL CHECK (layer BETWEEN 1 AND 4),
    node_type text NOT NULL CHECK (node_type IN ('world', 'island', 'location', 'zone')),
    canonical_key text,
    display_name text NOT NULL CHECK (btrim(display_name) <> ''),
    asset_path text,
    geometry jsonb,
    label_x numeric(7,6),
    label_y numeric(7,6),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT map_presentation_node_parent_fkey FOREIGN KEY (parent_id)
        REFERENCES luxdex.map_presentation_node (id) ON DELETE CASCADE,
    CONSTRAINT map_presentation_node_parent_required CHECK (
        (layer = 1 AND parent_id IS NULL) OR (layer > 1 AND parent_id IS NOT NULL)
    ),
    CONSTRAINT map_presentation_node_geometry_array CHECK (
        geometry IS NULL OR jsonb_typeof(geometry) = 'array'
    )
);

CREATE TABLE IF NOT EXISTS luxdex.map_sprite_placement (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    zone_node_id bigint NOT NULL REFERENCES luxdex.map_presentation_node (id) ON DELETE CASCADE,
    pokemon_form_id bigint NOT NULL REFERENCES luxdex.pokemon_form (id) ON DELETE CASCADE,
    x numeric(7,6) NOT NULL CHECK (x BETWEEN 0 AND 1),
    y numeric(7,6) NOT NULL CHECK (y BETWEEN 0 AND 1),
    scale numeric(5,3) NOT NULL DEFAULT 1 CHECK (scale BETWEEN 0.25 AND 3),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT map_sprite_placement_zone_form_key UNIQUE (zone_node_id, pokemon_form_id)
);

CREATE INDEX IF NOT EXISTS map_presentation_node_parent_idx
    ON luxdex.map_presentation_node (parent_id, layer, node_key);
CREATE INDEX IF NOT EXISTS map_sprite_placement_form_idx
    ON luxdex.map_sprite_placement (pokemon_form_id);

CREATE OR REPLACE FUNCTION luxdex.validate_map_presentation_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_layer smallint;
BEGIN
    IF NEW.layer = 1 THEN
        RETURN NEW;
    END IF;
    SELECT layer INTO parent_layer
    FROM luxdex.map_presentation_node
    WHERE id = NEW.parent_id;
    IF parent_layer IS NULL OR parent_layer <> NEW.layer - 1 THEN
        RAISE EXCEPTION 'map presentation parent must be exactly one layer above';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS map_presentation_parent_layer_guard
    ON luxdex.map_presentation_node;
CREATE TRIGGER map_presentation_parent_layer_guard
BEFORE INSERT OR UPDATE OF parent_id, layer ON luxdex.map_presentation_node
FOR EACH ROW EXECUTE FUNCTION luxdex.validate_map_presentation_parent();

COMMENT ON TABLE luxdex.map_presentation_node IS
    'Map Studio presentation hierarchy and parent-normalised polygon geometry; never encounter truth.';
COMMENT ON TABLE luxdex.map_sprite_placement IS
    'Optional parent-normalised visual sprite placement for a canonical form inside a zone.';
