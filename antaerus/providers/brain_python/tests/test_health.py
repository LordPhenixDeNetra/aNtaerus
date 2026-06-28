from fastapi.testclient import TestClient

from antaerus_brain.app import app

client = TestClient(app)


def test_health_endpoint_returns_expected_shape() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "brain_python"
    assert payload["status"] == "healthy"
    assert payload["port"] == 8000


def test_capabilities_endpoint_returns_python_runtime() -> None:
    response = client.get("/internal/capabilities")

    assert response.status_code == 200
    payload = response.json()
    assert payload["runtime"] == "python"
    assert "healthcheck" in payload["capabilities"]
