from __future__ import annotations

import json
from typing import Any, Callable, Optional

from antaerus_brain.config import get_settings
from antaerus_brain.skills import GeneratedSkillDraft, SkillRuntime

_SKILL_PROMPT_TEMPLATE = (
    "Vous etes l'assistant generateur de modules Skill aNtaerus.\n"
    "Generez un module Skill {runtime} MINIMAL, FONCTIONNEL et SANS "
    "DEPENDANCE EXTERNE (stdlib seulement).\n"
    "\n"
    "Contexte utilisateur:\n"
    "{usage}\n"
    "\n"
    "CONTRAINTES OBLIGATOIRES:\n"
    "- Runtime: {runtime}. Si python: seule la stdlib (imports built-in "
    "autorises: json/re/sys/os/datetime/typing/hashlib/math/collections).\n"
    '- Si wasm: code WebAssembly WAT (format texte) avec export "run" qui '
    "retourne un i32.\n"
    "- UNE seule fonction d'entree: si python, fonction main(args: dict) -> "
    "dict. Si wasm: (func (export \"run\") ...).\n"
    "- Documentez en 2 lignes la description du skill (docstring python ou "
    ";; commentaire wasm).\n"
    "- SORTIE OBLIGATOIRE: JSON STRICT avec les champs:\n"
    "  - name: identifiant kebab-case, 3-40 caracteres\n"
    "  - description: une ligne\n"
    "  - category: general | data | assistant | system | domotic\n"
    "  - sourceCode: code source complet\n"
    "  - inlineTests: 1 scenario d'usage minimal via assertion python ou "
    "commentaire wasm\n"
    "\n"
    "REPONDEZ UNIQUEMENT DU JSON SANS AUTRE CONTENU."
)


async def generate_skill_from_usage(
    usage: str,
    preferred_runtime: SkillRuntime = "python",
    chat_client_factory: Optional[Callable[..., Any]] = None,
) -> GeneratedSkillDraft:
    if not usage or len(usage.strip()) < 4:
        raise ValueError("description usage trop courte")
    settings = get_settings()
    prompt = _SKILL_PROMPT_TEMPLATE.format(
        runtime=preferred_runtime,
        usage=usage.strip(),
    )
    client: Any = None
    if chat_client_factory is not None:
        try:
            if hasattr(chat_client_factory, "__aenter__"):
                client = await chat_client_factory()
            else:
                try:
                    candidate = chat_client_factory()
                    if hasattr(candidate, "__await__"):
                        client = await candidate
                    else:
                        client = candidate
                except TypeError:
                    client = chat_client_factory()
        except Exception as exc:  # pragma: no cover
            return _fallback_draft(
                usage, preferred_runtime, reason=f"chat factory echec: {exc}",
            )
    else:
        try:
            from antaerus_brain.llm.factory import create_llm_client
        except Exception as exc:  # pragma: no cover - chemin fallback
            return _fallback_draft(
                usage, preferred_runtime,
                reason=f"llm factory indisponible: {exc}",
            )
        try:
            client = create_llm_client(settings)
        except Exception as exc:  # pragma: no cover
            return _fallback_draft(
                usage, preferred_runtime,
                reason=f"echec creation client LLM: {exc}",
            )
    model = _default_model_for_provider(settings)
    timeout_s = float(getattr(settings, "llm_timeout_seconds", 30))
    try:
        messages = [
            {"role": "system", "content": "Tu es un generateur de code Skill JSON strict."},
            {"role": "user", "content": prompt},
        ]
        raw_text: str = ""
        if client is None:
            return _fallback_draft(
                usage, preferred_runtime,
                reason="client LLM indisponible",
            )
        try:
            raw_text = await client.chat(
                messages, model=model, temperature=0.1,
                max_tokens=2500, timeout=timeout_s,
            )
        except TypeError:
            raw_text = await client.chat(messages)
    except Exception as exc:
        return _fallback_draft(usage, preferred_runtime, reason=f"appel LLM echoue: {exc}")
    parsed = _extract_json(raw_text)
    if parsed is None:
        return _fallback_draft(usage, preferred_runtime, reason="reponse LLM non JSON exploitable")
    try:
        coerced_version = str(parsed.get("suggestedVersion") or parsed.get("version") or "0.1.0")
        return GeneratedSkillDraft(
            name=_coerce_name(parsed.get("name") or usage[:30]),
            description=str(parsed.get("description") or usage),
            runtime=_coerce_runtime(parsed.get("runtime"), fallback=preferred_runtime),
            sourceCode=str(parsed.get("sourceCode") or parsed.get("source_code") or ""),
            category=_coerce_category(parsed.get("category")),
            suggestedVersion=coerced_version,
            version=coerced_version,
            inlineTests=str(parsed.get("inlineTests") or parsed.get("inline_tests") or ""),
        )
    except (TypeError, ValueError) as exc:
        return _fallback_draft(usage, preferred_runtime, reason=f"schema LLM invalide: {exc}")


def _default_model_for_provider(settings: Any) -> str:
    provider = str(getattr(settings, "default_provider", "ollama"))
    attr = f"{provider}_model"
    return str(getattr(settings, attr, "llama3.1:8b"))


def _coerce_name(raw: str) -> str:
    cleaned = "".join(
        c if c.isalnum() or c in "-_" else "-"
        for c in raw.lower().strip().replace(" ", "-")
    ).strip("-_")
    if len(cleaned) < 3:
        cleaned = f"skill-{cleaned or 'auto'}"
    return cleaned[:40]


def _coerce_runtime(raw: Any, fallback: SkillRuntime) -> SkillRuntime:
    value = str(raw or "").lower().strip()
    if value in {"python", "wasm"}:
        return value  # type: ignore[return-value]
    return fallback


def _coerce_category(raw: Any) -> str:
    allowed = {"general", "data", "assistant", "system", "domotic"}
    value = str(raw or "general").lower().strip()
    if value in allowed:
        return value
    return "general"


def _extract_json(text: str) -> dict[str, Any] | None:
    stripped = text.strip()
    starts = stripped.find("{")
    ends = stripped.rfind("}")
    if starts < 0 or ends < 0 or ends <= starts:
        for line in stripped.splitlines():
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    return json.loads(line)
                except (json.JSONDecodeError, ValueError):
                    continue
        return None
    candidate = stripped[starts : ends + 1]
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, ValueError):
        return None


def _fallback_draft(
    usage: str,
    runtime: SkillRuntime,
    *,
    reason: str,
) -> GeneratedSkillDraft:
    if runtime == "wasm":
        code = _MINIMAL_WAT_SKILL
    else:
        code = _MINIMAL_PYTHON_SKILL.format(usage=usage[:80].replace("\n", " "))
    return GeneratedSkillDraft(
        name=_coerce_name(usage[:25] or "skill-fallback"),
        description=f"[fallback: {reason[:120]}] {usage[:140]}",
        runtime=runtime,
        sourceCode=code,
        category="general",
        suggestedVersion="0.1.0",
        version="0.1.0",
        inlineTests=(
            f"# fallback genere car {reason[:80]}\n"
            "assert main({'ping': 1}).get('ok') is True"
        ),
    )


_MINIMAL_PYTHON_SKILL = '''"""Skill minimal stdlib seulement."""
import json
import sys


def main(args: dict) -> dict:
    """Point d'entree principal Skill.

    Usage: {usage}
    """
    ts = __import__("datetime").datetime.utcnow().isoformat()
    result = {{"ok": True, "echo": args, "ts": ts}}
    try:
        print(json.dumps(result))
    except Exception:
        pass
    return result


if __name__ == "__main__":
    payload = {{}}
    if len(sys.argv) > 1:
        try:
            payload = json.loads(sys.argv[1])
        except (ValueError, TypeError):
            payload = {{"raw": sys.argv[1:]}}
    main(payload)
'''

_MINIMAL_WAT_SKILL = """;; Skill WAT minimal : retourne args[0] + 42.
(module
  (func (export "run") (param i32) (result i32)
    local.get 0
    i32.const 42
    i32.add)
  (memory (export "memory") 1))
"""
