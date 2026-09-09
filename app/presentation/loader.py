from __future__ import annotations

import json
from pathlib import Path

from app.database import connect_database


def ensure_map_presentation() -> None:
    source = (
        Path(__file__).resolve().parents[2]
        / "db"
        / "data"
        / "canonical"
        / "presentation"
        / "melemele-map.json"
    )
    payload = json.loads(source.read_text(encoding="utf-8"))
    with connect_database() as connection:
        for node in payload["nodes"]:
            parent_id = None
            if node["parent"]:
                parent_id = connection.execute(
                    "SELECT id FROM luxdex.map_presentation_node WHERE node_key = %s",
                    (node["parent"],),
                ).fetchone()
                if parent_id is None:
                    continue
                parent_id = parent_id[0]
            connection.execute(
                """
                INSERT INTO luxdex.map_presentation_node
                    (node_key, parent_id, layer, node_type, canonical_key, display_name, asset_path, geometry)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (node_key) DO NOTHING
                """,
                (
                    node["key"],
                    parent_id,
                    node["layer"],
                    node["type"],
                    node["canonical_key"],
                    node["name"],
                    node.get("asset_path"),
                    json.dumps(node.get("geometry")),
                ),
            )
        connection.execute(
            """
            INSERT INTO luxdex.map_presentation_node
                (node_key, parent_id, layer, node_type, canonical_key, display_name)
            SELECT 'location:' || location.location_key, island.id, 3, 'location',
                   location.location_key, location.display_name
            FROM luxdex.geography_location AS location
            JOIN luxdex.geography_area_group AS area_group ON area_group.id = location.area_group_id
            JOIN luxdex.map_presentation_node AS island ON island.node_key = 'island:melemele'
            WHERE area_group.group_key = 'melemele'
            ON CONFLICT (node_key) DO NOTHING
            """
        )
        for placement in payload.get("placements", []):
            connection.execute(
                """
                INSERT INTO luxdex.map_sprite_placement
                    (zone_node_id, pokemon_form_id, x, y, scale)
                SELECT zone.id, form.id, %s, %s, %s
                FROM luxdex.map_presentation_node AS zone
                JOIN luxdex.pokemon_form AS form ON form.form_key = %s
                WHERE zone.node_key = %s
                ON CONFLICT (zone_node_id, pokemon_form_id) DO NOTHING
                """,
                (
                    placement["x"],
                    placement["y"],
                    placement.get("scale", 1),
                    placement["canonical_key"],
                    placement["zone"],
                ),
            )
        connection.execute(
            """
            INSERT INTO luxdex.map_presentation_node
                (node_key, parent_id, layer, node_type, canonical_key, display_name)
            SELECT 'zone:' || place.place_key, location_node.id, 4, 'zone',
                   place.place_key, place.display_name
            FROM luxdex.geography_encounter_place AS place
            JOIN luxdex.geography_location AS location ON location.id = place.location_id
            JOIN luxdex.map_presentation_node AS location_node
              ON location_node.node_key = 'location:' || location.location_key
            ON CONFLICT (node_key) DO NOTHING
            """
        )
