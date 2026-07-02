from __future__ import annotations

import asyncio

from antaerus_brain.config import get_settings
from antaerus_brain.tools.weather import WeatherTool


class _FakeResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self._payload


class _FakeAsyncClient:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str, params: dict[str, object]):
        if "geocoding-api" in url:
            return _FakeResponse(
                {
                    "results": [
                        {
                            "name": "Dakar",
                            "country": "Senegal",
                            "latitude": 14.69,
                            "longitude": -17.44,
                        }
                    ]
                }
            )
        return _FakeResponse(
            {
                "current": {
                    "temperature_2m": 29.4,
                    "relative_humidity_2m": 75,
                    "wind_speed_10m": 12.1,
                    "weather_code": 1,
                }
            }
        )


def test_weather_tool_geocodes_and_fetches_current_weather(monkeypatch) -> None:
    monkeypatch.setattr(
        "antaerus_brain.tools.weather.httpx.AsyncClient",
        lambda *a, **k: _FakeAsyncClient(),
    )
    get_settings.cache_clear()
    tool = WeatherTool(get_settings(), {"enabled": True, "geocoding_enabled": True})

    result = asyncio.run(tool.execute({"location": "Dakar"}))

    assert result.ok is True
    assert result.result["location"] == "Dakar, Senegal"
    assert result.result["current"]["temperature_2m"] == 29.4
