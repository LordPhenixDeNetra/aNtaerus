from __future__ import annotations

from types import SimpleNamespace

import pytest

from antaerus_brain.proactive.collectors._registry import (
    CollectorRegistry,
    create_collector_registry,
)
from antaerus_brain.proactive.collectors.base import (
    BaseCollector,
    CollectorResult,
    CollectorSeverity,
)


class _DummyCollector(BaseCollector):
    name = "dummy"
    description = "collecteur factice pour tests"

    async def _run_internal(self) -> CollectorResult:
        return CollectorResult(
            collectorName=self.name,
            success=True,
        )


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        weather_timeout_seconds=1.0,
        news_timeout_seconds=1.0,
        calendar_timeout_seconds=1.0,
        system_timeout_seconds=1.0,
    )


def test_registry_register_and_list() -> None:
    reg = CollectorRegistry()
    reg.register(_DummyCollector(settings=_settings()))
    assert reg.list_names() == ["dummy"]
    assert reg.get("dummy") is not None
    assert reg.get("unknown") is None


@pytest.mark.anyio(backend="asyncio")
async def test_registry_run_returns_result() -> None:
    reg = CollectorRegistry()
    reg.register(_DummyCollector(settings=_settings()))
    result = await reg.run("dummy")
    assert result.success is True
    assert result.collectorName == "dummy"


@pytest.mark.anyio(backend="asyncio")
async def test_registry_run_missing_returns_error() -> None:
    reg = CollectorRegistry()
    result = await reg.run("nope")
    assert result.success is False
    assert "not found" in str(result.error)


@pytest.mark.anyio(backend="asyncio")
async def test_registry_run_all_runs_each() -> None:
    reg = CollectorRegistry()
    reg.register(_DummyCollector(settings=_settings()))
    results = await reg.run_all()
    assert len(results) == 1
    assert results[0].collectorName == "dummy"


def test_create_collector_registry_registers_core() -> None:
    reg = create_collector_registry(settings=_settings())
    names = reg.list_names()
    for expected in ("weather", "news", "calendar", "system"):
        assert expected in names


@pytest.mark.anyio(backend="asyncio")
async def test_collector_disabled_returns_disabled_briefing() -> None:
    c = _DummyCollector(settings=_settings(), config={"enabled": False})
    assert c.enabled is False
    result = await c.run()
    assert result.success is True
    assert result.briefing is not None
    assert "disabled" in result.briefing.title


def test_severity_type_alias_has_expected_literals() -> None:
    assert "info" in CollectorSeverity.__args__
    assert "warning" in CollectorSeverity.__args__
    assert "critical" in CollectorSeverity.__args__
