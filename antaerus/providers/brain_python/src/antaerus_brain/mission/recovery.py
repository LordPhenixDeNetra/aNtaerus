from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from antaerus_brain.mission.schemas import StepResult

if TYPE_CHECKING:
    from antaerus_brain.mission.schemas import Mission, MissionStep
    from antaerus_brain.mission.state import MissionStateStore


def _utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class RecoveryManager:
    def __init__(
        self,
        state: "MissionStateStore",
        *,
        interrupted_timeout_seconds: float = 120.0,
    ) -> None:
        self._state = state
        self._timeout_seconds = interrupted_timeout_seconds

    async def scan(self) -> list[tuple[str, str]]:
        results: list[tuple[str, str]] = []
        missions = await self._state.list_missions(status="running", limit=500)
        for mission in missions:
            reason = await self._diagnose(mission)
            if reason:
                results.append((mission.id, reason))
        return results

    async def recover(self, mission_id: str) -> "Mission":
        mission = await self._state.get_mission(mission_id)
        if mission.status not in ("running", "paused", "failed"):
            raise ValueError(f"Ne peut pas recover mission status={mission.status}")

        interrupted = await self._state.find_interrupted_steps(mission_id)
        for step in interrupted:
            snapshot = await self._recover_step_from_idempotency(mission_id, step)
            if snapshot is not None:
                await self._state.mark_step_finished(mission_id, step.id, snapshot)
                await self._state.append_event(
                    mission_id,
                    "recovered",
                    {
                        "step_index": step.index,
                        "step_id": step.id,
                        "mode": "idempotency-snapshot",
                        "result_status": snapshot.status,
                    },
                    step_id=step.id,
                )
            else:
                await self._state.mark_step_failed(
                    mission_id, step.id, error="recovered_interrupted"
                )
                await self._state.append_event(
                    mission_id,
                    "recovered",
                    {
                        "step_index": step.index,
                        "step_id": step.id,
                        "mode": "marked-failed-no-snapshot",
                    },
                    step_id=step.id,
                )

        await self._state.append_event(mission_id, "recovery", {"action": "ready_for_resume"})
        return await self._state.update_mission_status(mission_id, status="paused")

    async def _diagnose(self, mission: "Mission") -> Optional[str]:
        interrupted = await self._state.find_interrupted_steps(mission.id)
        if interrupted:
            return f"{len(interrupted)} etape(s) status=running sans finished_at: " + ",".join(
                str(s.index) for s in interrupted
            )
        return None

    async def _recover_step_from_idempotency(
        self, mission_id: str, step: "MissionStep"
    ) -> Optional[StepResult]:

        from antaerus_brain.mission.state import _payload_hash

        payload_hash = _payload_hash(step.tool_name, step.tool_args)
        snapshot = await self._state.get_idempotency(mission_id, step.id, payload_hash)
        if snapshot is None:
            return None
        try:
            return StepResult.model_validate(snapshot)
        except (TypeError, ValueError):
            return None
