from __future__ import annotations

import json
from typing import Any

from antaerus_brain.approval import append_tool_audit_record, evaluate_tool_gate
from antaerus_brain.config import Settings
from antaerus_brain.llm import (
    ChatMessage,
    CompletionResult,
    GenerationRequest,
    LLMClient,
    ToolDefinition,
)
from antaerus_brain.tools import create_tool_registry
from antaerus_brain.tools.base import ToolResult

MAX_TOOL_ROUND_TRIPS = 1


async def complete_with_tools(
    settings: Settings,
    client: LLMClient,
    *,
    session_id: str,
    request: GenerationRequest,
) -> CompletionResult:
    registry = create_tool_registry(settings)
    initial_request = GenerationRequest.model_validate(
        {
            **request.model_dump(),
            "tools": [ToolDefinition.model_validate(schema) for schema in registry.llm_schemas()],
            "tool_choice": "auto",
        }
    )
    response = await client.complete(initial_request)
    if not response.tool_calls:
        return response

    current_messages = list(request.messages)
    current_response = response
    for _ in range(MAX_TOOL_ROUND_TRIPS):
        if not current_response.tool_calls:
            return current_response

        assistant_message = ChatMessage(
            role="assistant",
            content=current_response.text,
            toolCalls=current_response.tool_calls,
        )
        current_messages.append(assistant_message)

        for tool_call in current_response.tool_calls:
            tool = registry.get(tool_call.function.name)
            decision = evaluate_tool_gate(tool, session_id=session_id)
            arguments = _decode_tool_arguments(tool_call.function.arguments)
            if decision.requires_audit:
                append_tool_audit_record(
                    settings,
                    session_id=session_id,
                    tool_name=tool.name,
                    arguments=arguments,
                    decision=decision,
                )

            if decision.decision != "allow":
                tool_result = ToolResult(
                    ok=False,
                    tool=tool.name,
                    status="denied",
                    error=decision.reason,
                    meta={"gateDecision": decision.decision},
                )
            else:
                tool_result = await registry.execute(tool.name, arguments)

            current_messages.append(
                ChatMessage(
                    role="tool",
                    content=json.dumps(tool_result.model_dump(), ensure_ascii=True),
                    name=tool.name,
                    toolCallId=tool_call.id,
                )
            )

        follow_up_request = request.model_copy(
            update={
                "messages": current_messages,
                "prompt": None,
                "tools": [],
                "tool_choice": None,
            }
        )
        current_response = await client.complete(follow_up_request)

    return current_response


def _decode_tool_arguments(raw_arguments: str) -> dict[str, Any]:
    if not raw_arguments.strip():
        return {}
    try:
        parsed = json.loads(raw_arguments)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    return parsed
