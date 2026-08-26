from __future__ import annotations

import json
import re
import uuid
from typing import Any

from antaerus_brain.approval import append_tool_audit_record, evaluate_tool_gate
from antaerus_brain.config import Settings
from antaerus_brain.llm import (
    ChatMessage,
    CompletionResult,
    GenerationRequest,
    LLMClient,
    ToolCall,
    ToolCallFunction,
    ToolDefinition,
)
from antaerus_brain.tools import create_tool_registry
from antaerus_brain.tools.base import ToolResult

MAX_TOOL_ROUND_TRIPS = 3

_DSML_PREFIX = r"<\s*(?:\|\s*)+DSML\s*(?:\|\s*)+"
_DSML_PREFIX_CLOSE = r"<\s*\/\s*(?:\|\s*)+DSML\s*(?:\|\s*)+"
_DSML_SUFFIX_OPEN_TAG = r"(?:\|\s*)*>"
_DSML_TOOL_CALLS_RE = re.compile(
    rf"{_DSML_PREFIX}tool_calls\s*{_DSML_SUFFIX_OPEN_TAG}.*?{_DSML_PREFIX_CLOSE}\/?tool_calls\s*{_DSML_SUFFIX_OPEN_TAG}",
    re.IGNORECASE | re.DOTALL,
)
_DSML_INVOKE_RE = re.compile(
    rf"{_DSML_PREFIX}invoke\s+name\s*=\s*\"(?P<name>[^\"]+)\"\s*{_DSML_SUFFIX_OPEN_TAG}(?P<body>.*?){_DSML_PREFIX_CLOSE}\/?invoke\s*{_DSML_SUFFIX_OPEN_TAG}",
    re.IGNORECASE | re.DOTALL,
)
_DSML_PARAM_RE = re.compile(
    rf"{_DSML_PREFIX}parameter\s+name\s*=\s*\"(?P<key>[^\"]+)\"\s*(?:string\s*=\s*\"true\")?\s*{_DSML_SUFFIX_OPEN_TAG}(?P<value>.*?){_DSML_PREFIX_CLOSE}\/?parameter\s*{_DSML_SUFFIX_OPEN_TAG}",
    re.IGNORECASE | re.DOTALL,
)
_DSML_ANY_BLOCK_RE = re.compile(
    rf"{_DSML_PREFIX}.*?(?:\|\s*\|>)?|{_DSML_PREFIX_CLOSE}.*?(?:\|\s*\|>)?",
    re.IGNORECASE | re.DOTALL,
)


def _strip_dsml_blocks(text: str) -> str:
    if not text:
        return ""
    cleaned = _DSML_TOOL_CALLS_RE.sub("", text)
    cleaned = _DSML_INVOKE_RE.sub("", cleaned)
    cleaned = _DSML_PARAM_RE.sub("", cleaned)
    cleaned = _DSML_ANY_BLOCK_RE.sub("", cleaned)
    return cleaned.strip()


def _extract_dsml_tool_calls(text: str) -> list[ToolCall]:
    """Fallback pour LLM qui produisent du <|DSML|...invoke|...|> au lieu du format tool_calls natif."""
    if not text:
        return []
    calls: list[ToolCall] = []
    for m in _DSML_INVOKE_RE.finditer(text):
        name = m.group("name").strip()
        body = m.group("body")
        args: dict[str, Any] = {}
        for pm in _DSML_PARAM_RE.finditer(body):
            args[pm.group("key").strip()] = pm.group("value").strip()
        if not name:
            continue
        try:
            arg_str = json.dumps(args, ensure_ascii=False)
        except Exception:  # noqa: BLE001
            arg_str = "{}"
        calls.append(
            ToolCall(
                id=f"call_{uuid.uuid4().hex[:16]}",
                type="function",
                function=ToolCallFunction(name=name, arguments=arg_str),
            )
        )
    return calls


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
        fallback = _extract_dsml_tool_calls(response.text or "")
        if fallback:
            response.tool_calls = fallback
            response.text = _strip_dsml_blocks(response.text or "")
            response.finish_reason = "tool_calls"

    if not response.tool_calls:
        response.text = _strip_dsml_blocks(response.text or "")
        return response

    current_messages = list(request.messages)
    current_response = response
    for _ in range(MAX_TOOL_ROUND_TRIPS):
        if not current_response.tool_calls:
            current_response.text = _strip_dsml_blocks(current_response.text or "")
            return current_response

        assistant_content = _strip_dsml_blocks(current_response.text or "")
        assistant_message = ChatMessage(
            role="assistant",
            content=assistant_content,
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

        if not current_response.tool_calls:
            fb = _extract_dsml_tool_calls(current_response.text or "")
            if fb:
                current_response.tool_calls = fb
                current_response.text = _strip_dsml_blocks(current_response.text or "")
                current_response.finish_reason = "tool_calls"

    current_response.text = _strip_dsml_blocks(current_response.text or "")
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
