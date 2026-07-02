from __future__ import annotations

from typing import Literal

import httpx
from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool


class WeatherToolInput(BaseModel):
    operation: Literal["current"] = "current"
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location: str | None = Field(default=None, min_length=1)


class WeatherTool(BaseTool):
    name = "weather"
    description = "Récupère une météo actuelle minimale via Open-Meteo"
    risk_level = "low"
    category = "knowledge"
    autonomy_level = 1
    input_model = WeatherToolInput
    operations = ("current",)

    async def _run(self, payload: WeatherToolInput):
        coordinates = await self._resolve_coordinates(payload)
        if coordinates is None:
            return self.error_result("latitude/longitude or location is required")

        latitude, longitude, resolved_name = coordinates
        timeout = httpx.Timeout(self.settings.weather_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
                },
            )
            response.raise_for_status()
            payload_json = response.json()

        current = payload_json.get("current", {})
        return self.success(
            {
                "location": resolved_name,
                "latitude": latitude,
                "longitude": longitude,
                "current": current,
            }
        )

    async def _resolve_coordinates(
        self,
        payload: WeatherToolInput,
    ) -> tuple[float, float, str | None] | None:
        if payload.latitude is not None and payload.longitude is not None:
            return payload.latitude, payload.longitude, payload.location

        if not payload.location:
            return None

        if not self.config.get("geocoding_enabled", True):
            return None

        timeout = httpx.Timeout(self.settings.weather_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": payload.location, "count": 1, "language": "fr", "format": "json"},
            )
            response.raise_for_status()
            payload_json = response.json()

        results = payload_json.get("results") or []
        if not results:
            return None
        first = results[0]
        name = first.get("name")
        country = first.get("country")
        label = f"{name}, {country}" if name and country else name
        return float(first["latitude"]), float(first["longitude"]), label
