# aNtaerus Brain

Service Python interne du monorepo `aNtaerus` pour le traitement texte, le streaming LLM et la mémoire conversationnelle.

## Rôle

Le service `brain_python` fournit :

- une orchestration LLM multi-provider ;
- un endpoint de génération synchrone ;
- un endpoint de streaming `SSE` ;
- un noyau mémoire SQLite minimal ;
- un service de chat session-aware pour `M1.4` ;
- un historique conversationnel persistant par `sessionId` ;
- une ingestion heuristique de facts ;
- un mirror Markdown unidirectionnel de la mémoire.

Ce service est conçu pour être consommé en interne par le gateway Go.

## Providers supportés

- `anthropic`
- `openai`
- `mistral`
- `ollama`

Les providers cloud passent par `litellm`. `Ollama` est appelé via `httpx` sur une instance locale.

## Configuration principale

Le service charge automatiquement `antaerus/.env` au boot si ce fichier existe. Les variables déjà présentes dans l'environnement du shell gardent la priorité.

Variables d'environnement utiles :

- `ANTAERUS_BRAIN_PORT` : port HTTP du service. Défaut : `8000`
- `ANTAERUS_ENV` : environnement d'exécution. Défaut : `development`
- `ANTAERUS_BRAIN_API_SECRET` : secret interne du brain
- `ANTAERUS_BRAIN_DEFAULT_PROVIDER` : provider par défaut. Défaut : `ollama`
- `ANTAERUS_ANTHROPIC_API_KEY` : clé API Anthropic
- `ANTAERUS_OPENAI_API_KEY` : clé API OpenAI
- `ANTAERUS_MISTRAL_API_KEY` : clé API Mistral
- `ANTAERUS_BRAIN_ANTHROPIC_MODEL` : modèle Anthropic
- `ANTAERUS_BRAIN_OPENAI_MODEL` : modèle OpenAI
- `ANTAERUS_BRAIN_MISTRAL_MODEL` : modèle Mistral
- `ANTAERUS_BRAIN_OLLAMA_BASE_URL` : URL de l'instance Ollama. Défaut : `http://localhost:11434`
- `ANTAERUS_BRAIN_OLLAMA_MODEL` : modèle Ollama. Défaut : `llama3.1:8b`
- `ANTAERUS_BRAIN_LLM_TIMEOUT_SECONDS` : timeout LLM. Défaut : `30`
- `ANTAERUS_BRAIN_MEMORY_DB_PATH` : chemin SQLite. Défaut : `antaerus/memory_data/antaerus_memory.db`
- `ANTAERUS_BRAIN_MEMORY_TOPICS_DIR` : répertoire du mirror Markdown. Défaut : `antaerus/memory_data/topics`
- `ANTAERUS_BRAIN_MEMORY_DEFAULT_LIMIT` : limite de recherche mémoire. Défaut : `25`

Tous les secrets applicatifs restent typés avec `SecretStr`.

### Emplacement recommandé

- fichier réel local : `antaerus/.env`
- modèle versionné : `antaerus/.env.example`

Le brain ne nécessite donc pas de `.env` dédié dans `providers/brain_python/`.

## API interne

Routes exposées :

- `GET /health`
- `GET /internal/capabilities`
- `GET /llm/providers`
- `POST /llm/chat`
- `POST /llm/stream`
- `POST /llm/session-stream`
- `GET /memory/facts`
- `GET /memory/chat/sessions/{session_id}`
- `POST /memory/facts`
- `POST /memory/ingest`
- `POST /memory/mirror`

Le streaming retourne un flux `text/event-stream` avec les événements normalisés :

- `token`
- `complete`
- `error`

Le endpoint `POST /llm/session-stream` :

- reçoit `sessionId`, `message` et `provider` optionnel ;
- recharge le contexte conversationnel de la session ;
- persiste le message utilisateur ;
- stream les tokens du provider LLM ;
- persiste le message assistant final.

## Stockage mémoire

Par défaut, la mémoire du brain s'appuie sur :

- SQLite : `antaerus/memory_data/antaerus_memory.db`
- mirror Markdown : `antaerus/memory_data/topics/`

Le schéma minimal couvre :

- `events`
- `facts`
- `fact_observations`
- `fact_relations`
- `chat_sessions`
- `chat_messages`

Les tables conversationnelles `chat_sessions` et `chat_messages` servent de source de vérité pour l'historique du chat texte intégré.

## Intégration M1.4

Le gateway Go consomme ce service via :

- `POST /llm/session-stream` pour le streaming conversationnel ;
- `GET /memory/chat/sessions/{session_id}` pour recharger l'historique d'une session.

Le flux nominal côté backend est :

- chargement ou création de session ;
- ajout du message utilisateur ;
- reconstruction de `GenerationRequest.messages` depuis l'historique ;
- génération streamée ;
- persistance du message assistant ;
- retour de l'historique ordonné à la demande du gateway.

## Développement local

Installation :

```bash
python -m pip install -e .[dev]
```

Démarrage local :

```bash
cp ../../.env.example ../../.env
python -m antaerus_brain.app
```

Validation locale :

```bash
python -m mypy src tests
python -m pytest tests
python -m ruff check .
```

Pour un smoke `M1.4` complet, le provider LLM configuré doit être joignable. Par défaut, le brain attend `Ollama` sur `http://localhost:11434`.
