# aNtaerus

[![CI](https://github.com/LordPhenixDeNetra/aNtaerus/actions/workflows/ci.yml/badge.svg)](https://github.com/LordPhenixDeNetra/aNtaerus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

`aNtaerus` est une application open source et self-hosted d'assistant IA polyglotte, pensée comme un monorepo modulaire combinant :

- une interface Web en `React`
- un gateway en `Go`
- un brain en `Python`
- un moteur temps réel en `Rust`

Le projet vise une architecture d'assistant personnel extensible, gouvernée, orientée local-first et progressive, avec une montée en puissance par jalons : fondation, chat texte, voix temps réel, tools, missions, proactive et bundle de distribution.

## Vision

`aNtaerus` cherche à fournir une base sérieuse pour un assistant IA personnel :

- open source
- exécutable localement
- modulaire par langage selon les responsabilités
- piloté par contrats explicites
- extensible vers la voix, les outils, les missions et l'autonomie gouvernée

## Statut du projet

Le projet est en phase active de construction.

Disponible aujourd'hui :

- fondation monorepo exécutable
- gateway Go avec REST, JWT, WebSocket et rate limiting
- brain Python avec providers LLM, streaming et mémoire SQLite
- UI Web React avec chat texte, `Setup` local et historique de session
- intégration texte `React -> Go -> Python -> Go -> React`

En cours ou prévus ensuite :

- voix temps réel
- tools
- mission engine
- moteur proactif
- bundle complet de distribution

## Fonctionnalités actuelles

- chat texte multi-session avec historique persistant
- streaming token par token via WebSocket
- JWT de développement pour les usages locaux
- configuration backend centralisée dans un `.env`
- configuration navigateur locale via l'écran `Setup`
- healthchecks et smoke tests par service
- CI multi-stack `web`, `go`, `python`, `rust`

## Architecture

Le dépôt est structuré sous `antaerus/` :

```text
antaerus/
├── docs/
├── engine/
├── interfaces/
│   ├── gateway_go/
│   └── web/
├── kernel/
├── providers/
│   ├── brain_python/
│   └── engine_rust/
└── scripts/
```

### Rôles principaux

- `interfaces/web/` : interface utilisateur React/Vite
- `interfaces/gateway_go/` : point d'entrée HTTP/WebSocket, auth, agrégation système
- `providers/brain_python/` : orchestration LLM, mémoire et flux SSE internes
- `providers/engine_rust/` : moteur Rust orienté performances et temps réel
- `kernel/` : contrats, schémas et primitives transverses
- `engine/` : bootstrap et orchestration transverse

## Stack technique

- `React`, `Vite`, `TypeScript`, `Zustand`, `TanStack Query`
- `Go`, `Viper`, `gorilla/websocket`, `jwt`
- `Python`, `FastAPI`, `pydantic`, `litellm`, `aiosqlite`
- `Rust`, `tonic`, `secrecy`, `ring`
- `GitHub Actions` pour la CI

## Prérequis

- Node.js 20+
- npm 10+
- Go 1.22+
- Python 3.11+
- Rust stable
- Docker Desktop en option pour `docker compose`
- `Ollama` en option si vous utilisez le provider local par défaut

## Installation rapide

### 1. Cloner le dépôt

```bash
git clone https://github.com/LordPhenixDeNetra/aNtaerus.git
cd aNtaerus/antaerus
```

### 2. Préparer la configuration

```bash
cp .env.example .env
```

Sous Windows PowerShell :

```powershell
Copy-Item .env.example .env
```

### 3. Adapter le `.env`

Le runtime de développement utilise un fichier unique :

- `antaerus/.env`

Le modèle versionné est :

- `antaerus/.env.example`

Important :

- le `.env` réel ne doit jamais être commité
- le frontend ne lit pas ce `.env` pour les préférences utilisateur
- les préférences de l'interface restent stockées côté navigateur dans `Setup`

## Configuration

Le `.env` centralise notamment :

- l'environnement d'exécution
- les URLs inter-services
- la configuration du gateway
- les providers LLM du brain
- les secrets de développement
- les ports du moteur Rust

Si vous gardez le provider par défaut `ollama`, vérifiez qu'une instance locale est joignable sur :

- `http://localhost:11434`

## Lancement local

### Windows

Lancement de tous les services :

```powershell
./scripts/dev-all.ps1
```

Arrêt propre :

```powershell
./scripts/stop-all.ps1
```

Lancement service par service :

```powershell
./scripts/dev-brain.ps1
./scripts/dev-engine.ps1
./scripts/dev-gateway.ps1
./scripts/dev-web.ps1
```

### Unix

```bash
./scripts/dev-brain.sh
./scripts/dev-engine.sh
./scripts/dev-gateway.sh
./scripts/dev-web.sh
```

### Docker Compose

```bash
docker compose up --build
```

## Endpoints utiles

- frontend : `http://localhost:5173`
- gateway : `http://localhost:8080`
- brain : `http://localhost:8000`
- engine : `http://localhost:7000`
- gateway health : `GET /health`
- gateway dev token : `POST /api/v1/auth/dev-token`
- historique de session : `GET /api/v1/chat/sessions/{session_id}`
- brain session stream : `POST /llm/session-stream`

## Vérification et qualité

### Web

```bash
cd interfaces/web
npm install
npm run lint
npm run check
npm run test
npm run build
```

### Gateway Go

```bash
go test ./interfaces/gateway_go/...
```

### Brain Python

```bash
cd providers/brain_python
python -m pip install -e .[dev]
python -m ruff check .
python -m mypy src tests
python -m pytest tests
```

### Engine Rust

```bash
cd providers/engine_rust
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

### Sécurité

```bash
task test:security
```

### Smoke texte

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validation\smoke-text-chat.ps1
```

Le smoke `M1.4` exige un provider LLM réellement disponible, sinon il échoue explicitement.

## Documentation complémentaire

- [Web UI](./interfaces/web/README.md)
- [Brain Python](./providers/brain_python/README.md)
- [Secrets et sécurité technique](./docs/security/SECRETS.md)

## Roadmap

### Livré

- `M0` Fondation
- `M1.1` Gateway Go
- `M1.2` Brain Python
- `M1.3` UI React/Vite
- `M1.4` Intégration texte

### Prévu

- `M2` Voix temps réel
- `M3` Tools
- `M4` Mission Engine
- `M5` Proactive Engine
- `M6` UI complète et bundle
- `M7` Skill Lab
- `M8` Domotique
- `M9` Release

Le détail du backlog de projet est maintenu dans `../tasks.md`.

## Open Source

`aNtaerus` est conçu comme un projet open source public.

Vous trouverez dans ce dépôt :

- un fichier de licence `MIT`
- un guide de contribution
- un code de conduite
- une politique de sécurité
- un changelog initial

## Contribution

Les contributions sont bienvenues.

Avant d'ouvrir une PR :

- lisez [CONTRIBUTING.md](../CONTRIBUTING.md)
- vérifiez les conventions du monorepo
- maintenez `tasks.md` à jour lorsque cela s'applique
- ne committez jamais de secrets ou de `.env` réel

## Sécurité

Pour signaler une vulnérabilité ou une exposition de secret :

- ne publiez pas le détail en clair dans une issue publique
- consultez [SECURITY.md](../SECURITY.md)
- référez-vous aussi à [SECRETS.md](./docs/security/SECRETS.md) pour les règles techniques déjà en place

## Licence

Ce projet est distribué sous licence `MIT`.

Voir [LICENSE](../LICENSE).
