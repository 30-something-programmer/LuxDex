from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.map_studio_models import GeometryUpdate


def test_geometry_requires_a_polygon_in_parent_normalised_space() -> None:
    geometry = GeometryUpdate.model_validate(
        {"points": [{"x": 0, "y": 0}, {"x": 1, "y": 0}, {"x": 0.5, "y": 1}]}
    )
    assert len(geometry.points) == 3

    with pytest.raises(ValidationError):
        GeometryUpdate.model_validate(
            {"points": [{"x": -0.1, "y": 0}, {"x": 1, "y": 0}, {"x": 0.5, "y": 1}]}
        )

    with pytest.raises(ValidationError):
        GeometryUpdate.model_validate({"points": [{"x": 0, "y": 0}]})
