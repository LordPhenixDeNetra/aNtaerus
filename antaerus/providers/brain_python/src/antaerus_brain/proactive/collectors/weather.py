from __future__ import annotations

from typing import Any

import httpx

from antaerus_brain.proactive.collectors.base import (
    BaseCollector,
    CollectorAlert,
    CollectorBriefing,
    CollectorResult,
)


def _resolve_coordinates(
    payload: dict[str, Any],
    settings,
) -> tuple[float, float, str | None] | None:
    latitude = payload.get("latitude")
    longitude = payload.get("longitude")
    location = payload.get("location")
    if isinstance(latitude, (int, float)) and isinstance(longitude, (int, float)):
        return float(latitude), float(longitude), location if isinstance(location, str) else None
    if not isinstance(location, str) or not location:
        return None
    return None


class WeatherCollector(BaseCollector):
    name = "weather"
    description = "Briefing meteo et alertes Open-Meteo"

    def __init__(self, settings, config: dict[str, Any] | None = None):
        super().__init__(settings, config)
        self.latitude: float = float(self.config.get("latitude", 48.8566))
        self.longitude: float = float(self.config.get("longitude", 2.3522))
        self.location: str | None = self.config.get("location")
        self.temp_warn_cold: float = float(self.config.get("temp_warn_cold", 5.0))
        self.temp_warn_hot: float = float(self.config.get("temp_warn_hot", 32.0))
        self.wind_warn_kmh: float = float(self.config.get("wind_warn_kmh", 50.0))

    async def _run_internal(self) -> CollectorResult:
        timeout = httpx.Timeout(getattr(self.settings, "weather_timeout_seconds", 10.0))
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": self.latitude,
                    "longitude": self.longitude,
                    "current": (
                        "temperature_2m,relative_humidity_2m,"
                        "wind_speed_10m,weather_code,precipitation"
                    ),
                    "daily": (
                        "temperature_2m_max,temperature_2m_min,"
                        "precipitation_sum,weather_code"
                    ),
                    "timezone": "auto",
                    "forecast_days": 2,
                },
            )
            response.raise_for_status()
            payload = response.json()

        current = payload.get("current", {}) or {}
        daily = payload.get("daily", {}) or {}
        temp = current.get("temperature_2m")
        wind = current.get("wind_speed_10m")
        precip = current.get("precipitation")

        alerts: list[CollectorAlert] = []
        if isinstance(temp, (int, float)):
            if temp <= self.temp_warn_cold:
                alerts.append(CollectorAlert(
                    title="Temperature froide",
                    message=(
                        f"Temperature actuelle {temp:.1f} °C "
                        f"(seuil {self.temp_warn_cold:.1f} °C)"
                    ),
                    severity="warning",
                    source=self.name,
                ))
            elif temp >= self.temp_warn_hot:
                alerts.append(CollectorAlert(
                    title="Temperature elevee",
                    message=(
                        f"Temperature actuelle {temp:.1f} °C "
                        f"(seuil {self.temp_warn_hot:.1f} °C)"
                    ),
                    severity="warning",
                    source=self.name,
                ))
        if isinstance(wind, (int, float)) and wind >= self.wind_warn_kmh:
            alerts.append(CollectorAlert(
                title="Vent fort",
                message=(
                    f"Vent {wind:.0f} km/h, seuil {self.wind_warn_kmh:.0f} km/h"
                ),
                severity="warning",
                source=self.name,
            ))
        if isinstance(precip, (int, float)) and precip > 0:
            alerts.append(CollectorAlert(
                title="Precipitations en cours",
                message=f"Pluie {precip:.1f} mm",
                severity="info",
                source=self.name,
            ))
        daily_max_list = daily.get("temperature_2m_max") or []
        daily_min_list = daily.get("temperature_2m_min") or []
        daily_precip_list = daily.get("precipitation_sum") or []
        summary_parts: list[str] = []
        if isinstance(temp, (int, float)):
            summary_parts.append(f"actuelle {temp:.1f} °C")
        if daily_min_list and isinstance(daily_min_list[0], (int, float)):
            summary_parts.append(f"min J0 {daily_min_list[0]:.1f} °C")
        if daily_max_list and isinstance(daily_max_list[0], (int, float)):
            summary_parts.append(f"max J0 {daily_max_list[0]:.1f} °C")
        if daily_precip_list and isinstance(daily_precip_list[0], (int, float)):
            summary_parts.append(f"pluie J0 {daily_precip_list[0]:.1f} mm")
        briefing = CollectorBriefing(
            title="Briefing meteo",
            summary=" ; ".join(summary_parts) if summary_parts else "pas de donnees meteo",
            metadata={
                "latitude": self.latitude,
                "longitude": self.longitude,
                "location": self.location,
                "current": current,
                "daily": daily,
            },
        )
        return CollectorResult(
            collectorName=self.name,
            success=True,
            briefing=briefing,
            alerts=alerts,
        )
