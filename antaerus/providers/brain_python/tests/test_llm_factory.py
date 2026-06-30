from __future__ import annotations

import asyncio
from types import SimpleNamespace

from pydantic import SecretStr

from antaerus_brain.config import Settings
from antaerus_brain.llm import GenerationRequest
from antaerus_brain.llm.api import CloudLLMClient
from antaerus_brain.llm.factory import create_llm_client
from antaerus_brain.llm.local import OllamaLLMClient


def test_create_llm_client_resolves_all_supported_providers() -> None:
    settings = build_settings()

    assert isinstance(create_llm_client(settings, "anthropic"), CloudLLMClient)
    assert isinstance(create_llm_client(settings, "openai"), CloudLLMClient)
    assert isinstance(create_llm_client(settings, "mistral"), CloudLLMClient)
    assert isinstance(create_llm_client(settings, "deepseek"), CloudLLMClient)
    assert isinstance(create_llm_client(settings, "ollama"), OllamaLLMClient)


def test_cloud_llm_client_complete_parses_litellm_response(monkeypatch) -> None:
    async def fake_acompletion(**_: object) -> object:
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content="Bonjour depuis le cloud"),
                    finish_reason="stop",
                )
            ]
        )

    monkeypatch.setattr("antaerus_brain.llm.api.acompletion", fake_acompletion)
    client = CloudLLMClient(
        provider_name="anthropic",
        api_key=SecretStr("secret"),
        default_model="anthropic/model",
        timeout_seconds=3.0,
    )

    result = asyncio.run(client.complete(GenerationRequest(prompt="Bonjour")))

    assert result.provider == "anthropic"
    assert result.text == "Bonjour depuis le cloud"


def test_ollama_client_complete_parses_local_response(monkeypatch) -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"message": {"content": "Bonjour depuis Ollama"}, "done": True}

    class FakeAsyncClient:
        def __init__(self, timeout: float) -> None:
            self.timeout = timeout

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, url: str, json: dict[str, object]) -> FakeResponse:
            assert url.endswith("/api/chat")
            assert json["stream"] is False
            return FakeResponse()

    monkeypatch.setattr("antaerus_brain.llm.local.httpx.AsyncClient", FakeAsyncClient)
    client = OllamaLLMClient("http://localhost:11434", "llama3.1:8b", 3.0)

    result = asyncio.run(client.complete(GenerationRequest(prompt="Bonjour")))

    assert result.provider == "ollama"
    assert result.text == "Bonjour depuis Ollama"


def build_settings() -> Settings:
    return Settings(
        service_name="brain_python",
        version="0.1.0",
        port=8000,
        environment="test",
        api_secret=SecretStr("development-secret"),
        assistant_name="aNtaerus",
        assistant_system_prompt="",
        default_provider="ollama",
        anthropic_api_key=SecretStr("anthropic-key"),
        openai_api_key=SecretStr("openai-key"),
        mistral_api_key=SecretStr("mistral-key"),
        deepseek_api_key=SecretStr("deepseek-key"),
        anthropic_model="anthropic/model",
        openai_model="openai/model",
        mistral_model="mistral/model",
        deepseek_model="deepseek/deepseek-chat",
        ollama_base_url="http://localhost:11434",
        ollama_model="llama3.1:8b",
        llm_timeout_seconds=5.0,
        memory_db_path=__import__("pathlib").Path("memory.db"),
        memory_topics_dir=__import__("pathlib").Path("topics"),
        memory_default_limit=25,
    )
