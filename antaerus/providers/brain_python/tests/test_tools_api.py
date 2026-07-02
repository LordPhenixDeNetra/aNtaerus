from __future__ import annotations

from fastapi.testclient import TestClient

from antaerus_brain.app import create_app
from antaerus_brain.config import get_settings


def test_tools_api_lists_catalog_and_executes_tool(tmp_path, monkeypatch) -> None:
    tools_config = tmp_path / "tools.yaml"
    tools_config.write_text(
        """
browser:
  enabled: true
gmail:
  enabled: true
calendar:
  enabled: true
weather:
  enabled: true
vision:
  enabled: true
filesystem:
  enabled: true
  allowed_roots:
    - allowed
memory_tool:
  enabled: true
cli:
  enabled: true
  allowed_commands:
    - python
""".strip(),
        encoding="utf-8",
    )
    allowed_dir = tmp_path / "allowed"
    allowed_dir.mkdir()
    (allowed_dir / "hello.txt").write_text("bonjour tools", encoding="utf-8")

    monkeypatch.setenv("ANTAERUS_BRAIN_TOOLS_CONFIG_PATH", str(tools_config))
    monkeypatch.setenv("ANTAERUS_BRAIN_TOOLS_SANDBOX_ROOT", str(tmp_path))
    get_settings.cache_clear()
    client = TestClient(create_app())

    catalog = client.get("/tools")
    assert catalog.status_code == 200
    payload = catalog.json()
    assert any(tool["name"] == "filesystem" for tool in payload["tools"])

    execute = client.post(
        "/tools/execute",
        json={"tool": "filesystem", "arguments": {"path": "allowed/hello.txt"}},
    )
    assert execute.status_code == 200
    assert execute.json()["ok"] is True
    assert execute.json()["result"]["content"] == "bonjour tools"


def test_tools_api_returns_404_for_unknown_tool() -> None:
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.post("/tools/execute", json={"tool": "missing", "arguments": {}})

    assert response.status_code == 404
