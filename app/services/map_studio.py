from app.api.map_studio_models import StudioDocument
from app.repositories.map_studio import MapStudioRepository


class MapStudioService:
    def __init__(self, repository: MapStudioRepository) -> None:
        self.repository = repository

    def document(self) -> StudioDocument:
        return StudioDocument.model_validate(self.repository.document())
