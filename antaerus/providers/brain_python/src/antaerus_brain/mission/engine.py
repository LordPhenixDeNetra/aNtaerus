from __future__ import annotations

import json
import re
import uuid
from typing import Any, Optional

from antaerus_brain.llm import (
    ChatMessage,
    CompletionResult,
    GenerationRequest,
    LLMClient,
    ProviderName,
)
from antaerus_brain.mission.schemas import Mission, MissionStep
from antaerus_brain.tools.base import ToolDescriptor

PLANNER_SYSTEM_PROMPT = """Tu es un planner d'equipes. Ta tache unique est de decomposer une demande utilisateur en une sequence d'etapes concretes, ordonnees, chacune representant une action simple.

Regles strictes:
- Chaque etape est une action unique. Ne combine pas plusieurs actions dans une meme etape.
- Utilise uniquement les outils listes dans la section OUTILS DISPONIBLES. Chaque etape peut utiliser zero ou UN outil.
- Si une action necessite un outil qui n'est PAS dans OUTILS DISPONIBLES, marque quand meme l'etape mais laisse tool_name a null et ecris dans expected_output quelle capacite manquante est necessaire (pour un futur Capability Engine).
- Les index des etapes commencent a 0 et sont consecutifs.
- Chaque etape a un titre court, une description claire, et eventuellement tool_name, tool_args (dict JSON), depends_on (liste d'index des etapes qui doivent etre terminees avant).
- Reponds UNIQUEMENT en JSON conforme a ce schema:
{
  "title": "Titre court de la mission",
  "plan": "Paragraphe de 2-4 lignes expliquant la strategie",
  "steps": [
    {
      "index": 0,
      "title": "...",
      "description": "...",
      "tool_name": "tool_name_or_null",
      "tool_args": { "...": "..." },
      "depends_on": [],
      "expected_output": "null_or_description"
    }
  ]
}
"""


class MissionPlanner:
    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        provider_name: ProviderName = "ollama",
        model: Optional[str] = None,
        max_steps: int = 20,
    ) -> None:
        self._llm = llm_client
        self._provider_name = provider_name
        self._model = model
        self._max_steps = max_steps

    async def plan(
        self,
        user_request: str,
        session_id: Optional[str] = None,
        available_tools: Optional[list[ToolDescriptor]] = None,
        context_messages: Optional[list[ChatMessage]] = None,
        autonomy_level: int = 0,
    ) -> Mission:
        tools = list(available_tools or [])
        system = self._build_system_prompt(tools)
        user = self._build_user_prompt(user_request, tools)

        messages: list[ChatMessage] = [
            ChatMessage(role="system", content=system),
            *(context_messages or []),
            ChatMessage(role="user", content=user),
        ]

        last_error: Optional[str] = None
        for attempt in range(3):
            try:
                if self._llm is None:
                    raise ValueError("LLM client indisponible")
                request = GenerationRequest(
                    provider=self._provider_name,
                    model=self._model,
                    messages=messages,
                    temperature=0.1,
                    max_tokens=1024,
                )
                completion: CompletionResult = await self._llm.complete(request)
                data = self._parse_completion(completion.text)
                mission = self._data_to_mission(
                    data=data,
                    user_request=user_request,
                    session_id=session_id,
                    autonomy_level=autonomy_level,
                )
                if len(mission.steps) > self._max_steps:
                    raise ValueError(
                        f"Trop d'etapes ({len(mission.steps)} > max {self._max_steps})"
                    )
                return mission
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
                        content=f"Ta reponse precedente n'est pas valide: {last_error}. Recommence en respectant strictement le schema JSON demande.",
                    )
                )

        return self._fallback_mission(
            user_request=user_request,
            session_id=session_id,
            autonomy_level=autonomy_level,
            reason=last_error or "Echec planification apres 3 tentatives",
        )

    def _build_system_prompt(self, tools: list[ToolDescriptor]) -> str:
        if not tools:
            return (
                PLANNER_SYSTEM_PROMPT
                + "\n\nOUTILS DISPONIBLES: Aucun outil disponible pour l'instant."
            )
        parts = [PLANNER_SYSTEM_PROMPT, "", "OUTILS DISPONIBLES:"]
        for t in tools:
            parts.append(
                f"- {t.name} (categorie={t.category}, risque={t.risk_level}, niveau autonomie={t.autonomy_level}): {t.description}"
            )
            if t.operations:
                parts.append(f"    operations: {', '.join(t.operations)}")
        return "\n".join(parts)

    def _build_user_prompt(self, user_request: str, tools: list[ToolDescriptor]) -> str:
        tool_names = ", ".join(sorted({t.name for t in tools})) if tools else "aucun"
        return (
            "Demande utilisateur:\n"
            + user_request.strip()
            + f"\n\nOutils disponibles: {tool_names}\n\n"
            + "Rends le JSON maintenant."
        )

    def _parse_completion(self, text: str) -> dict[str, Any]:
        stripped = text.strip()
        if not stripped:
            raise ValueError("Reponse vide")

        candidates = [stripped]
        match_json_block = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", stripped)
        if match_json_block:
            candidates.insert(0, match_json_block.group(1))
        first_brace = stripped.find("{")
        last_brace = stripped.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            candidates.insert(0, stripped[first_brace : last_brace + 1])

        last_exc: Optional[Exception] = None
        for candidate in candidates:
            try:
                data = json.loads(candidate)
                if isinstance(data, dict):
                    return data
            except (TypeError, ValueError) as exc:
                last_exc = exc

        raise ValueError(f"Impossible de parser du JSON valide: {last_exc}")

    def _data_to_mission(
        self,
        data: dict[str, Any],
        *,
        user_request: str,
        session_id: Optional[str],
        autonomy_level: int,
    ) -> Mission:
        if not isinstance(data, dict):
            raise ValueError("Resultat JSON doit etre un objet")
        raw_steps = data.get("steps") or []
        if not isinstance(raw_steps, list):
            raise ValueError("steps doit etre un tableau")
        if len(raw_steps) == 0:
            raise ValueError("steps est vide: une mission planifiee doit contenir au moins 1 etape")
        seen_indexes: set[int] = set()
        steps: list[MissionStep] = []
        for idx, raw_step in enumerate(raw_steps):
            if not isinstance(raw_step, dict):
                raise ValueError(f"step[{idx}] doit etre un objet")
            step_index = raw_step.get("index", idx)
            if not isinstance(step_index, int):
                raise ValueError(f"step[{idx}].index doit etre un entier")
            if step_index in seen_indexes:
                raise ValueError(f"step index duplique: {step_index}")
            seen_indexes.add(step_index)
            title = str(raw_step.get("title") or f"Etape {step_index}").strip()
            if not title:
                raise ValueError(f"step[{idx}] title manquant")
            description = str(raw_step.get("description") or "")
            tool_name = raw_step.get("tool_name")
            if tool_name is not None:
                tool_name = str(tool_name) or None
            tool_args = raw_step.get("tool_args")
            if tool_args is not None and not isinstance(tool_args, dict):
                raise ValueError(f"step[{idx}].tool_args doit etre null ou un objet")
            depends_on_raw = raw_step.get("depends_on") or []
            if not isinstance(depends_on_raw, list):
                raise ValueError(f"step[{idx}].depends_on doit etre une liste")
            depends_on: list[int] = []
            for dep in depends_on_raw:
                if isinstance(dep, bool) or not isinstance(dep, int):
                    raise ValueError(f"step[{idx}].depends_on contient valeur non entiere")
                depends_on.append(int(dep))
            expected_output = raw_step.get("expected_output")
            if expected_output is not None:
                expected_output = str(expected_output)
            steps.append(
                MissionStep(
                    id=f"step-{str(uuid.uuid4())[:8]}",
                    index=step_index,
                    title=title,
                    description=description,
                    tool_name=tool_name,
                    tool_args=tool_args,
                    depends_on=depends_on,
                    expected_output=expected_output,
                )
            )

        sorted_steps = sorted(steps, key=lambda s: s.index)
        expected_indexes = list(range(len(sorted_steps)))
        actual_indexes = [s.index for s in sorted_steps]
        if actual_indexes != expected_indexes:
            for s, correct in zip(sorted_steps, expected_indexes):
                s.index = correct

        return Mission(
            id=str(uuid.uuid4()),
            session_id=session_id,
            title=str(data.get("title") or user_request[:120]).strip() or "Mission",
            user_request=user_request,
            plan=str(data.get("plan") or ""),
            steps=sorted_steps,
            status="planned",
            autonomy_level=autonomy_level,
        )

    def _fallback_mission(
        self,
        *,
        user_request: str,
        session_id: Optional[str],
        autonomy_level: int,
        reason: str,
    ) -> Mission:
        step = MissionStep(
            id=f"step-{str(uuid.uuid4())[:8]}",
            index=0,
            title="Reponse directe",
            description=(
                "Planification automatique non disponible; "
                "utiliser une reponse directe utilisateur sans decomposition complexe. "
                f"Raison: {reason}"
            ),
            expected_output="Reponse textuelle finale a l'utilisateur",
        )
        return Mission(
            id=str(uuid.uuid4()),
            session_id=session_id,
            title=user_request[:120] or "Mission",
            user_request=user_request,
            plan=f"Fallback car: {reason}",
            steps=[step],
            status="planned",
            autonomy_level=autonomy_level,
        )
