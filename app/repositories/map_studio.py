from __future__ import annotations

import json
from typing import Any

from psycopg.rows import dict_row

from app.database import connect_database


class MapStudioRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url

    def document(self) -> dict[str, list[dict[str, Any]]]:
        with connect_database(self.database_url) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute("""
                    SELECT node.node_key, parent.node_key AS parent_key, node.layer,
                           node.node_type, node.canonical_key, node.display_name,
                           node.asset_path, node.geometry
                    FROM luxdex.map_presentation_node AS node
                    LEFT JOIN luxdex.map_presentation_node AS parent ON parent.id = node.parent_id
                    ORDER BY node.layer, node.display_name
                """)
                nodes = list(cursor.fetchall())
                cursor.execute("""
                    SELECT DISTINCT zone.node_key AS zone_node_key, resolved.canonical_key,
                           resolved.canonical_display_name AS display_name,
                           resolved.local_sprite_path AS sprite_path,
                           COALESCE(collection.state, 'unseen') AS collection_state
                    FROM luxdex.map_presentation_node AS zone
                    JOIN luxdex.geography_encounter_full AS resolved
                      ON resolved.place_key = zone.canonical_key
                    JOIN luxdex.pokemon_form AS form ON form.form_key = resolved.canonical_key
                    LEFT JOIN luxdex.pokemon_collection_state AS collection
                      ON collection.pokemon_form_id = form.id
                     AND collection.profile_id = (SELECT id FROM luxdex.profile WHERE profile_key = 'local')
                    WHERE zone.node_type = 'zone' AND resolved.canonical_key IS NOT NULL
                    ORDER BY zone.node_key, display_name
                """)
                pokemon = list(cursor.fetchall())
                cursor.execute("""
                    SELECT zone.node_key AS zone_node_key, form.form_key AS canonical_key,
                           placement.x::float, placement.y::float, placement.scale::float
                    FROM luxdex.map_sprite_placement AS placement
                    JOIN luxdex.map_presentation_node AS zone ON zone.id = placement.zone_node_id
                    JOIN luxdex.pokemon_form AS form ON form.id = placement.pokemon_form_id
                    ORDER BY zone.node_key, form.form_key
                """)
                placements = list(cursor.fetchall())
        return {"nodes": nodes, "pokemon": pokemon, "placements": placements}

    def save_geometry(self, node_key: str, points: list[dict[str, float]]) -> bool:
        with connect_database(self.database_url) as connection:
            result = connection.execute(
                "UPDATE luxdex.map_presentation_node SET geometry=%s, updated_at=now() WHERE node_key=%s",
                (json.dumps([[point["x"], point["y"]] for point in points]), node_key),
            )
            return result.rowcount == 1

    def delete_geometry(self, node_key: str) -> bool:
        with connect_database(self.database_url) as connection:
            result = connection.execute(
                "UPDATE luxdex.map_presentation_node SET geometry=NULL, updated_at=now() WHERE node_key=%s AND layer > 2",
                (node_key,),
            )
            return result.rowcount == 1

    def save_placement(self, node_key: str, canonical_key: str, x: float, y: float, scale: float) -> bool:
        with connect_database(self.database_url) as connection:
            result = connection.execute("""
                INSERT INTO luxdex.map_sprite_placement (zone_node_id, pokemon_form_id, x, y, scale)
                SELECT zone.id, form.id, %s, %s, %s
                FROM luxdex.map_presentation_node AS zone
                JOIN luxdex.pokemon_form AS form ON form.form_key = %s
                WHERE zone.node_key = %s AND zone.node_type = 'zone'
                  AND EXISTS (
                    SELECT 1 FROM luxdex.geography_encounter_full AS encounter
                    WHERE encounter.place_key = zone.canonical_key
                      AND encounter.canonical_key = form.form_key
                  )
                ON CONFLICT (zone_node_id, pokemon_form_id) DO UPDATE
                SET x=EXCLUDED.x, y=EXCLUDED.y, scale=EXCLUDED.scale, updated_at=now()
            """, (x, y, scale, canonical_key, node_key))
            return result.rowcount == 1
