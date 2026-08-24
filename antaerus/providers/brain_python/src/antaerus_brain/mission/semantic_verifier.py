from __future__ import annotations

import json
from typing import Any, Optional

from antaerus_brain.llm import (
    ChatMessage,
    CompletionResult,
    GenerationRequest,
    LLMClient,
    ProviderName,
)
from antaerus_brain.mission.schemas import Mission, VerificationResult

SEMANTIC_SYSTEM_PROMPT = """Tu es un verificateur de plans de mission. Ta seule tache est de detecter les incoherences GRAVES dans le plan propose.

Regles:
- Signale UNIQUEMENT les incoherences qui empecheraient physiquement la mission de reussir.
  Exemple d'erreur grave: "L'etape 2 utilise le contenu telecharge par l'etape 5 qui vient APRES".
  Exemple de non-erreur: "L'etape 0 dit 'lire le fichier X' mais X n'existe pas encore" (l'etape 0 doit justement le verifier ou le precedent le cree, on suppose).
- Si tu ne vois rien de bloquant: ok=true, errors=[], warnings eventuellement informatifs.
- Reponds UNIQUEMENT en JSON avec exactement ce schema SANS code fences:
    {"ok": true/false, "errors": ["ligne 1", ...], "warnings": ["..."]}
"""


class SemanticVerifier:
    def __init__(
        self,
        llm_client: Optional[LLMClient] = None,
        provider_name: ProviderName = "ollama",
        model: Optional[str] = None,
        *,
        max_attempts: int = 2,
        llm_timeout_seconds: float = 30.0,
    ) -> None:
        self._llm = llm_client
        self._provider = provider_name
        self._model = model
        self._max_attempts = max_attempts
        self._timeout = llm_timeout_seconds

    async def verify(
        self,
        mission: Mission,
        context: Optional[str] = None,
    ) -> VerificationResult:
        if self._llm is None:
            return VerificationResult(
                ok=True,
                warnings=["semantic verification skipped (no LLM client provided)"],
            )

        user_text = self._build_user_prompt(mission, context)
        messages: list[ChatMessage] = [
            ChatMessage(role="system", content=SEMANTIC_SYSTEM_PROMPT),
            ChatMessage(role="user", content=user_text),
        ]
        last_error: Optional[str] = None
        for attempt in range(self._max_attempts):
            try:
                request = GenerationRequest(
                    provider=self._provider,
                    model=self._model,
                    messages=messages,
                    temperature=0.0,
                    max_tokens=600,
                )
                completion: CompletionResult = await self._llm.complete(request)
                data = self._parse(completion.text)
                return VerificationResult(
                    ok=bool(data.get("ok", True)),
                    errors=[str(x) for x in data.get("errors") or []],
                    warnings=[str(x) for x in data.get("warnings") or []],
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
                        content=f"Format invalide: {last_error}. Recommence en JSON strict.",
                    )
                )
            except Exception as exc:  # noqa: BLE001
                return VerificationResult(
                    ok=True,
                    warnings=[
                        f"semantic verification skipped (provider unreachable: {type(exc).__name__}: {exc})"
                    ],
                )

        return VerificationResult(
            ok=True,
            warnings=[
                f"semantic verification abandonnee apres {self._max_attempts} tentatives: {last_error}"
            ],
        )

    def _build_user_prompt(self, mission: Mission, context: Optional[str]) -> str:
        lines: list[str] = []
        lines.append(f"Titre mission: {mission.title}")
        lines.append(f"Demande: {mission.user_request}")
        if mission.plan:
            lines.append(f"Plan: {mission.plan}")
        lines.append("")
        lines.append("Etapes:")
        for step in sorted(mission.steps, key=lambda s: s.index):
            depends = (
                " (depend de " + ",".join(str(i) for i in step.depends_on) + ")"
                if step.depends_on
                else ""
            )
            tool_info = f" [{step.tool_name}]" if step.tool_name else " [pas d'outil]"
            lines.append(
                f"- idx={step.index}{tool_info}{depends}: {step.title} :: {step.description}"
            )
            if step.expected_output:
                lines.append(f"    attendu: {step.expected_output}")
        if context:
            lines.append("")
            lines.append("Contexte supplementaire:")
            lines.append(str(context))
        lines.append("")
        lines.append("Rends le JSON strict maintenant.")
        return "\n".join(lines)

    def _parse(self, text: str) -> dict[str, Any]:
        stripped = text.strip()
        if not stripped:
            raise ValueError("reponse vide")
        import re

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
