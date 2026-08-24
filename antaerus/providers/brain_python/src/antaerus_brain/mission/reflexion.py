from __future__ import annotations

import json
import re
from typing import Any, Optional

from antaerus_brain.llm import (
    ChatMessage,
    CompletionResult,
    GenerationRequest,
    LLMClient,
    ProviderName,
)
from antaerus_brain.mission.schemas import Mission, ReflexionReport

REFLEXION_SYSTEM_PROMPT = """Tu es l'unite de reflexion post-mission de aNtaerus.

Tu dois produire un bilan objectif de la mission terminee ou en echec en JSON strict:
{
  "summary": "paragraphe de 3-6 lignes resumant deroulement + resultat final",
  "successes": ["etape 0 ok avec X", ...],
  "failures": ["etape 2 erreur Y", ...],
  "suggested_fixes": ["pour reessayer, faire Z", ...],
  "facts_to_remember": ["fait 1 utilisateur/contexte", "fait 2", "fait 3 (3 max)"],
  "score_quality": 0.0 a 1.0
}
"""


class ReflexionEngine:
    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        provider_name: ProviderName = "ollama",
        model: Optional[str] = None,
        *,
        max_attempts: int = 2,
    ) -> None:
        self._llm = llm_client
        self._provider = provider_name
        self._model = model
        self._max_attempts = max_attempts

    async def run(self, mission: Mission) -> ReflexionReport:
        if self._llm is None:
            return self._heuristic_report(mission)

        user_text = self._build_user_prompt(mission)
        messages: list[ChatMessage] = [
            ChatMessage(role="system", content=REFLEXION_SYSTEM_PROMPT),
            ChatMessage(role="user", content=user_text),
        ]
        last_error: Optional[str] = None
        for attempt in range(self._max_attempts):
            try:
                completion: CompletionResult = await self._llm.complete(
                    GenerationRequest(
                        provider=self._provider,
                        model=self._model,
                        messages=messages,
                        temperature=0.2,
                        max_tokens=900,
                    )
                )
                data = self._parse(completion.text)
                return ReflexionReport(
                    mission_id=mission.id,
                    summary=str(data.get("summary") or "Bilan heuristique (format non conforme)"),
                    successes=[str(x) for x in data.get("successes") or []],
                    failures=[str(x) for x in data.get("failures") or []],
                    suggested_fixes=[str(x) for x in data.get("suggested_fixes") or []],
                    facts_to_remember=[str(x) for x in (data.get("facts_to_remember") or [])[:3]],
                    score_quality=float(data.get("score_quality") or 0.0),
                )
            except ValueError as exc:
                last_error = str(exc)
                messages.append(
                    ChatMessage(
                        role="assistant",
                        content=(completion.text if "completion" in locals() else ""),
                    )
                )
                messages.append(
                    ChatMessage(
                        role="user",
                        content=f"Format non valide: {last_error}. Recommence en JSON strict.",
                    )
                )
            except Exception as exc:  # noqa: BLE001
                report = self._heuristic_report(mission)
                report.warnings = [f"LLM indisponible: {type(exc).__name__}: {exc}"]
                return report

        return self._heuristic_report(mission, reason=last_error)

    def _build_user_prompt(self, mission: Mission) -> str:
        lines: list[str] = []
        lines.append(f"MISSION ID: {mission.id}")
        lines.append(f"Titre: {mission.title}")
        lines.append(f"Statut final: {mission.status}")
        lines.append(f"Demande initiale: {mission.user_request}")
        if mission.plan:
            lines.append(f"Plan initial: {mission.plan}")
        lines.append("")
        lines.append("Etapes (dans l'ordre):")
        for s in sorted(mission.steps, key=lambda x: x.index):
            lines.append(
                f"- [{s.status}] idx={s.index} {s.title}"
                + (f" (tool={s.tool_name})" if s.tool_name else "")
            )
            if s.error:
                lines.append(f"    erreur: {s.error}")
            if s.result:
                lines.append(f"    resultat: ok={s.result.ok} output={s.result.output[:400]!r}")
        lines.append("")
        lines.append("Rends le JSON maintenant.")
        return "\n".join(lines)

    def _parse(self, text: str) -> dict[str, Any]:
        stripped = text.strip()
        if not stripped:
            raise ValueError("reponse vide")
        candidates = [stripped]
        m = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", stripped)
        if m:
            candidates.insert(0, m.group(1))
        first = stripped.find("{")
        last = stripped.rfind("}")
        if first != -1 and last != -1 and last > first:
            candidates.insert(0, stripped[first : last + 1])
        for c in candidates:
            try:
                data = json.loads(c)
                if isinstance(data, dict):
                    return data
            except (TypeError, ValueError):
                continue
        raise ValueError("pas de JSON valide")

    def _heuristic_report(
        self, mission: Mission, *, reason: Optional[str] = None
    ) -> ReflexionReport:
        ordered = sorted(mission.steps, key=lambda s: s.index)
        successes: list[str] = []
        failures: list[str] = []
        for s in ordered:
            if s.status == "completed":
                successes.append(f"idx={s.index} {s.title}")
            elif s.status == "failed":
                failures.append(f"idx={s.index} {s.title} (erreur: {s.error or 'inconnue'})")
            elif s.status == "skipped":
                successes.append(f"idx={s.index} skip OK: {s.title}")
        ratio = (
            (len(successes) / len(ordered))
            if ordered
            else (1.0 if mission.status == "completed" else 0.0)
        )
        fixes: list[str] = []
        if failures:
            fixes.append("Corriger les etapes en echec avant de relancer la mission.")
        fixes.append("Reduire le nombre d'etapes si la mission comporte trop d'actions.")
        summary = (
            f"Mission {mission.status} sur {len(ordered)} etape(s): "
            f"{len(successes)} reussie(s), {len(failures)} en echec."
        )
        if reason:
            summary += f" Rapport heuristique car: {reason}"
        return ReflexionReport(
            mission_id=mission.id,
            summary=summary,
            successes=successes,
            failures=failures,
            suggested_fixes=fixes,
            facts_to_remember=[],
            score_quality=float(ratio),
        )
