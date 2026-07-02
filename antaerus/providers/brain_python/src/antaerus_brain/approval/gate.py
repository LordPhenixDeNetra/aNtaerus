from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from antaerus_brain.tools.base import BaseTool, ToolCategory, ToolRiskLevel

GateDecisionValue = Literal["allow", "review", "deny"]


class GateDecision(BaseModel):
    decision: GateDecisionValue
    reason: str
    risk_level: ToolRiskLevel
    category: ToolCategory
    autonomy_level: int
    requires_audit: bool = False


@dataclass(frozen=True)
class ToolExecutionContext:
    session_id: str
    tool_name: str
    risk_level: ToolRiskLevel
    category: ToolCategory
    autonomy_level: int


def evaluate_tool_gate(tool: BaseTool, *, session_id: str) -> GateDecision:
    context = ToolExecutionContext(
        session_id=session_id,
        tool_name=tool.name,
        risk_level=tool.risk_level,
        category=tool.category,
        autonomy_level=tool.autonomy_level,
    )
    return evaluate_context_gate(context)


def evaluate_context_gate(context: ToolExecutionContext) -> GateDecision:
    if context.autonomy_level >= 4:
        return GateDecision(
            decision="review",
            reason=(
                f"tool {context.tool_name} requires human review at autonomy level "
                f"{context.autonomy_level}"
            ),
            risk_level=context.risk_level,
            category=context.category,
            autonomy_level=context.autonomy_level,
            requires_audit=True,
        )

    if context.category == "rust-sandbox" and context.autonomy_level >= 3:
        return GateDecision(
            decision="allow",
            reason=(
                f"tool {context.tool_name} is allowed by composite gate for sandboxed "
                f"level {context.autonomy_level}"
            ),
            risk_level=context.risk_level,
            category=context.category,
            autonomy_level=context.autonomy_level,
            requires_audit=True,
        )

    return GateDecision(
        decision="allow",
        reason=f"tool {context.tool_name} is allowed by default policy",
        risk_level=context.risk_level,
        category=context.category,
        autonomy_level=context.autonomy_level,
        requires_audit=context.autonomy_level >= 3,
    )
