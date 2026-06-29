from fastapi.testclient import TestClient

from antaerus_brain.app import create_app
from antaerus_brain.config import get_settings


def _client() -> TestClient:
    get_settings.cache_clear()
    return TestClient(create_app())


def test_health_endpoint_returns_expected_shape() -> None:
    response = _client().get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "brain_python"
    assert payload["status"] == "healthy"
    assert payload["port"] == 8000


def test_capabilities_endpoint_returns_python_runtime() -> None:
    response = _client().get("/internal/capabilities")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runtime"] == "python"
    assert "healthcheck" in payload["capabilities"]
    assert "llm-routing" in payload["capabilities"]
    assert "memory-kernel" in payload["capabilities"]
