from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from antaerus_brain.llm import LLMClient
from antaerus_brain.mission.recovery import RecoveryManager
from antaerus_brain.mission.schemas import Mission, MissionStep, StepResult
from antaerus_brain.mission.semantic_verifier import SemanticVerifier
from antaerus_brain.mission.state import MissionStateStore, _payload_hash
from antaerus_brain.mission.verifier import StructuralVerifier
from antaerus_brain.tools.base import BaseTool, ToolResult


def _utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class MissionOrchestrator:
    def __init__(
        self,
        *,
        state: MissionStateStore,
        structural_verifier: StructuralVerifier,
        semantic_verifier: SemanticVerifier,
        tools: list[BaseTool],
        recovery: RecoveryManager,
        llm_client: Optional[LLMClient] = None,
        semantic_timeout_seconds: float = 30.0,
    ) -> None:
        self._state = state
        self._structural = structural_verifier
        self._semantic = semantic_verifier
        self._recovery = recovery
        self._tools = {t.name: t for t in tools}
        self._llm = llm_client
        self._semantic_timeout = semantic_timeout_seconds

    async def run(self, mission_id: str) -> Mission:
        mission = await self._state.get_mission(mission_id)
        if mission.status not in ("planned", "paused"):
            raise ValueError(
                f"Mission status={mission.status} ne peut pas etre lance (attendu planned/paused)"
            )

        sv = self._structural.verify(mission)
        if not sv.ok:
            await self._state.append_event(
                mission_id, "structural_errors", {"errors": sv.errors, "warnings": sv.warnings}
            )
            return await self._state.update_mission_status(
                mission_id, status="failed", error="; ".join(sv.errors)
            )
        if sv.warnings:
            await self._state.append_event(
                mission_id, "structural_warnings", {"warnings": sv.warnings}
            )

        sem_v = await self._semantic.verify(mission)
        if sem_v.errors:
            await self._state.append_event(
                mission_id,
                "semantic_errors",
                {"errors": sem_v.errors, "warnings": sem_v.warnings, "ok": sem_v.ok},
            )
            if not sem_v.ok:
                return await self._state.update_mission_status(
                    mission_id,
                    status="pending_approval",
                    error="Semantic blocking: " + "; ".join(sem_v.errors),
                )
        if sem_v.warnings:
            await self._state.append_event(
                mission_id, "semantic_warnings", {"warnings": sem_v.warnings}
            )

        mission = await self._state.update_mission_status(
            mission_id, status="running", started_at=_utcnow()
        )

        max_iterations = max(1, len(mission.steps) * 2 + 5)
        iteration = 0
        while iteration < max_iterations:
            iteration += 1
            mission = await self._state.get_mission(mission_id)
            ordered = sorted(mission.steps, key=lambda s: s.index)
            if all(s.status in ("completed", "skipped", "failed", "rolled_back") for s in ordered):
                break

            any_progress = False
            for step in ordered:
                if step.status in ("completed", "skipped", "failed", "rolled_back", "running"):
                    if step.status != "running":
                        continue
                prereqs_ok, reason = self._prerequisites_satisfied(step, ordered)
                if not prereqs_ok:
                    if step.status == "pending":
                        await self._state.upsert_step(mission_id, step)
                    continue

                if step.status == "running":
                    existing = await self._state.find_interrupted_steps(mission_id)
                    if any(e.id == step.id for e in existing):
                        mission = await self._recovery.recover(mission_id)
                        mission = await self._state.update_mission_status(
                            mission_id, status="running"
                        )
                        any_progress = True
                        break
                    continue

                payload_hash = _payload_hash(step.tool_name, step.tool_args)
                cached = await self._state.get_idempotency(mission_id, step.id, payload_hash)
                if cached is not None:
                    try:
                        result = StepResult.model_validate(cached)
                    except (TypeError, ValueError):
                        result = StepResult(
                            step_id=step.id,
                            ok=True,
                            status="completed",
                            output="(replayed snapshot non parsable, resultat juge ok)",
                        )
                    await self._state.mark_step_finished(mission_id, step.id, result)
                    await self._state.append_event(
                        mission_id,
                        "step_replayed",
                        {"step_index": step.index, "step_id": step.id, "hash": payload_hash[:12]},
                        step_id=step.id,
                    )
                    any_progress = True
                    continue

                if step.tool_name is None:
                    await self._state.mark_step_started(mission_id, step.id)
                    skipped_result = StepResult(
                        step_id=step.id,
                        ok=True,
                        status="skipped",
                        output=step.expected_output
                        or "(etape sans outil: saisie pour Capability Engine futur)",
                        started_at=_utcnow(),
                        finished_at=_utcnow(),
                    )
                    await self._state.record_idempotency(
                        mission_id, step.id, payload_hash, skipped_result.model_dump(mode="json")
                    )
                    await self._state.mark_step_finished(mission_id, step.id, skipped_result)
                    await self._state.append_event(
                        mission_id,
                        "step_skipped_no_tool",
                        {
                            "step_index": step.index,
                            "step_id": step.id,
                            "expected_output": step.expected_output,
                        },
                        step_id=step.id,
                    )
                    any_progress = True
                    continue

                tool = self._tools.get(step.tool_name)
                if tool is None:
                    await self._state.mark_step_started(mission_id, step.id)
                    error_msg = f"tool '{step.tool_name}' introuvable dans registre"
                    await self._state.mark_step_failed(mission_id, step.id, error=error_msg)
                    await self._state.append_event(
                        mission_id,
                        "step_tool_missing",
                        {"step_index": step.index, "step_id": step.id, "tool_name": step.tool_name},
                        step_id=step.id,
                    )
                    return await self._state.update_mission_status(
                        mission_id, status="failed", error=error_msg
                    )

                await self._state.mark_step_started(mission_id, step.id)
                started = _utcnow()
                try:
                    tool_result: ToolResult = await tool.execute(step.tool_args or {})
                except Exception as exc:  # noqa: BLE001
                    finished = _utcnow()
                    err = f"{type(exc).__name__}: {exc}"
                    step_result_failed = StepResult(
                        step_id=step.id,
                        ok=False,
                        status="failed",
                        output="",
                        tool_name=step.tool_name,
                        tool_args=step.tool_args,
                        raw={"exception": err},
                        started_at=started,
                        finished_at=finished,
                        error=err,
                    )
                    await self._state.mark_step_finished(mission_id, step.id, step_result_failed)
                    await self._state.append_event(
                        mission_id,
                        "step_exception",
                        {"step_index": step.index, "step_id": step.id, "error": err},
                        step_id=step.id,
                    )
                    return await self._state.update_mission_status(
                        mission_id, status="failed", error=err
                    )

                finished = _utcnow()
                ok = bool(tool_result.ok)
                step_status: Any = "completed" if ok else "failed"
                output = ""
                if tool_result.result is not None:
                    if isinstance(tool_result.result, (dict, list, str, int, float, bool)):
                        if isinstance(tool_result.result, str):
                            output = tool_result.result
                        else:
                            output = json.dumps(tool_result.result, ensure_ascii=False)
                    else:
                        output = str(tool_result.result)
                elif tool_result.error:
                    output = tool_result.error

                step_result = StepResult(
                    step_id=step.id,
                    ok=ok,
                    status=step_status,
                    output=output,
                    tool_name=step.tool_name,
                    tool_args=step.tool_args,
                    raw=getattr(tool_result, "model_dump", lambda: {})()
                    or tool_result.model_dump(),
                    started_at=started,
                    finished_at=finished,
                    error=None
                    if ok
                    else (tool_result.error or "tool result ok=False sans details"),
                )
                await self._state.record_idempotency(
                    mission_id, step.id, payload_hash, step_result.model_dump(mode="json")
                )
                await self._state.mark_step_finished(mission_id, step.id, step_result)
                await self._state.append_event(
                    mission_id,
                    "step_finished",
                    {
                        "step_index": step.index,
                        "step_id": step.id,
                        "ok": ok,
                        "tool_name": step.tool_name,
                        "status": step_status,
                    },
                    step_id=step.id,
                )
                if not ok:
                    return await self._state.update_mission_status(
                        mission_id,
                        status="failed",
                        error=(step_result.error or f"step {step.index} tool returned ok=False"),
                    )
                any_progress = True
                break
            else:
                if not any_progress:
                    mission_snapshot = await self._state.get_mission(mission_id)
                    blockers = [
                        (s.index, s.status)
                        for s in sorted(mission_snapshot.steps, key=lambda x: x.index)
                        if s.status in ("pending", "running")
                    ]
                    return await self._state.update_mission_status(
                        mission_id,
                        status="failed",
                        error=f"Mission bloque: aucun progres sur {len(blockers)} etape(s) restante(s). Blockers: {blockers}",
                    )
                continue
            if any_progress:
                continue

        final_mission = await self._state.get_mission(mission_id)
        final_steps = sorted(final_mission.steps, key=lambda s: s.index)
        any_fail = any(s.status == "failed" for s in final_steps)
        target_status = "failed" if any_fail else "completed"
        return await self._state.update_mission_status(
            mission_id, status=target_status, completed_at=_utcnow()
        )

    def _prerequisites_satisfied(
        self, step: "MissionStep", ordered: list["MissionStep"]
    ) -> tuple[bool, str]:
        if step.depends_on:
            by_idx = {s.index: s for s in ordered}
            for dep_index in step.depends_on:
                dep = by_idx.get(dep_index)
                if dep is None:
                    return False, f"dependance {dep_index} introuvable"
                if dep.status != "completed":
                    return False, f"dependance {dep_index} status={dep.status} (attendu completed)"
        return True, ""
