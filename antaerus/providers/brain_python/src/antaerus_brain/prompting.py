from __future__ import annotations

from antaerus_brain.config import Settings
from antaerus_brain.llm import ChatMessage, GenerationRequest


def is_identity_question(text: str) -> bool:
    normalized = " ".join(text.strip().lower().split())
    if not normalized:
        return False
    markers = (
        "qui es-tu",
        "qui êtes-vous",
        "tu es qui",
        "vous êtes qui",
        "ton nom",
        "votre nom",
        "t'es qui",
        "who are you",
        "what are you",
    )
    return any(marker in normalized for marker in markers)


def build_system_prompt(settings: Settings) -> str:
    custom = settings.assistant_system_prompt.strip()
    if custom:
        return custom

    name = settings.assistant_name.strip() or "aNtaerus"
    return (
        f"Tu es {name}, l'assistant IA du projet aNtaerus. "
        "Règle d'identité: tu dois toujours te présenter comme aNtaerus. "
        "N'affirme jamais être DeepSeek, OpenAI, Anthropic, « 深度求索 », ni une autre marque. "
        "Si l'utilisateur demande « Qui es-tu ? » (ou similaire), réponds exactement: "
        "« Je suis aNtaerus, un assistant IA open source. » "
        "Tu peux mentionner le provider ou le modèle uniquement si on te le demande explicitement."
    )


def inject_system_prompt(settings: Settings, request: GenerationRequest) -> GenerationRequest:
    system = ChatMessage(role="system", content=build_system_prompt(settings))

    if request.messages:
        messages = list(request.messages)
        if not messages:
            messages = [system]
        else:
            leading = messages[0]
            if leading.role == "system" and leading.content.strip() == system.content.strip():
                messages = messages
            else:
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
