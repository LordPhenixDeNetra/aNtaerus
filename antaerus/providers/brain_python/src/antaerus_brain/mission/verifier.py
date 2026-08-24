from __future__ import annotations

import json
from typing import Iterable, Optional

from antaerus_brain.mission.schemas import Mission, VerificationResult


class StructuralVerifier:
    def __init__(
        self,
        allowed_tool_names: Optional[Iterable[str]] = None,
        *,
        max_steps: int = 20,
        max_expected_output_chars: int = 2000,
    ) -> None:
        self._allowed_tool_names = set(allowed_tool_names) if allowed_tool_names else None
        self._max_steps = max_steps
        self._max_expected_output_chars = max_expected_output_chars

    def verify(self, mission: Mission) -> VerificationResult:
        errors: list[str] = []
        warnings: list[str] = []

        if mission.status != "draft":
            if len(mission.steps) == 0:
                errors.append("mission.status != draft mais steps est vide")
            if len(mission.steps) > self._max_steps:
                errors.append(
                    f"mission a {len(mission.steps)} etapes, max autorise={self._max_steps}"
                )

        if mission.title.strip() == "":
            errors.append("title est vide")
        if mission.user_request.strip() == "":
            errors.append("user_request est vide")
        if not (0 <= mission.autonomy_level <= 5):
            errors.append("autonomy_level doit etre dans [0,5]")
        if mission.budget_tokens < 0:
            errors.append("budget_tokens negatif")
        if mission.used_tokens < 0:
            errors.append("used_tokens negatif")
        if mission.used_tokens > mission.budget_tokens and mission.budget_tokens > 0:
            warnings.append(
                f"used_tokens={mission.used_tokens} > budget_tokens={mission.budget_tokens}"
            )

        indexes: list[int] = []
        for step in mission.steps:
            indexes.append(step.index)
            if step.title.strip() == "":
                errors.append(f"step idx={step.index} title vide")
            if step.index < 0:
                errors.append(f"step idx={step.index} negatif")
            for dep in step.depends_on:
                if dep == step.index:
                    errors.append(f"step {step.index} depend de lui-meme")

        if indexes:
            expected = list(range(min(indexes), min(indexes) + len(indexes)))
            if sorted(indexes) != expected:
                errors.append(
                    f"index des etapes non consecutifs ou en double: tri={sorted(indexes)}, attendu={expected}"
                )
            index_set = set(indexes)
            for step in mission.steps:
                for dep in step.depends_on:
                    if dep not in index_set:
                        errors.append(f"step idx={step.index} depends_on={dep} qui n'existe pas")
                    elif dep >= step.index:
                        errors.append(
                            f"step idx={step.index} depends_on={dep} est >= son index (cycle ou ordre illégal)"
                        )

            if self._allowed_tool_names is not None:
                for step in mission.steps:
                    if (
                        step.tool_name is not None
                        and step.tool_name not in self._allowed_tool_names
                    ):
                        errors.append(
                            f"step idx={step.index} utilise outil '{step.tool_name}' absent des outils autorises"
                        )

        for step in mission.steps:
            if (
                step.expected_output
                and len(str(step.expected_output)) > self._max_expected_output_chars
            ):
                warnings.append(f"step idx={step.index} expected_output trop long")
            if step.tool_args is not None:
                try:
                    json.dumps(step.tool_args, ensure_ascii=False)
                except (TypeError, ValueError):
                    errors.append(f"step idx={step.index} tool_args non JSON encodable")
            if step.tool_name is None and step.tool_args is not None and len(step.tool_args) > 0:
                warnings.append(f"step idx={step.index} a tool_args sans tool_name")

        return VerificationResult(ok=not errors, errors=errors, warnings=warnings)
