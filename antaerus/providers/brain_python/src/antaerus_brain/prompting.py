from __future__ import annotations

from antaerus_brain.config import Settings
from antaerus_brain.llm import ChatMessage, GenerationRequest


def build_system_prompt(settings: Settings) -> str:
    custom = settings.assistant_system_prompt.strip()
    if custom:
        return custom

    name = settings.assistant_name.strip() or "aNtaerus"
    return (
        f"Tu es {name}, l'assistant IA aNtaerus. "
        "Tu n'es pas DeepSeek, OpenAI, Anthropic ou une autre marque. "
        "Quand on te demande ton identité (ex: « Qui es-tu ? »), réponds que tu es aNtaerus. "
        "Tu peux mentionner le provider ou le modèle uniquement si on te le demande explicitement."
    )


def inject_system_prompt(settings: Settings, request: GenerationRequest) -> GenerationRequest:
    system = ChatMessage(role="system", content=build_system_prompt(settings))

    if request.messages:
        messages = list(request.messages)
        if messages and messages[0].role != "system":
            messages = [system, *messages]
        return GenerationRequest(
            provider=request.provider,
            model=request.model,
            prompt=request.prompt,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

    if request.prompt:
        user = ChatMessage(role="user", content=request.prompt)
        return GenerationRequest(
            provider=request.provider,
            model=request.model,
            prompt=None,
            messages=[system, user],
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )

    return GenerationRequest(
        provider=request.provider,
        model=request.model,
        prompt=request.prompt,
        messages=[system],
        temperature=request.temperature,
        max_tokens=request.max_tokens,
    )

