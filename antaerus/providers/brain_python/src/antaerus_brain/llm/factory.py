from __future__ import annotations

from antaerus_brain.config import Settings
from antaerus_brain.llm import LLMClient, ProviderName
from antaerus_brain.llm.api import CloudLLMClient
from antaerus_brain.llm.local import OllamaLLMClient


def create_llm_client(settings: Settings, provider: ProviderName | None = None) -> LLMClient:
    resolved_provider = (provider or settings.default_provider).lower()

    if resolved_provider == "anthropic":
        return CloudLLMClient(
            provider_name="anthropic",
            api_key=settings.anthropic_api_key,
            default_model=settings.anthropic_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    if resolved_provider == "openai":
        return CloudLLMClient(
            provider_name="openai",
            api_key=settings.openai_api_key,
            default_model=settings.openai_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    if resolved_provider == "mistral":
        return CloudLLMClient(
            provider_name="mistral",
            api_key=settings.mistral_api_key,
            default_model=settings.mistral_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    if resolved_provider == "deepseek":
        return CloudLLMClient(
            provider_name="deepseek",
            api_key=settings.deepseek_api_key,
            default_model=settings.deepseek_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    if resolved_provider == "ollama":
        return OllamaLLMClient(
            base_url=settings.ollama_base_url,
            default_model=settings.ollama_model,
            timeout_seconds=settings.llm_timeout_seconds,
        )

    raise ValueError(f"Unsupported provider: {resolved_provider}")
