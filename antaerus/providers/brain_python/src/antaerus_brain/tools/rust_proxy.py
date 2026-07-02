from __future__ import annotations

from typing import Any

import httpx

from antaerus_brain.config import Settings
from antaerus_brain.tools.base import ToolResult


class RustToolProxyError(RuntimeError):
    pass


async def execute_rust_tool(
    settings: Settings,
    *,
    tool: str,
    endpoint: str,
    payload: dict[str, Any],
) -> ToolResult:
    url = f"{settings.engine_base_url.rstrip('/')}{endpoint}"
    timeout = settings.tool_request_timeout_seconds
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPStatusError as exc:
        response_payload = _safe_json(exc.response)
        if isinstance(response_payload, dict):
            return ToolResult.model_validate(response_payload)
        raise RustToolProxyError(
            f"rust tool request failed with status {exc.response.status_code}"
        ) from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise RustToolProxyError(f"failed to reach rust tool endpoint {url}: {exc}") from exc

    if not isinstance(data, dict):
        raise RustToolProxyError(f"invalid rust tool response from {url}")

    return ToolResult.model_validate(data)


def _safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return None
