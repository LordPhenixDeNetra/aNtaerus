from __future__ import annotations

from fastapi import APIRouter, HTTPException

from antaerus_brain.config import get_settings
from antaerus_brain.tools import create_tool_registry
from antaerus_brain.tools.base import ToolExecuteRequest, ToolExecuteResponse, ToolListResponse

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("", response_model=ToolListResponse)
async def list_tools() -> ToolListResponse:
    registry = create_tool_registry(get_settings())
    return ToolListResponse(tools=registry.describe_tools())


@router.post("/execute", response_model=ToolExecuteResponse)
async def execute_tool(payload: ToolExecuteRequest) -> ToolExecuteResponse:
    registry = create_tool_registry(get_settings())
    try:
        result = await registry.execute(payload.tool, payload.arguments)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ToolExecuteResponse.model_validate(result.model_dump())
