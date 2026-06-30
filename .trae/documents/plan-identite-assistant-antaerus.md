# Plan — Forcer l'identité « aNtaerus » (éviter « DeepSeek »)

## Summary

Objectif : faire en sorte que, quel que soit le provider LLM actif (DeepSeek, Ollama, etc.), l’assistant se présente comme **aNtaerus** (et n’affirme plus être “DeepSeek / OpenAI / …”) lorsqu’on lui demande « Qui es-tu ? ».

Succès = en WebSocket (mode normal) et en SSE dev (`/llm/stream`), une question d’identité obtient une réponse du type “Je suis aNtaerus …” (sans auto-marketing provider).

## Current State Analysis

- Le frontend (React) envoie des prompts au brain :
  - mode WS : via gateway Go → brain Python `/llm/session-stream`
  - mode SSE dev : directement sur le brain Python `/llm/stream` avec `{"prompt": "..."}`.
- Côté brain, la construction des messages de génération ne contient **aucun message système**.
  - En session WS : `MemoryKernel.build_generation_messages()` renvoie uniquement l’historique user/assistant, puis `SessionChatService` passe ces messages au client LLM. Voir [kernel.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py#L161-L166) et [chat.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/chat.py#L25-L45).
  - En SSE dev : le frontend appelle `/llm/stream` avec `prompt` uniquement, et le brain transmet tel quel au client LLM. Voir [useChatStream.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/hooks/useChatStream.ts#L55-L72) et [api/llm.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/llm.py#L41-L50).
- Résultat : le modèle (DeepSeek) répond librement sur son identité (“Je suis DeepSeek…”), faute d’instruction système.

## Proposed Changes

### 1) Ajouter un “system prompt” d’identité côté brain (source de vérité)

**Fichiers**
- Créer `antaerus/providers/brain_python/src/antaerus_brain/prompting.py`
- Mettre à jour `antaerus/providers/brain_python/src/antaerus_brain/config.py`

**Contenu**
- Ajouter à `Settings` :
  - `assistant_name: str` (défaut : `aNtaerus`)
  - `assistant_system_prompt: str` (défaut : construit depuis `assistant_name`)
- Ajouter des variables optionnelles dans `.env` :
  - `ANTAERUS_BRAIN_ASSISTANT_NAME` (facultatif)
  - `ANTAERUS_BRAIN_ASSISTANT_SYSTEM_PROMPT` (facultatif)
- Dans `prompting.py` :
  - `build_system_prompt(settings) -> str`
  - `inject_system_prompt(settings, request: GenerationRequest) -> GenerationRequest`
    - Si `request.messages` est vide et `request.prompt` est présent : convertir en `messages=[system, user]` et vider `prompt`
    - Si `request.messages` est présent : préfixer `system` uniquement si le premier message n’est pas déjà `role="system"`

**Rationale**
- Centraliser la politique d’identité dans le backend (pas dans le frontend, ni dans le gateway).
- Rendre le comportement stable quel que soit le transport (WS vs SSE) et quel que soit le provider.

### 2) Appliquer l’injection sur tous les chemins d’exécution LLM (WS + SSE)

**Fichiers**
- Mettre à jour `antaerus/providers/brain_python/src/antaerus_brain/chat.py`
- Mettre à jour `antaerus/providers/brain_python/src/antaerus_brain/api/llm.py`

**Changements**
- Dans `SessionChatService._generation_request(...)` :
  - Après construction de `GenerationRequest(messages=...)`, appeler `inject_system_prompt(settings, request)`
- Dans les endpoints `/llm/chat` et `/llm/stream` :
  - Avant `client.complete(...)` / `sse_event_stream(...)`, remplacer la requête par `inject_system_prompt(settings, request)`

**Pourquoi**
- Le bug “je suis DeepSeek” peut se produire dans les 2 modes (WS + SSE dev). Cette injection garantit la cohérence.

### 3) Tests unitaires + mise à jour du contrat `.env.example`

**Fichiers**
- Mettre à jour `antaerus/providers/brain_python/tests/test_llm_api.py`
  - Capturer la `GenerationRequest` reçue par le `FakeClient` et vérifier :
    - `request.messages[0].role == "system"`
    - `aNtaerus` présent dans `request.messages[0].content`
    - si input était `{prompt: ...}` alors `messages` contient aussi un message `user`.
- Mettre à jour `antaerus/.env.example` (section brain) avec :
  - `ANTAERUS_BRAIN_ASSISTANT_NAME=aNtaerus`
  - `ANTAERUS_BRAIN_ASSISTANT_SYSTEM_PROMPT=` (vide = défaut)

## Assumptions & Decisions

- Décision utilisateur : identité par défaut = **Toujours “aNtaerus”** (le provider ne doit pas “se présenter” à la place du produit).
- On n’essaie pas de “post-traiter” la réponse du modèle ; on corrige à la source via `system` role.
- Le but est de contrôler l’auto-présentation ; pas de masquer entièrement le provider dans les logs / réponses techniques (les champs `provider/model` dans les events SSE peuvent rester).

## Verification Steps

1) Tests Python
- Depuis `antaerus/providers/brain_python/` :
  - `python -m pytest tests/test_llm_api.py -q`
  - `python -m pytest tests -q`

2) Vérification manuelle (UI)
- Lancer les services (ou `antaerus/scripts/dev-all.ps1`).
- Dans l’UI :
  - Mode WS : poser “Qui es-tu ?” → réponse doit commencer par “Je suis aNtaerus…”
  - Mode SSE dev : basculer `Mode de chat` sur `SSE direct brain`, poser “Qui es-tu ?” → idem.

