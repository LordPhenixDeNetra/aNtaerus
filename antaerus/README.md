# aNtaerus

`aNtaerus` est la fondation d'un assistant IA self-hosted polyglotte construite autour de `React`, `Go`, `Python` et `Rust`, désormais structurée sous `antaerus/` selon les couches `L0 -> L3`.

## Phase Courante

Cette livraison met en place une base exécutable avec premier chat texte intégré :
- `interfaces/web/` : UI texte React avec `Chat`, `Setup`, JWT de dev et historique de session
- `interfaces/gateway_go/` : agrégation d'état, API système, WebSocket, historique de chat et dev token
- `providers/brain_python/` : service Python session-aware avec streaming LLM et persistance SQLite
- `providers/engine_rust/` : service Rust minimal
- `kernel/` : contrats, settings, permissions, approval, notifications
- `engine/` : bootstrap d'orchestration

## Prérequis

- Node.js 20+
- npm 10+
- Go 1.22+
- Python 3.11+
- Rust stable
- Docker Desktop (optionnel pour `docker-compose`)

## Configuration

- La configuration runtime de développement est centralisée dans `antaerus/.env`.
- Copiez `antaerus/.env.example` vers `antaerus/.env`, puis adaptez les valeurs locales.
- Le fichier `.env` réel reste ignoré par Git ; seul `.env.example` est versionné.
- Le frontend Web ne lit pas ce `.env` pour ses préférences utilisateur : `Setup` continue à stocker ses valeurs dans le navigateur.
- La structure `config/.env` décrite dans le CDC concerne la future phase bundle/release, pas le démarrage développeur actuel.

## Structure

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

## Démarrage Natif

### Windows

```powershell
cd antaerus
Copy-Item .env.example .env
./scripts/dev-all.ps1
./scripts/stop-all.ps1
```

Ou, service par service :

```powershell
cd antaerus
Copy-Item .env.example .env
./scripts/dev-brain.ps1
./scripts/dev-engine.ps1
./scripts/dev-gateway.ps1
./scripts/dev-web.ps1
```

- `./scripts/dev-all.ps1` ouvre les 4 services en parallele, attend les ports applicatifs et enregistre les PID dans `%TEMP%\antaerus-dev-all-processes.json`.
- `./scripts/stop-all.ps1` termine proprement les processus lances par `dev-all.ps1`.

### Unix

```bash
cd antaerus
cp .env.example .env
./scripts/dev-brain.sh
./scripts/dev-engine.sh
./scripts/dev-gateway.sh
./scripts/dev-web.sh
```

## Démarrage Standardisé

```bash
cd antaerus
cp .env.example .env
docker compose up --build
```

## Endpoints Utiles

- frontend : `http://localhost:5173`
- gateway : `http://localhost:8080`
- brain : `http://localhost:8000`
- engine : `http://localhost:7000`
- gateway health : `http://localhost:8080/health`
- gateway dev token : `POST http://localhost:8080/api/v1/auth/dev-token`
- gateway session history : `GET http://localhost:8080/api/v1/chat/sessions/{session_id}`
- brain session stream : `POST http://localhost:8000/llm/session-stream`
- brain session history : `GET http://localhost:8000/memory/chat/sessions/{session_id}`

## Vérification

- `interfaces/web/` : `npm install && npm run check && npm run build && npm run test`
- `antaerus/` : `go test ./interfaces/gateway_go/...`
- `providers/brain_python/` : `python -m pytest`
- `providers/engine_rust/` : `cargo test`
- sécurité fondation : `task test:security`
- smoke texte `M1.4` : `powershell -ExecutionPolicy Bypass -File .\scripts\validation\smoke-text-chat.ps1`

## Commandes M0.3

- générer les stubs Go : `task generate:proto:go`
- générer les stubs Rust : `task generate:proto:rust`
- lancer tous les benches locaux : `task bench:latency`
- bench Go ↔ Python : `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-go-python-latency.ps1`
- bench Go ↔ Rust : `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-go-rust-latency.ps1`

## Artifacts M0.3

- proto partagé : `kernel/proto/engine.proto`
- stubs Go : `interfaces/gateway_go/internal/gen/enginepb/`
- stub Rust consommé par le provider : `providers/engine_rust/src/gen/engine.rs`
- schémas WebSocket : `kernel/schemas/websocket-client-message.schema.json` et `kernel/schemas/websocket-server-message.schema.json`

## Commandes M0.4

- valider les secrets : `task test:security`
- script PowerShell anti-fuite : `powershell -ExecutionPolicy Bypass -File .\scripts\validation\test-secrets-no-leak.ps1`
- documentation sécurité : `docs/security/SECRETS.md`

## Documents

- [PRD fondation](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.trae/documents/antaerus-prd-fondation.md)
- [Architecture technique](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.trae/documents/antaerus-architecture-technique.md)

## Flux Texte M1.4

Le flux texte intégré fonctionne désormais ainsi :

- `React` ouvre `GET /api/v1/ws?token=<jwt>`
- le gateway Go relaie `chat.message` vers `POST /llm/session-stream`
- le brain Python stream les événements `token`, `complete`, `error`
- le gateway retransmet `chat.token` puis `chat.complete`
- l'historique d'une session est relu via `GET /api/v1/chat/sessions/{session_id}`

Prérequis locaux pour un smoke réel :

- gateway Go démarré ;
- brain Python démarré ;
- provider LLM joignable par le brain, par défaut `Ollama` sur `http://localhost:11434`.
