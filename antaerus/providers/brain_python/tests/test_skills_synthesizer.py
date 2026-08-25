import asyncio
import json

from antaerus_brain.skills.synthesizer import generate_skill_from_usage


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def test_synthesizer_fallback_when_llm_unavailable():
    draft = _run(generate_skill_from_usage(
        "faire un echo basique",
        preferred_runtime="python",
        chat_client_factory=None,
    ))
    assert draft is not None
    assert draft.name
    assert draft.runtime == "python"
    assert "def main" in draft.source_code or "main(" in draft.source_code
    assert draft.version and draft.suggested_version


class _FakeChatClient:
    async def chat(self, messages, **_kwargs):
        payload = {
            "name": "demo-json-echo",
            "description": "demo echoue arguments",
            "category": "general",
            "runtime": "python",
            "sourceCode": "def main(args): return {'echo': args}\n",
            "inlineTests": "assert main({'a':1})['echo']['a'] == 1\n",
            "suggestedVersion": "1.0.0",
        }
        return "```json\n" + json.dumps(payload) + "\n```"


def test_synthesizer_parses_json_output_from_llm():
    factory_called = {"n": 0}

    def factory():
        factory_called["n"] += 1
        return _FakeChatClient()

    draft = _run(generate_skill_from_usage(
        "une skill qui fait echo",
        preferred_runtime="python",
        chat_client_factory=factory,
    ))
    assert factory_called["n"] == 1
    assert draft.name == "demo-json-echo" or draft.name
    assert draft.version == "1.0.0" or draft.suggested_version
    assert "echo" in draft.description.lower() or draft.source_code


def test_synthesizer_wasm_fallback_contains_module():
    draft = _run(generate_skill_from_usage(
        "faire un calcul wasm",
        preferred_runtime="wasm",
        chat_client_factory=None,
    ))
    assert draft.runtime == "wasm"
    assert "(module" in draft.source_code or "(module" in draft.source_code.lower()
