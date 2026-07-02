from __future__ import annotations

from typing import Any

from antaerus_brain.tools.base import BaseTool


def build_llm_tool_schema(tool: BaseTool) -> dict[str, Any]:
    descriptor = tool.descriptor()
    return {
        "type": "function",
        "function": {
            "name": descriptor.name,
            "description": descriptor.description,
            "parameters": descriptor.input_schema,
        },
    }


def build_llm_tool_schemas(tools: list[BaseTool]) -> list[dict[str, Any]]:
    return [build_llm_tool_schema(tool) for tool in tools if tool.descriptor().enabled]
