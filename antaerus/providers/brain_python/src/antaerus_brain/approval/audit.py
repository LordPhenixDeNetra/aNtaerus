from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from antaerus_brain.approval.gate import GateDecision
from antaerus_brain.config import Settings


def append_tool_audit_record(
    settings: Settings,
    *,
    session_id: str,
    tool_name: str,
    arguments: dict[str, Any],
    decision: GateDecision,
) -> None:
    target = _audit_path(settings)
    target.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sessionId": session_id,
        "tool": tool_name,
        "arguments": arguments,
        "decision": decision.model_dump(),
    }
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=True) + "\n")


def _audit_path(settings: Settings) -> Path:
    return settings.memory_topics_dir.parent / "audit" / "tool_execution_audit.jsonl"
