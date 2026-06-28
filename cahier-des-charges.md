# Cahier des Charges — aNtaerus

## Version 2.0 — Juin 2026
## Basé sur l'analyse de jarvis-OS + Stack polyglotte Go/Rust/Python/React

---

## Table des matières

1. [Contexte et Vision](#1-contexte-et-vision)
2. [Différences clés avec jarvis-OS](#2-différences-clés-avec-jarvis-os)
3. [Spécifications Fonctionnelles](#3-spécifications-fonctionnelles)
4. [Spécifications Techniques](#4-spécifications-techniques)
5. [Architecture Logicielle](#5-architecture-logicielle)
6. [Interfaces et API](#6-interfaces-et-api)
7. [Sécurité et Gouvernance](#7-sécurité-et-gouvernance)
8. [Performance et Scalabilité](#8-performance-et-scalabilité)
9. [Déploiement et Distribution](#9-déploiement-et-distribution)
10. [Planning et Jalons](#10-planning-et-jalons)
11. [Leçons apprises de jarvis-OS](#11-leçons-apprises-de-jarvis-os)
12. [Glossaire](#12-glossaire)

---

## 1. Contexte et Vision

### 1.1 Énoncé du problème

Les assistants vocaux existants (Siri, Alexa, Google Assistant) et les assistants IA cloud (ChatGPT, Claude) présentent des limitations critiques :
- **Dépendance cloud** : données personnelles sur des serveurs externes
- **Personnalisation limitée** : mémoire de session, pas d'apprentissage long terme
- **Latence vocale** : 2-5 secondes entre la question et la réponse parlée
- **Fermeture** : écosystème verrouillé, pas d'extension par l'utilisateur
- **Performance** : pas de calcul intensif local, pas de temps réel

### 1.2 Vision produit

**aNtaerus** est un assistant personnel IA **self-hosted**, **open source**, **multi-modal** (texte + voix) et **extensible**. Il combine :
- Un **cerveau IA** local (LLM) avec mémoire persistante atomique
- Un **pipeline vocal temps réel** (< 1000ms bout-en-bout) via Rust
- Un **gateway haute performance** (Go) pour 10k+ connexions
- Un **dashboard web réactif** (React + Vite)
- Un **système d'outils** extensible (web, email, calendrier, domotique)
- Un **moteur proactif** qui anticipe les besoins
- Un **Skill Lab** pour créer et tester des extensions

### 1.3 Positionnement

| | aNtaerus | jarvis-OS | Siri/Alexa | ChatGPT |
|--|----------|-----------|------------|---------|
| Hébergement | Local | Local | Cloud | Cloud |
| Mémoire long terme | Oui (facts atomiques) | Oui | Non | Limitée |
| Voix temps réel | **< 1000ms** | ~2-3s | Oui | Non |
| Stack | **Go/Rust/Python/React** | Python/FastAPI | Propriétaire | Propriétaire |
| Concurrence | **10k+ WebSocket** | ~100-500 | Massive | N/A |
| Calcul intensif | **Rust natif** | Python limité | Cloud | Cloud |
| Extensibilité | Skills WASM | Skills Python | Non | Plugins limités |

### 1.4 Public cible

- **Développeurs** : veulent un assistant hackable, extensible, polyglotte
- **Power users** : productivité, automatisation, vie privée
- **Entreprises** : assistant interne, données sensibles, compliance
- **Enthousiastes domotique** : contrôle maison intelligent, temps réel

---

## 2. Différences clés avec jarvis-OS

### 2.1 Architecture : de Python monolithique à polyglotte

| Aspect | jarvis-OS | aNtaerus |
|--------|-----------|----------|
| Gateway | FastAPI (Python) | **Go** (goroutines, 100x plus de connexions) |
| Pipeline vocal | Python + LiveKit | **Rust** (STT/TTS natif, < 5ms par frame) |
| Cerveau IA | Python (FastAPI) | **Python** (conservé, irremplaçable pour LLM) |
| UI | (non précisé, probablement Jinja/static) | **React + Vite** (SPA moderne, temps réel) |
| Audio I/O | PyAudio | **cpal (Rust)** + **Go** (streaming) |
| Mémoire | SQLite + Python | **SQLite** + **Rust** (indexation) + **Python** (NLP) |

### 2.2 Leçons intégrées dès le départ

| Problème jarvis-OS | Solution aNtaerus |
|--------------------|-------------------|
| `os.environ` mutation côté API (3 sources de vérité) | Go lit `.env` une fois au boot, passe par struct config immuable |
| Secrets en clair dans `__repr__` (fuite 9 clés API) | Rust chiffre au repos, Go ne logue jamais les secrets, `SecretString` type |
| `config/` racine hors périmètre import-linter | Architecture en 4 couches strictes dès le départ, pas de shims racine |
| Tests non confinés (résidu `web-research` en prod) | Rust sandbox WASM + Docker obligatoire pour skills |
| Voice loop non testable en CI (dépend LiveKit runtime) | Rust STT/TTS natif, pas de dépendance externe pour les tests |
| Bundle > 2GB (Python + modèles + LiveKit) | Go + Rust binaires statiques, Python service isolé, téléchargement différé |

---

## 3. Spécifications Fonctionnelles

### 3.1 Fonctionnalités Core

#### 3.1.1 Chat texte (synchrone et asynchrone)

| ID | Fonctionnalité | Priorité | Notes |
|----|----------------|----------|-------|
| F-101 | Interface conversation texte avec historique | P0 | Streaming SSE depuis Go |
| F-102 | Streaming réponses (token par token) | P0 | Go proxy le stream Python LLM |
| F-103 | Support multi-session avec contexte | P0 | Session ID géré par Go |
| F-104 | Mode "pensée" visible (chain-of-thought) | P1 | Toggle UI |
| F-105 | Export conversation (Markdown, JSON) | P2 | |
| F-106 | **Partage session entre texte et voix** | P0 | Même session ID, contexte partagé |

#### 3.1.2 Pipeline vocal temps réel

| ID | Fonctionnalité | Priorité | Implémentation |
|----|----------------|----------|----------------|
| F-201 | Activation par wake word ("aNtaerus") | P0 | Rust VAD + détection pattern |
| F-202 | STT local (Whisper) | P0 | Rust `whisper-rs` |
| F-203 | STT cloud (Deepgram) | P1 | Fallback si local indisponible |
| F-204 | TTS local (Piper) | P0 | Rust `piper-rs` |
| F-205 | TTS cloud (ElevenLabs) | P2 | Fallback premium |
| F-206 | Latence bout-en-bout **< 1000ms** | P0 | Objectif clé vs jarvis-OS |
| F-207 | Détection activité vocale (VAD) | P0 | Rust `silero-vad` |
| F-208 | Barge-in (interruption pendant TTS) | P1 | Rust stop TTS, écoute à nouveau |
| F-209 | Reconnaissance locuteur | P2 | Rust + model embedding |
| F-210 | Séquence "Wake Up" biométrique (visage) | P2 | Rust `dlib` bindings ou Python service |

#### 3.1.3 Mémoire vivante (Memory Kernel)

| ID | Fonctionnalité | Priorité | Notes |
|----|----------------|----------|-------|
| F-301 | Extraction facts atomiques automatique | P0 | Python NLP + Rust stockage |
| F-302 | Stockage SQLite (source de vérité) | P0 | Rust `rusqlite` pour perf écriture |
| F-303 | Miroir Markdown lisible (Obsidian-compatible) | P0 | Rust génération unidirectionnelle |
| F-304 | Renforcement facts (confiance) | P0 | |
| F-305 | Archivage facts contradictoires | P0 | Jamais supprimer, toujours archiver |
| F-306 | Catégories facts (vocabulaire fermé) | P1 | `preferences`, `projects`, `goals`, `relations`, `health` |
| F-307 | Recherche sémantique | P1 | Rust `hnsw` index + Python embeddings |
| F-308 | AutoDream (extraction nocturne) | P1 | Python batch, Rust écriture |
| F-309 | Cross-session recall | P2 | |
| F-310 | **Détection contradiction automatique** | P2 | Rust règles + Python LLM |

#### 3.1.4 Système d'outils

| ID | Outil | Description | Priorité | Langage |
|----|-------|-------------|----------|---------|
| F-401 | `browser` | Recherche web + scraping | P0 | Python |
| F-402 | `gmail` | Lire/envoyer emails | P0 | Python |
| F-403 | `calendar` | Google Calendar | P0 | Python |
| F-404 | `spotify` | Contrôle lecture | P1 | Python |
| F-405 | `notion` | Rechercher/lire pages | P1 | Python |
| F-406 | `weather` | Météo (Open-Meteo, sans clé) | P0 | Python |
| F-407 | `vision` | Capture écran + YOLOv8 | P0 | Python |
| F-408 | `filesystem` | Lire fichiers, chercher patterns | P0 | Rust (sandbox) |
| F-409 | `cli` | Commandes shell whitelistées | P1 | Rust (sandbox) |
| F-410 | `memory` | Écrire notes structurées | P0 | Python |
| F-411 | `code` | Exécution code sandbox (WASM) | P2 | Rust `wasmtime` |
| F-412 | `domotic` | Contrôle appareils maison | P3 | Go (MQTT) + Python |

#### 3.1.5 Mission Engine

| ID | Fonctionnalité | Priorité | Notes |
|----|----------------|----------|-------|
| F-501 | Décomposition demande en étapes | P0 | Python |
| F-502 | Vérification structurale | P0 | Python |
| F-503 | Vérification sémantique | P0 | Python LLM |
| F-504 | Exécution étape par étape | P0 | Go orchestre, Python exécute |
| F-505 | Reprise après crash | P1 | Go gère l'état, SQLite persistant |
| F-506 | Réflexion post-mission | P1 | Python |
| F-507 | Capability Engine | P2 | Détecte manque outil/skill |

#### 3.1.6 Moteur proactif

| ID | Fonctionnalité | Priorité | Notes |
|----|----------------|----------|-------|
| F-601 | Collecteurs signaux | P1 | Go schedulers + Python workers |
| F-602 | Niveaux autonomie 0-5 | P0 | Go gate composite |
| F-603 | Command Center | P1 | React UI |
| F-604 | Curator nocturne | P2 | Python batch |
| F-605 | Notifications intelligentes | P1 | Go push WebSocket |

#### 3.1.7 Skill Lab

| ID | Fonctionnalité | Priorité | Notes |
|----|----------------|----------|-------|
| F-701 | Création skills depuis usage | P2 | Python génération |
| F-702 | Sandbox WASM (Rust) | P2 | `wasmtime`, isolation mémoire |
| F-703 | Sandbox Docker | P2 | Python tests |
| F-704 | Validation humaine | P2 | React UI + Go workflow |
| F-705 | Registry skills | P2 | Go API + Rust runtime |
| F-706 | Synthèse automatique | P3 | Python |

### 3.2 Fonctionnalités Interface (React + Vite)

| ID | Écran | Description | Priorité |
|----|-------|-------------|----------|
| UI-101 | **Chat** | Conversation principale, texte + voix | P0 |
| UI-102 | **Memory Explorer** | Facts, recherche, correction, graphe relations | P0 |
| UI-103 | **Command Center** | Initiatives, missions, budgets, autonomie | P1 |
| UI-104 | **Skill Lab** | Création, test, gestion skills | P2 |
| UI-105 | **Setup / Config** | Wizard clés API, identité, modules | P0 |
| UI-106 | **Analytics** | Tokens, coûts, latence, uptime par service | P1 |
| UI-107 | **System Health** | État Go/Rust/Python, logs, restart | P1 |
| UI-108 | **World Monitor** | Dashboard géopolitique (iframe) | P2 |
| UI-109 | **Voice Visualizer** | Onde audio, VAD state, STT confidence | P1 |

### 3.3 Accessibilités

| ID | Canal | Priorité | Implémentation |
|----|-------|----------|----------------|
| ACC-101 | Web (navigateur) | P0 | React + Vite |
| ACC-102 | **Telegram bot** | P1 | Go `tgbot` |
| ACC-103 | **API REST externe** | P2 | Go gateway |
| ACC-104 | Mobile (PWA) | P3 | React PWA |
| ACC-105 | **Macropad physique** | P3 | Rust HID + Go events |

---

## 4. Spécifications Techniques

### 4.1 Stack technologique

| Couche | Technologie | Version | Justification |
|--------|-------------|---------|---------------|
| **Frontend** | React | 18+ | Concurrent features |
| | Vite | 5+ | Build < 100ms, HMR |
| | TypeScript | 5+ | Typage fort |
| | Zustand | 4+ | State léger |
| | TanStack Query | 5+ | Cache server state |
| | Recharts | 2+ | Métriques |
| | **Web Audio API** | — | Visualizer VAD |
| **Gateway** | Go | 1.22+ | Concurrence, networking |
| | Gorilla WebSocket | — | WebSocket mature |
| | gRPC-go | — | Go ↔ Rust |
| | Echo / Fiber | — | HTTP framework |
| | Cobra / Viper | — | CLI + config |
| | `tgbot` | — | Telegram |
| **Moteur temps réel** | Rust | 1.78+ | Performance, sûreté |
| | Tokio | — | Async runtime |
| | tonic | — | gRPC server |
| | whisper-rs | — | STT local |
| | piper-rs | — | TTS local |
| | cpal | — | Audio I/O |
| | silero-vad | — | VAD |
| | scrap | — | Capture écran |
| | wasmtime | — | Sandbox skills |
| | ring | — | Crypto |
| | rusqlite | — | SQLite natif |
| **Cerveau IA** | Python | 3.11+ | LLM, NLP, data |
| | FastAPI | — | API interne (localhost) |
| | uv | — | Deps, builds |
| | aiosqlite | — | SQLite async |
| | pydantic | — | Validation |
| | loguru | — | Logging |
| | httpx | — | HTTP client |
| | **litellm** | — | Multi-LLM proxy |
| **Base données** | SQLite | 3.45+ | Embarqué, zero-config |
| | (futur) PostgreSQL | — | Multi-user / scale |

### 4.2 Protocoles de communication

| Service A | Service B | Protocole | Format | Latence cible |
|-----------|-----------|-----------|--------|---------------|
| React | Go | WebSocket (WSS) | JSON | < 50ms |
| React | Go | HTTP/2 (REST) | JSON | < 100ms |
| Go | Rust | **gRPC bidirectionnel** | Protobuf | < 10ms |
| Go | Python | HTTP/1.1 (interne) | JSON | < 50ms |
| Rust | Python | (via Go) | — | — |
| Python | SQLite | SQL (aiosqlite) | — | < 5ms |
| Go | Redis | RESP | — | < 1ms (cache) |

### 4.3 Modèles IA supportés

| Fournisseur | Modèles | Mode | Priorité |
|-------------|---------|------|----------|
| **Anthropic Claude** | Claude 3.5 Sonnet, Opus | API cloud | P0 |
| **Ollama** | Llama 3, Mistral, etc. | Local | P0 |
| **Mistral** | Mistral Large, Medium | API cloud | P1 |
| **Google Gemini** | Gemini Pro, Ultra | API cloud | P1 |
| **OpenAI** | GPT-4o, GPT-4 | API cloud | P2 |

### 4.4 Audio

| Composant | Option locale | Option cloud | Défaut |
|-----------|---------------|--------------|--------|
| STT | **whisper-rs** (Rust) | Deepgram | whisper-rs |
| TTS | **Piper** (Rust) | ElevenLabs | Piper |
| VAD | **silero-vad** (Rust) | — | silero-vad |

---

## 5. Architecture Logicielle

### 5.1 Principes directeurs (leçons jarvis-OS)

1. **Couches strictes** : L0 (kernel) → L1 (providers/capabilities) → L2 (engine) → L3 (interfaces)
2. **Zéro shim racine** : pas de `config/` ou `main.py` hors packages. Tout est sous `antaerus/`
3. **Configuration immuable** : Go lit `.env` au boot, passe par struct. Jamais mutation runtime
4. **Secrets typés** : `SecretString` (Go), `SecretStr` (Python), chiffrement Rust. `repr` ne fuite jamais
5. **Sandbox par défaut** : tout code utilisateur = WASM (Rust) ou Docker (Python)
6. **Testabilité** : chaque service démarre sans dépendance externe (LiveKit, cloud) pour les tests

### 5.2 Architecture en couches

```
┌─────────────────────────────────────────────────────────────┐
│ L3 — INTERFACES                                               │
│                                                               │
│  web/ (React + Vite build)                                    │
│  ├── Chat, Memory, Command Center, Skill Lab, Setup           │
│  └── Voice Visualizer (Web Audio API)                       │
│                                                               │
│  api/ (Go — HTTP/2 + WebSocket + gRPC client)                 │
│  ├── routers REST (chat, memory, config, skills, system)      │
│  ├── WebSocket hub (goroutines par client)                    │
│  ├── Telegram bot (tgbot)                                     │
│  └── gRPC client → Rust engine                                │
│                                                               │
│  bootstrap.go (composition root)                                │
│  └── Instancie ~30 objets, câble bus, vérifie interfaces      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ L2 — ENGINE (Go)                                              │
│                                                               │
│  gateway/ — API publique, auth JWT, rate limiting            │
│  session/ — Gestion sessions (texte + voix partagé)          │
│  mission/ — Orchestration missions (délègue à Python)        │
│  proactive/ — Collecteurs, Command Center, Curator trigger   │
│  budget/ — BudgetGuard, UsageTracker                         │
│  bus/ — Event bus pub/sub (channels Go)                      │
│  health/ — Healthcheck, metrics Prometheus                   │
└──────────┬───────────────────────────────┬──────────────────┘
           │ gRPC                         │ HTTP (localhost)
    ┌──────▼──────┐                ┌───────▼───────┐
    │  L1 —       │                │  L1 —         │
    │  RUST       │                │  PYTHON       │
    │  PROVIDERS  │                │  BRAIN        │
    │             │                │               │
    │  audio/     │                │  llm/         │
    │    ├── capture (cpal)         │    ├── api.py │
    │    ├── stt (whisper-rs)       │    ├── local.py│
    │    ├── tts (piper)            │    └── factory│
    │    └── vad (silero)           │               │
    │  vision/                      │  memory/      │
    │    ├── capture (scrap)        │    ├── kernel  │
    │    └── preprocess             │    ├── ingest  │
    │  sandbox/                     │    ├── mirror  │
    │    └── wasmtime (skills)      │    └── search  │
    │  crypto/                      │               │
    │    └── ring (signatures)      │  tools/        │
    │  storage/                     │    ├── browser │
    │    └── rusqlite (facts hot)   │    ├── gmail   │
    │  protocol/                    │    ├── calendar│
    │    └── tonic (gRPC server)    │    ├── weather │
    │                               │    ├── vision  │
    │                               │    └── memory  │
    │                               │               │
    │                               │  mission/      │
    │                               │    ├── engine  │
    │                               │    ├── verifier │
    │                               │    └── reflexion│
    │                               │               │
    │                               │  proactive/    │
    │                               │    ├── collectors│
    │                               │    └── curator │
    └─────────────┘                 └───────────────┘
           │                              │
           └──────────┬───────────────────┘
                      │
           ┌──────────▼──────────┐
           │  L0 — KERNEL        │
           │                     │
           │  contracts/         │
           │    ├── protocols.go │
           │    ├── protocols.rs │
           │    └── protocols.py │
           │  schemas/           │
           │  events/            │
           │  settings/          │
           │    ├── config.go (immuable) │
           │    ├── config.rs    │
           │    └── config.py (SecretStr) │
           │  errors/            │
           │  permissions/       │
           │  approval/          │
           │  notifications/       │
           │  paths/               │
           └─────────────────────┘
```

### 5.3 Services détaillés

#### 5.3.1 Go Gateway (`gateway/`)

| Module | Rôle | Interface |
|--------|------|-----------|
| `server.go` | HTTP/2 + TLS | `http.Server` |
| `websocket.go` | Hub WebSocket, goroutines/client | `Hub` |
| `grpc_client.go` | Client gRPC vers Rust | `EngineClient` |
| `http_client.go` | Client HTTP vers Python | `BrainClient` |
| `auth.go` | JWT, sessions, rate limiting | `Authenticator` |
| `telegram.go` | Bot Telegram | `TelegramBot` |
| `config.go` | Viper, `.env` immuable, validation | `Config` (struct) |

**Règle critique** : `Config` est immuable après `bootstrap.build()`. Pas de `os.Setenv`, pas de mutation runtime.

#### 5.3.2 Rust Engine (`engine_rust/`)

| Module | Rôle | Crate |
|--------|------|-------|
| `audio/` | Capture, VAD, STT, TTS | `cpal`, `whisper-rs`, `piper` |
| `vision/` | Capture écran, preprocessing | `scrap`, `image` |
| `sandbox/` | Runtime WASM skills | `wasmtime` |
| `crypto/` | Signatures audit, hash | `ring` |
| `storage/` | SQLite hot facts, index HNSW | `rusqlite`, `hnsw` |
| `protocol/` | gRPC server (tonic) | `tonic` |
| `fs/` | Filesystem sandbox (whitelist) | `cap-std` |

#### 5.3.3 Python Brain (`brain_python/`)

| Module | Rôle | Librairie |
|--------|------|-----------|
| `llm/` | Orchestration LLM, streaming | `litellm`, `anthropic` |
| `memory/` | Kernel mémoire, NLP extraction | `aiosqlite`, `spacy` |
| `tools/` | Implémentations outils | `httpx`, `google-api-python-client` |
| `mission/` | Planification, vérification, réflexion | `pydantic`, `jinja2` |
| `proactive/` | Collecteurs, Command Center logic | `apscheduler`, `feedparser` |
| `skills/` | Génération, tests Docker | `docker`, `jinja2` |

---

## 6. Interfaces et API

### 6.1 API REST (Go Gateway)

| Endpoint | Méthode | Description | Auth |
|----------|---------|-------------|------|
| `/api/v1/chat` | POST | Envoyer message, recevoir stream | JWT |
| `/api/v1/sessions` | GET | Lister sessions | JWT |
| `/api/v1/sessions/{id}` | GET | Détails session | JWT |
| `/api/v1/sessions/{id}` | DELETE | Fermer session | JWT |
| `/api/v1/memory/facts` | GET | Rechercher facts | JWT |
| `/api/v1/memory/facts` | POST | Créer/corriger fact | JWT |
| `/api/v1/missions` | GET | Lister missions | JWT |
| `/api/v1/missions` | POST | Créer mission | JWT |
| `/api/v1/missions/{id}` | GET | Détails mission | JWT |
| `/api/v1/skills` | GET | Lister skills | JWT |
| `/api/v1/skills` | POST | Installer skill | JWT (admin) |
| `/api/v1/config` | GET | Configuration (sans secrets) | JWT |
| `/api/v1/config` | PUT | Modifier configuration | JWT (admin) |
| `/api/v1/health` | GET | Healthcheck (Go + Rust + Python) | None |
| `/api/v1/metrics` | GET | Métriques Prometheus | None (local) |
| `/api/v1/system/restart` | POST | Redémarrer service | JWT (admin) |

### 6.2 WebSocket (Go Gateway)

| Événement client → serveur | Description |
|----------------------------|-------------|
| `chat.message` | Message texte |
| `voice.start` | Démarrer session vocale |
| `voice.stop` | Arrêter session vocale |
| `voice.barge_in` | Interrompre TTS |
| `mission.cancel` | Annuler mission |

| Événement serveur → client | Description |
|----------------------------|-------------|
| `chat.token` | Token stream |
| `chat.complete` | Réponse finie |
| `voice.transcript` | Transcription STT |
| `voice.audio` | Chunk audio TTS (base64) |
| `voice.vad_state` | `speaking` / `silence` |
| `mission.update` | Progression mission |
| `system.alert` | Alerte (niveau autonomie) |
| `proactive.notification` | Notification proactive |
| `health.heartbeat` | Ping services (30s) |

### 6.3 gRPC (Go ↔ Rust)

```protobuf
service AudioEngine {
  rpc StreamAudio(stream AudioChunk) returns (stream AudioEvent);
  rpc Synthesize(SynthesizeRequest) returns (stream AudioChunk);
  rpc CaptureScreen(CaptureRequest) returns (VisionResult);
  rpc ExecuteWASM(ExecuteRequest) returns (ExecuteResult);
  rpc QueryFacts(FactQuery) returns (FactResult);
}

message AudioEvent {
  oneof event {
    Transcript transcript = 1;
    VADState vad_state = 2;
    Error error = 3;
  }
}
```

---

## 7. Sécurité et Gouvernance

### 7.1 Gate composite (niveaux d'autonomie)

| Niveau | Action | Gate | Validation | Service |
|--------|--------|------|------------|---------|
| 0 | Réponse texte/voix | Aucun | Automatique | Go |
| 1 | Lecture info, recherche | Risque faible | Automatique | Go |
| 2 | Écriture mémoire | Catégorie | Automatique | Rust (signe) |
| 3 | Exécution sandbox (WASM) | Risque × catégorie | Automatique + log | Rust |
| 4 | Écriture fichier, email | Risque × catégorie × budget | Automatique + audit | Go + Rust |
| 5 | Paiement, publication, contact | Risque × catégorie × budget | **Humain obligatoire** | React UI |

### 7.2 Audit immuable

| Événement | Stockage | Durée | Signature |
|-----------|----------|-------|-----------|
| Actions ≥ niveau 3 | Append-only log | Permanent | Rust `ring` Ed25519 |
| Coûts tokens/temps | SQLite + CSV | 1 an | — |
| Erreurs | SQLite + rotation | 90 jours | — |
| Auth | SQLite | 1 an | — |

### 7.3 Secrets (leçon jarvis-OS)

| Principe | Implémentation |
|----------|----------------|
| Typage | Go : `type SecretString string` (marshal masqué) |
| | Python : `pydantic.SecretStr` |
| | Rust : `secrecy::SecretString` |
| Chiffrement | Rust `ring` chiffre au repos (AES-256-GCM) |
| Logs | `repr` / `String()` / `Debug` ne montre jamais `***` |
| Fuite détection | Test `test_secrets_no_leak` : grep `sk-`, `ntn_`, etc. |
| Rotation | Alertes si clé > 90 jours |

### 7.4 Configuration (leçon jarvis-OS)

| Anti-pattern | Solution aNtaerus |
|--------------|-------------------|
| `os.environ["KEY"] = value` en runtime | Interdit. Config = struct immuable |
| 3 sources (env, `.env`, singleton) | 1 source : `.env` lu au boot, parsé par Viper/pydantic |
| Env héritée du shell masque `.env` | Warning explicite au boot si conflit détecté |

---

## 8. Performance et Scalabilité

### 8.1 Objectifs (vs jarvis-OS)

| Métrique | jarvis-OS | aNtaerus (objectif) |
|----------|-----------|---------------------|
| Latence STT → texte | ~500ms | **< 200ms** |
| Latence LLM premier token | ~1-2s | **< 500ms** |
| Latence TTS → audio | ~300ms | **< 300ms** |
| Latence bout-en-bout voix | ~2-3s | **< 1000ms** |
| Connexions WebSocket | ~100-500 | **10 000+** |
| Throughput parsing | Python limité | **1M msg/s/core (Rust)** |
| Temps démarrage | ~10s | **< 5s** |

### 8.2 Ressources matérielles

| Profil | CPU | RAM | GPU | Stockage | Usage |
|--------|-----|-----|-----|----------|-------|
| **Léger** | 2 cores | 4 GB | Non | 2 GB | Texte, cloud LLM |
| **Standard** | 4 cores | 16 GB | 8 GB VRAM | 10 GB | Voix + LLM 7B local |
| **Confort** | 8 cores | 32 GB | 24 GB VRAM | 50 GB | Voix + LLM 70B local |
| **Développement** | 6 cores | 32 GB | 12 GB VRAM | 30 GB | Tous services |

### 8.3 Stratégies d'optimisation

| Composant | Stratégie |
|-----------|-----------|
| LLM | Quantification Q4_K_M, KV-cache, batching |
| STT | Whisper.cpp + CoreML/Metal/CUDA |
| TTS | Streaming phonème par phonème |
| Mémoire | HNSW index, cache LRU hot facts |
| Go | Connection pooling, Brotli, keep-alive |
| Rust | Zero-copy parsing, arena allocators |

---

## 9. Déploiement et Distribution

### 9.1 Modes de distribution

| Mode | Cible | Procédure |
|------|-------|-----------|
| **Bundle Windows** | Utilisateur final | `.zip` avec Go exe, Rust exe, Python venv, modèles |
| **Bundle Linux** | Serveur, NAS | `.tar.gz` ou AppImage |
| **Bundle macOS** | Power user | `.dmg` ou Homebrew |
| **Docker Compose** | Développeur, VPS | `docker-compose up` |
| **Source** | Contributeur | `git clone`, `make build` |

### 9.2 Structure bundle

```
antaerus/
├── aNtaerus.exe              # Launcher Go (ou shell script)
├── config/
│   ├── .env                  # Clés API (chiffrées)
│   └── tools.yaml            # Whitelist CLI
├── runtime/
│   ├── go/                   # Binaires Go (gateway, static)
│   ├── rust/                 # Binaires Rust (engine, static)
│   └── python/               # Python 3.11 + venv + deps
├── models/
│   ├── whisper/              # Modèle STT
│   ├── piper/                # Voix TTS
│   └── yolo/                 # YOLOv8
├── memory_data/              # SQLite, vault Markdown
│   ├── antaerus_memory.db
│   └── topics/
├── logs/                     # Rotation
└── docs/
```

### 9.3 Scripts de lancement

| Commande | Action |
|----------|--------|
| `antaerus setup` | Assistant web configuration (:8765) |
| `antaerus run` | Tous services |
| `antaerus api` | Go gateway + Python brain seuls |
| `antaerus voice` | Rust engine + Go gateway seuls |
| `antaerus doctor` | Diagnostic (healthcheck tous services) |
| `antaerus purge` | Effacement données (confirmation) |
| `antaerus update` | Mise à jour bundle |

---

## 10. Planning et Jalons

### 10.1 Phases de développement

| Phase | Durée | Livrable | Focus |
|-------|-------|----------|-------|
| **M0 — Fondation** | 3 semaines | CI/CD, architecture, bootstrap, tests | Go + Rust + Python squelette |
| **M1 — Core texte** | 3 semaines | Chat texte, LLM, mémoire basique | Python brain + React + Go API |
| **M2 — Voix** | 4 semaines | **Pipeline vocal temps réel** | Rust audio + Go WebSocket |
| **M3 — Outils** | 3 semaines | Browser, Gmail, Calendar, vision | Python tools |
| **M4 — Mission** | 3 semaines | Mission Engine, vérification | Python |
| **M5 — Proactif** | 3 semaines | Collecteurs, Command Center | Go + Python |
| **M6 — Polish** | 3 semaines | UI complète, setup, bundle, tests | React + CI/CD |
| **M7 — Skills** | 4 semaines | Skill Lab, WASM sandbox, registry | Rust + Python |
| **M8 — Domotique** | 3 semaines | MQTT, Home Assistant integration | Go + Python |
| **M9 — Release** | 2 semaines | Tests, doc, bundle, benchmark | Tous |

**Total : ~7-8 mois** pour v1.0. MVP utilisable en **M2** (chat + voix).

### 10.2 MVP (M2 — 10 semaines)

> **Chat texte + voix temps réel + mémoire basique + 3 outils**

Stack MVP :
- React + Vite (UI)
- Go (gateway WebSocket + HTTP)
- Rust (STT Whisper + TTS Piper + VAD)
- Python (LLM via Ollama + mémoire SQLite)

**Benchmark MVP** : Latence voix < 1000ms sur laptop standard.

---

## 11. Leçons apprises de jarvis-OS

### 11.1 Architecture

| Leçon | Application aNtaerus |
|-------|----------------------|
| Couches strictes dès le départ | L0-L3 validés par CI, pas de retrofit |
| Pas de shim racine | Tout sous `antaerus/`, `config/` interdit |
| Protocols + mypy | Conformité vérifiée en CI, 12+ couples |

### 11.2 Sécurité

| Leçon | Application aNtaerus |
|-------|----------------------|
| Secrets `SecretStr` | Go + Rust + Python, tous typés |
| Pas de `os.environ` mutation | Config immuable, rechargement par restart |
| Audit env/.env | Warning au boot si conflit détecté |

### 11.3 Testabilité

| Leçon | Application aNtaerus |
|-------|----------------------|
| Voice loop testable | Rust STT/TTS natif, pas de dépendance LiveKit |
| Smoke runtime | Test démarrage froid chaque service |
| Tests confinés | Rust WASM sandbox, Python tmp_path obligatoire |

### 11.4 Distribution

| Leçon | Application aNtaerus |
|-------|----------------------|
| Bundle relocalisable | Chemins relatifs, pas d'absolu build |
| Python autonome | `bundle/python`, pas de dépendance système |
| Téléchargement différé | Modèles LLM optionnels, pas dans bundle |

---

## 12. Glossaire

| Terme | Définition |
|-------|------------|
| **aNtaerus** | Nom du produit. Assistant personnel IA self-hosted, polyglotte |
| **AutoDream** | Processus nocturne d'extraction facts manqués |
| **Barge-in** | Interruption utilisateur pendant TTS |
| **Capability Engine** | Détecte et comble les manques de capacité |
| **Curator** | Job nocturne de maintenance et optimisation |
| **Fact atomique** | Unité minimale de connaissance (sujet-prédicat-objet) |
| **Gate composite** | Validation multi-critères (risque × catégorie × budget) |
| **HNSW** | Hierarchical Navigable Small World — recherche vectorielle |
| **KV-cache** | Cache clé-valeur pour inférence LLM |
| **Mission Engine** | Planification et exécution de tâches complexes |
| **Piper** | Moteur TTS open source, léger |
| **Proactif** | Actions entreprises sans sollicitation |
| **Q4_K_M** | Quantification LLM 4 bits |
| **Skill** | Extension utilisateur, code sandboxé |
| **STT** | Speech-to-Text |
| **TTS** | Text-to-Speech |
| **VAD** | Voice Activity Detection |
| **Wake word** | Mot déclencheur ("aNtaerus") |
| **WASM** | WebAssembly — format binaire sandboxé |

---

## Annexes

### A. Matrice RACI

| Fonctionnalité | Responsable | Consulté | Informé |
|----------------|-------------|----------|---------|
| Architecture | Architecte | Équipe | PO |
| Pipeline voix | Rust lead | Audio expert | QA |
| LLM / mémoire | Python lead | Data scientist | PO |
| UI / UX | Frontend lead | Designer | PO |
| Gateway / networking | Go lead | DevOps | PO |
| Sécurité | Security lead | Tous | Direction |
| DevOps / CI | DevOps | Tous | Équipe |

### B. Checklist validation v1.0

- [ ] Tous P0 implémentés et testés
- [ ] Couverture tests > 80%
- [ ] Tests intégration passent (30+ scénarios)
- [ ] Latence voix < 1000ms sur hardware standard
- [ ] 10k connexions WebSocket simultanées (Go)
- [ ] 1M msg/s parsing (Rust)
- [ ] Secrets jamais dans logs
- [ ] Bundle < 1.5 GB compressé
- [ ] Documentation complète (API, architecture, user guide)
- [ ] Licence open source choisie (MIT/Apache 2.0)
- [ ] Audit sécurité interne passé

---

**Document rédigé le 20 juin 2026**

**aNtaerus** — *Votre présence, amplifiée.*