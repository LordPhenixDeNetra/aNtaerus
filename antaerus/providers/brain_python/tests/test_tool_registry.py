from __future__ import annotations

from antaerus_brain.config import get_settings
from antaerus_brain.tools import create_tool_registry


def test_tool_registry_lists_tools_and_llm_schemas(tmp_path, monkeypatch) -> None:
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
    - .
memory_tool:
  enabled: true
cli:
  enabled: true
  allowed_commands:
    - python
""".strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv("ANTAERUS_BRAIN_TOOLS_CONFIG_PATH", str(tools_config))
    monkeypatch.setenv("ANTAERUS_BRAIN_TOOLS_SANDBOX_ROOT", str(tmp_path))
    get_settings.cache_clear()

    registry = create_tool_registry(get_settings())

    names = [tool.name for tool in registry.list_tools()]
    assert "browser" in names
    assert "weather" in names
    assert "cli" in names

    descriptors = {descriptor.name: descriptor for descriptor in registry.describe_tools()}
    assert descriptors["browser"].enabled is True
    assert descriptors["gmail"].available is False
    assert descriptors["calendar"].available is False
    assert descriptors["vision"].available is False

    schemas = registry.llm_schemas()
    assert any(schema["function"]["name"] == "browser" for schema in schemas)
