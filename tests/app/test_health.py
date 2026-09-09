import httpx
import pytest

from app.main import VERSION, app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.mark.anyio
async def test_health_without_configured_database(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "luxdex-app",
        "version": VERSION,
        "database": "not_configured",
    }
