# Liste complète des tâches — aNtaerus

## Règles de pilotage documentaire

- `tasks.md` est le backlog principal et la source de vérité opérationnelle du projet.
- `cahier-des-charges.md` est la référence stable de vision produit, d'architecture cible et de contraintes.
- Toute avancée validée doit entraîner une mise à jour immédiate de `tasks.md` au niveau de la sous-tâche.
- Les plans sous `.trae/documents/` servent de cadrage d'exécution, mais ne remplacent jamais `tasks.md`.

> Audit rétroactif initial : une fondation exécutable est déjà livrée dans le dépôt. Les cases ci-dessous ont été réalignées de manière conservatrice ; les éléments seulement partiellement couverts restent ouverts.

## Phase M0 — Fondation (3 semaines)

### M0.1 — Architecture & Bootstrap
- [x] Définir la structure de dossiers `antaerus/` avec les 4 couches (L0-L3)
- [x] Créer `kernel/` (L0) : `contracts.go`, `contracts.rs`, `contracts.py`, `schemas/`, `events/`, `errors/`, `paths/`
- [x] Implémenter `settings/` L0 : config immuable Go (Viper), `SecretStr` Python (pydantic), `secrecy` Rust
- [x] Créer `permissions/` L0 : rôles, autonomie niveaux 0-5
- [x] Créer `approval/` L0 : gate composite (risque × catégorie × budget)
- [x] Créer `notifications/` L0 : bus d'événements pub/sub cross-langage
- [x] Écrire `bootstrap.go` : composition root unique (instancie ~30 objets, câble le bus)
- [x] Écrire `bootstrap.py` : composition root Python (mirror Go)
- [x] Écrire `bootstrap.rs` : composition root Rust (mirror Go)
- [x] Définir les Protocols/Interfaces entre couches (Go interfaces, Rust traits, Python Protocols)
- [x] **Règle critique** : zéro fichier hors package `antaerus/` (pas de `config/` racine, pas de `main.py` racine)

État actuel :
- La structure stricte est matérialisée sous `antaerus/kernel`, `antaerus/providers`, `antaerus/engine` et `antaerus/interfaces`.
- Les doublons techniques racine `web/`, `gateway_go/`, `brain_python/` et `engine_rust/` ont été supprimés pour tenir la règle de structure.
- Les validations du layout strict ont été rejouées avec succès : `go test ./interfaces/gateway_go/...`, `python -m pytest`, `cargo test`, `npm run check`, `npm run build`, `npm run test`.

### M0.2 — CI/CD & Tooling
- [x] Initialiser repo Git avec `.gitignore` robuste (pas de secrets, pas de `memory_data/`, pas de `bundle/`)
- [x] Configurer GitHub Actions : lane rapide (push) + lane lourde (main + hebdo)
- [x] Intégrer `ruff` (Python lint/format)
- [x] Intégrer `import-linter` (Python : contrats de couches)
- [x] Intégrer `mypy` scopé (kernel + conformité Protocols)
- [x] Intégrer `golangci-lint` (Go)
- [x] Intégrer `clippy` + `cargo fmt` + `cargo check` (Rust)
- [x] Intégrer `eslint` + `prettier` (React/TypeScript)
- [x] Configurer pytest : suite unitaire (`-m "not integration"`) + suite complète
- [x] Créer `Makefile` ou `Taskfile` : `make test`, `make lint`, `make typecheck`, `make build`
- [x] Configurer `pre-commit` hooks
- [x] Créer `scripts/validation/` : smoke tests démarrage froid par service

État actuel :
- La CI est désormais séparée en lane rapide (`push` / `pull_request`) et lane lourde (`main` + hebdo) dans `.github/workflows/ci.yml`.
- Le socle outillage est matérialisé par `Taskfile.yml`, `.pre-commit-config.yaml`, `.golangci.yml`, `antaerus/providers/brain_python/.importlinter` et `antaerus/interfaces/web/.prettierrc.json`.
- Le `kernel` Python est packagé minimalement avec `antaerus/__init__.py`, `antaerus/kernel/__init__.py`, `antaerus/kernel/contracts/__init__.py` et `antaerus/kernel/settings/__init__.py` pour supporter `mypy` et `import-linter`.
- Les smoke tests de démarrage froid existent désormais sous `antaerus/scripts/validation/` en `.ps1` et `.sh` pour `brain`, `gateway`, `engine` et `web`.
- Le démarrage natif Windows peut maintenant se faire en une seule commande via `antaerus/scripts/dev-all.ps1`, avec arrêt associé via `antaerus/scripts/stop-all.ps1` et suivi des PID dans `%TEMP%\antaerus-dev-all-processes.json`.
- Validations rejouées avec succès : `golangci-lint run --config ../.golangci.yml`, `python -m ruff check`, `python run_import_linter.py`, `python -m mypy`, `python -m pytest -m "not integration"`, `python -m pytest`, `npm run lint`, `npm run format:check`, `npm run check`, `npm run build`, `npm run test`, `rustfmt --edition 2021 --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo check`, `cargo test` et les smoke tests PowerShell.

### M0.3 — Communication inter-services
- [x] Définir le schéma Protobuf pour gRPC Go ↔ Rust
- [x] Générer les stubs Go (`protoc-gen-go`)
- [x] Générer les stubs Rust (`tonic-build`)
- [x] Définir le format JSON pour HTTP Go ↔ Python
- [x] Définir le format JSON pour WebSocket Go ↔ React
- [x] Implémenter le bus d'événements interne Go (channels + goroutines)
- [x] Tester la latence Go ↔ Rust (< 10ms)
- [x] Tester la latence Go ↔ Python (< 50ms)

État actuel :
- Le format JSON HTTP Go ↔ Python est matérialisé par `antaerus/interfaces/gateway_go/internal/clients/python_client.go`, `antaerus/providers/brain_python/src/antaerus_brain/api/health.py` et les schémas `antaerus/kernel/schemas/*.json`.
- Le contrat gRPC de fondation est défini dans `antaerus/kernel/proto/engine.proto` avec `Ping`, `GetHealth` et `GetCapabilities`.
- Les stubs Go sont matérialisés dans `antaerus/interfaces/gateway_go/internal/gen/enginepb/` et consommés par `antaerus/interfaces/gateway_go/internal/clients/engine_grpc_client.go`.
- Le provider Rust expose désormais un listener gRPC de fondation via `antaerus/providers/engine_rust/src/grpc_service.rs` en s'appuyant sur `antaerus/providers/engine_rust/src/gen/engine.rs`.
- Le format WebSocket Go ↔ React est matérialisé dans `antaerus/kernel/schemas/websocket-client-message.schema.json`, `antaerus/kernel/schemas/websocket-server-message.schema.json`, `antaerus/interfaces/web/src/lib/ws.ts` et `antaerus/interfaces/gateway_go/internal/contracts/websocket.go`.
- Le bus d'événements Go est implémenté dans `antaerus/engine/events/bus.go` avec tests dans `antaerus/engine/events/bus_test.go`.
- Benchmarks locaux validés : Go ↔ Python `2.31608ms` via `antaerus/scripts/validation/bench-go-python-latency.ps1` et Go ↔ Rust `834.768µs` via `antaerus/scripts/validation/bench-go-rust-latency.ps1`.
- Validations rejouées avec succès : `go test ./engine/... ./interfaces/gateway_go/...`, `cargo check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, `npm run check` et `powershell -ExecutionPolicy Bypass -File .\scripts\validation\smoke-engine.ps1`.

### M0.4 — Sécurité fondamentale
- [x] Implémenter `SecretString` Go (marshal masqué)
- [x] Implémenter `SecretStr` Python (pydantic)
- [x] Implémenter `secrecy::SecretString` Rust
- [x] Écrire le test de mortalité : `test_secrets_no_leak` (grep `sk-`, `ntn_`, etc.)
- [x] Configurer chiffrement au repos Rust (`ring` AES-256-GCM)
- [x] Documenter : jamais de `os.Setenv` / `os.environ` mutation en runtime
- [x] Créer `docs/security/SECRETS.md`

État actuel :
- Go : `antaerus/kernel/settings/config.go` masque désormais les secrets via `String()`, `GoString()`, `MarshalJSON()` et `MarshalText()` ; les tests associés sont dans `antaerus/kernel/settings/config_test.go`.
- Python : `antaerus/kernel/settings/config.py` utilise un modèle `pydantic` figé avec `SecretStr`, `antaerus/providers/brain_python/src/antaerus_brain/config.py` conserve `SecretStr`, et les validations sont dans `antaerus/providers/brain_python/tests/test_secrets.py`.
- Rust : `antaerus/providers/engine_rust/src/config.rs` continue d'utiliser `secrecy::SecretString`, et la primitive AES-256-GCM réutilisable est implémentée dans `antaerus/providers/engine_rust/src/crypto.rs` avec tests dans `antaerus/providers/engine_rust/tests/crypto.rs` et `antaerus/providers/engine_rust/tests/secrets.rs`.
- Anti-fuite : `antaerus/providers/brain_python/tests/test_secrets_no_leak.py` scanne les fichiers texte du dépôt avec des motifs ciblés (`sk-...`, `ntn_...`) et des exclusions de caches/artefacts ; scripts de validation ajoutés dans `antaerus/scripts/validation/test-secrets-no-leak.ps1` et `.sh`.
- Documentation : `antaerus/docs/security/SECRETS.md` formalise le typage des secrets, la règle d'immuabilité runtime et les exceptions de tooling (`run_import_linter.py`, `tools/proto_codegen/src/main.rs`).
- Outillage : `Taskfile.yml` expose `test:security`, mais la commande `task` n'était pas disponible dans le shell local de validation ; les contrôles ont donc été rejoués directement via les commandes sous-jacentes.
- Validations exécutées avec succès : `go test ./kernel/settings/...`, `python -m pytest tests/test_secrets.py tests/test_secrets_no_leak.py -q`, `powershell -ExecutionPolicy Bypass -File .\scripts\validation\test-secrets-no-leak.ps1`, `cargo check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`.

---

## Phase M1 — Core Texte (3 semaines)

### M1.1 — Go Gateway
- [x] Implémenter `gateway/server.go` : HTTP/2 server avec TLS optionnel
- [x] Implémenter `gateway/websocket.go` : hub WebSocket, goroutine par client
- [x] Implémenter `gateway/auth.go` : JWT génération + validation
- [x] Implémenter `gateway/rate_limit.go` : rate limiting par IP / par user
- [x] Implémenter `gateway/router.go` : routing REST API v1
- [x] Implémenter `gateway/health.go` : healthcheck Go + proxy Rust + Python
- [x] Implémenter `gateway/http_client.go` : client HTTP vers Python brain
- [x] Implémenter `gateway/config.go` : struct config immuable, validation

État actuel :
- Le lot `Infra socle` est maintenant matérialisé via une configuration gateway chargée par `viper` avec validation, propagation d'erreurs de bootstrap et mode TLS optionnel dans `antaerus/interfaces/gateway_go/internal/config/config.go`, `antaerus/interfaces/gateway_go/app/bootstrap.go`, `antaerus/engine/bootstrap.go` et `antaerus/interfaces/gateway_go/cmd/gateway/main.go`.
- Le routage REST v1 expose désormais `/health`, `/api/v1/health`, `/api/v1/system/services` et `/api/v1/system/status` dans `antaerus/interfaces/gateway_go/internal/http/routes.go`, avec agrégation extraite dans `antaerus/interfaces/gateway_go/internal/system/health.go`.
- Le canal Rust du gateway suit maintenant la stratégie `gRPC primaire + HTTP secours` via `antaerus/interfaces/gateway_go/internal/clients/engine_runtime_client.go`, en s'appuyant sur `engine_grpc_client.go` et le fallback HTTP existant.
- Le gateway expose maintenant un transport temps réel `GET /api/v1/ws?token=<jwt>` via `antaerus/interfaces/gateway_go/internal/http/websocket.go`, avec hub, goroutine par client, heartbeat `health.heartbeat` et réponses placeholders structurées pour `chat.message`, `voice.*` et `mission.cancel`.
- L'authentification JWT est matérialisée dans `antaerus/interfaces/gateway_go/internal/http/auth.go` pour REST (`Authorization: Bearer`) et WebSocket (query param `token`), avec claims minimaux `sub`, `role`, `iss`, `aud`, `iat`, `exp`.
- Le rate limiting en mémoire HTTP + WebSocket est matérialisé dans `antaerus/interfaces/gateway_go/internal/http/rate_limit.go`, avec limitation des routes HTTP protégées, des handshakes WebSocket et des messages entrants.
- Les dépendances `github.com/gorilla/websocket`, `github.com/golang-jwt/jwt/v5` et `golang.org/x/time` ont été intégrées au module Go du monorepo.
- La validation Go du lot complet `M1.1` a été rejouée avec succès via `go mod tidy` puis `go test ./interfaces/gateway_go/...`.

### M1.2 — Python Brain (LLM + Mémoire basique)
- [x] Implémenter `brain_python/llm/factory.py` : factory LLM (Anthropic, OpenAI, Mistral, Ollama)
- [x] Implémenter `brain_python/llm/api.py` : client API cloud
- [x] Implémenter `brain_python/llm/local.py` : client Ollama local
- [x] Implémenter `brain_python/llm/streaming.py` : streaming SSE vers Go
- [x] Implémenter `brain_python/memory/kernel.py` : SQLite source de vérité
- [x] Implémenter `brain_python/memory/schemas.py` : tables `events`, `facts`, `fact_observations`, `fact_relations`
- [x] Implémenter `brain_python/memory/ingest.py` : extraction facts basique (regex + heuristiques)
- [x] Implémenter `brain_python/memory/mirror.py` : génération Markdown unidirectionnelle
- [x] Implémenter `brain_python/memory/search.py` : recherche textuelle basique
- [x] Exposer FastAPI interne (localhost uniquement) : routes `/llm/`, `/memory/`

État actuel :
- Le service FastAPI `antaerus/providers/brain_python/src/antaerus_brain/app.py` monte désormais les routeurs `health`, `llm` et `memory`, transformant le brain en API interne texte + mémoire exploitable.
- La configuration runtime du brain est étendue dans `antaerus/providers/brain_python/src/antaerus_brain/config.py` avec provider par défaut, clés cloud `SecretStr`, modèles par provider, timeout LLM et chemins mémoire (`antaerus/memory_data/antaerus_memory.db`, `antaerus/memory_data/topics/`).
- Le package `antaerus/providers/brain_python/src/antaerus_brain/llm/` matérialise une factory multi-provider (`anthropic`, `openai`, `mistral`, `ollama`), un client cloud via `litellm`, un client local Ollama via `httpx` et un adaptateur `SSE`.
- Le package `antaerus/providers/brain_python/src/antaerus_brain/memory/` matérialise le noyau SQLite, le schéma `events/facts/fact_observations/fact_relations`, l'ingestion heuristique, la recherche textuelle et le mirror Markdown unidirectionnel.
- Les routes internes exposées couvrent `GET /llm/providers`, `POST /llm/chat`, `POST /llm/stream`, `GET /memory/facts`, `POST /memory/facts`, `POST /memory/ingest` et `POST /memory/mirror`, tandis que `/internal/capabilities` annonce désormais `llm-routing`, `llm-streaming-sse`, `memory-kernel`, `memory-search` et `memory-mirror`.
- La validation du lot `M1.2` a été rejouée avec succès via `python -m mypy src tests`, `python -m pytest tests` et `python -m ruff check .` depuis `antaerus/providers/brain_python/`.

### M1.3 — React + Vite (UI Core)
- [x] Initialiser projet Vite + React + TypeScript
- [x] Configurer Zustand (state management)
- [x] Configurer TanStack Query (cache server state)
- [x] Implémenter `pages/Chat.tsx` : interface conversation principale
- [x] Implémenter `components/MessageBubble.tsx` : bulles message (user / assistant)
- [x] Implémenter `components/MessageInput.tsx` : input avec envoi
- [x] Implémenter `hooks/useWebSocket.ts` : connexion WebSocket Go
- [x] Implémenter `hooks/useChatStream.ts` : streaming tokens SSE
- [x] Implémenter `hooks/useSession.ts` : gestion session ID
- [x] Implémenter `pages/Setup.tsx` : wizard configuration (clés API, identité)
- [x] Implémenter `components/ApiKeyInput.tsx` : input clé API avec masquage
- [x] Configurer build statique pour servir par Go

État actuel :
- `antaerus/interfaces/web/` expose désormais une UI cœur avec routes `Chat`, `Setup` et `FoundationDashboard`, montée via `react-router-dom` dans `src/App.tsx` et `QueryClientProvider` dans `src/main.tsx`.
- L'état métier frontend est matérialisé par `src/store/useAppStore.ts` avec persistance locale navigateur (`src/lib/storage.ts`) pour la configuration `Setup`, les messages, la session active et l'état de connexion.
- Le chat texte principal est matérialisé dans `src/pages/Chat.tsx` avec `MessageBubble`, `MessageInput`, `useSession`, `useWebSocket` et `useChatStream`, en supportant un mode WebSocket Go avec JWT de dev local et un mode `SSE` direct vers `brain_python` pour le développement.
- Le wizard `Setup` est matérialisé dans `src/pages/Setup.tsx` avec `ApiKeyInput`, stockage local des préférences (identité, provider, URLs locales, jeton WebSocket de dev, clés API locales) et aucun envoi serveur dans ce lot.
- `TanStack Query` est intégré pour le cache server state, avec consommation de l'état système Go et des providers du brain quand le mode `sse-dev` est actif.
- La build statique Vite est maintenant explicitement produite dans `antaerus/interfaces/web/dist/`, et le gateway Go sert cette build via `http.FileServer` avec fallback SPA dans `antaerus/interfaces/gateway_go/internal/http/routes.go`.
- La couverture de tests `M1.3` inclut désormais le routage applicatif, `MessageBubble`, `MessageInput`, `ApiKeyInput`, `useSession`, `useWebSocket`, `useChatStream` et le fallback statique Go.
- Les validations ont été rejouées avec succès via `npm run lint`, `npm run check`, `npm run test`, `npm run build` dans `antaerus/interfaces/web/` et `go test ./interfaces/gateway_go/...` dans `antaerus/`.

### M1.4 — Intégration texte
- [x] Connecter React → Go WebSocket → Python LLM → Go → React (streaming)
- [x] Persister historique chat dans SQLite
- [ ] Tester end-to-end : envoi message → réponse LLM → affichage (< 2s)
- [x] Tester multi-session : 2 sessions simultanées, contexte isolé

État actuel :
- Le flux texte intégré est désormais matérialisé entre `antaerus/interfaces/web/src/pages/Chat.tsx`, `antaerus/interfaces/web/src/hooks/useWebSocket.ts`, `antaerus/interfaces/gateway_go/internal/http/websocket.go`, `antaerus/interfaces/gateway_go/internal/clients/brain_chat_client.go` et `antaerus/providers/brain_python/src/antaerus_brain/chat.py`, avec streaming `chat.token` puis `chat.complete`.
- L'historique conversationnel est persisté dans le SQLite du brain via `chat_sessions` et `chat_messages`, exposé par `GET /memory/chat/sessions/{session_id}` côté Python puis `GET /api/v1/chat/sessions/{session_id}` côté Go.
- Le gateway expose aussi `POST /api/v1/auth/dev-token` pour générer un JWT de développement consommé par l'UI `Chat` et `Setup`.
- Les validations automatisées rejouées avec succès sont : `python -m ruff check .`, `python -m mypy src tests`, `python -m pytest tests`, `go test ./interfaces/gateway_go/...`, `npm run lint`, `npm run check`, `npm run test`, `npm run build`.
- Le smoke `M1.4` est maintenant exécutable via `powershell -ExecutionPolicy Bypass -File .\scripts\validation\smoke-text-chat.ps1` et `bash ./scripts/validation/smoke-text-chat.sh`, avec un client Go corrigé pour ne plus importer de package `internal`.
- La preuve end-to-end `< 2s` reste conditionnée à la disponibilité d'un provider LLM local joignable ; dans l'environnement courant, le smoke échoue sur `All connection attempts failed` car l'endpoint Ollama local `http://127.0.0.1:11434` n'est pas disponible.

---

## Phase M2 — Voix temps réel (4 semaines)

### M2.1 — Rust Audio Engine
- [ ] Implémenter `engine_rust/audio/capture.rs` : capture micro via `cpal`
- [ ] Implémenter `engine_rust/audio/vad.rs` : Voice Activity Detection (`silero-vad`)
- [ ] Implémenter `engine_rust/audio/stt.rs` : STT Whisper (`whisper-rs`)
- [ ] Implémenter `engine_rust/audio/tts.rs` : TTS Piper (`piper-rs`)
- [ ] Implémenter `engine_rust/audio/mixer.rs` : mixage audio, gestion barge-in
- [ ] Implémenter `engine_rust/audio/resampler.rs` : resampling format audio
- [ ] Implémenter `engine_rust/protocol/audio.proto` : messages gRPC audio
- [ ] Implémenter `engine_rust/protocol/server.rs` : gRPC server tonic
- [ ] Tester latence Rust : capture → STT → texte (< 200ms)
- [ ] Tester latence Rust : texte → TTS → audio (< 300ms)

### M2.2 — Go ↔ Rust Intégration Voix
- [ ] Implémenter `gateway/grpc_client.go` : client gRPC vers Rust
- [ ] Implémenter `gateway/voice_handler.go` : handler WebSocket voix
- [ ] Implémenter `gateway/voice_session.go` : gestion session voix (partagée avec texte)
- [ ] Implémenter `gateway/voice_proxy.go` : proxy audio Go ↔ Rust ↔ React
- [ ] Tester latence Go ↔ Rust gRPC (< 10ms)
- [ ] Tester latence bout-en-bout : micro → Rust → Go → Python LLM → Go → Rust → haut-parleur (< 1000ms)

### M2.3 — React Voice UI
- [ ] Implémenter `components/VoiceButton.tsx` : bouton micro, états (idle/listening/speaking)
- [ ] Implémenter `components/VoiceVisualizer.tsx` : visualisation onde audio (Web Audio API)
- [ ] Implémenter `components/VoiceTranscript.tsx` : transcription temps réel
- [ ] Implémenter `hooks/useVoiceStream.ts` : gestion stream audio WebSocket
- [ ] Implémenter `hooks/useVAD.ts` : affichage état VAD (speaking/silence)
- [ ] Implémenter barge-in UI : bouton interruption, stop TTS

### M2.4 — Wake Word (optionnel P1)
- [ ] Implémenter détection wake word "aNtaerus" (pattern audio ou model léger)
- [ ] Tester précision wake word (fausses acceptations < 1/jour)
- [ ] Intégrer wake word dans VAD Rust

---

## Phase M3 — Outils (3 semaines)

### M3.1 — Python Tools
- [ ] Implémenter `brain_python/tools/browser.py` : recherche web + scraping
- [ ] Implémenter `brain_python/tools/gmail.py` : OAuth2 + lister/envoyer emails
- [ ] Implémenter `brain_python/tools/calendar.py` : Google Calendar OAuth2
- [ ] Implémenter `brain_python/tools/weather.py` : Open-Meteo API (sans clé)
- [ ] Implémenter `brain_python/tools/vision.py` : capture écran + YOLOv8
- [ ] Implémenter `brain_python/tools/filesystem.py` : lecture fichiers (sandbox)
- [ ] Implémenter `brain_python/tools/memory_tool.py` : écrire notes structurées
- [ ] Implémenter `brain_python/tools/cli.py` : commandes shell whitelistées
- [ ] Créer `config/tools.yaml` : whitelist commandes CLI
- [ ] Implémenter `brain_python/tools/tool_registry.py` : registry dynamique
- [ ] Implémenter `brain_python/tools/tool_schema.py` : génération schémas pour LLM

### M3.2 — Rust Tools (Sandbox)
- [ ] Implémenter `engine_rust/fs/sandbox.rs` : filesystem sandbox (whitelist chemins)
- [ ] Implémenter `engine_rust/fs/reader.rs` : lecture fichier sécurisée
- [ ] Implémenter `engine_rust/cli/sandbox.rs` : exécution commande whitelistée
- [ ] Implémenter `engine_rust/sandbox/wasm.rs` : runtime WASM (`wasmtime`)

### M3.3 — Intégration Tools
- [ ] Connecter tools Python au LLM (function calling)
- [ ] Connecter tools Rust au gate composite (niveau 3+)
- [ ] Tester tool browser : recherche + résumé
- [ ] Tester tool gmail : lecture emails récents
- [ ] Tester tool calendar : création événement
- [ ] Tester tool vision : capture + détection objets

---

## Phase M4 — Mission Engine (3 semaines)

### M4.1 — Mission Engine Core
- [ ] Implémenter `brain_python/mission/engine.py` : décomposition demande en étapes
- [ ] Implémenter `brain_python/mission/verifier.py` : vérification structurale (syntaxe plan)
- [ ] Implémenter `brain_python/mission/semantic_verifier.py` : vérification sémantique (cohérence)
- [ ] Implémenter `brain_python/mission/orchestrator.py` : exécution étape par étape
- [ ] Implémenter `brain_python/mission/reflexion.py` : réflexion post-mission
- [ ] Implémenter `brain_python/mission/state.py` : persistance état mission (SQLite)
- [ ] Implémenter `brain_python/mission/recovery.py` : reprise après crash (idempotence)

### M4.2 — Go Mission Proxy
- [ ] Implémenter `gateway/mission_handler.go` : routes REST missions
- [ ] Implémenter `gateway/mission_proxy.go` : proxy vers Python mission engine
- [ ] Implémenter `gateway/mission_ws.go` : push WebSocket progression mission

### M4.3 — React Mission UI
- [ ] Implémenter `pages/Missions.tsx` : liste missions en cours
- [ ] Implémenter `components/MissionCard.tsx` : carte mission (état, étapes, progression)
- [ ] Implémenter `components/MissionStep.tsx` : étape individuelle (pending/active/done/failed)
- [ ] Implémenter `hooks/useMissions.ts` : gestion missions temps réel

---

## Phase M5 — Moteur Proactif (3 semaines)

### M5.1 — Collecteurs
- [ ] Implémenter `brain_python/proactive/collectors/weather.py` : briefing météo + alertes
- [ ] Implémenter `brain_python/proactive/collectors/news.py` : digest RSS
- [ ] Implémenter `brain_python/proactive/collectors/calendar.py` : rappels calendrier
- [ ] Implémenter `brain_python/proactive/collectors/system.py` : alertes système (CPU, disque)
- [ ] Implémenter `brain_python/proactive/collectors/custom.py` : collecteur générique configurable

### M5.2 — Command Center
- [ ] Implémenter `brain_python/proactive/command_center.py` : vue unifiée initiatives
- [ ] Implémenter `gateway/proactive_handler.go` : routes REST proactif
- [ ] Implémenter `pages/CommandCenter.tsx` : dashboard initiatives (React)
- [ ] Implémenter `components/InitiativeCard.tsx` : carte initiative (autonomie, budget, état)
- [ ] Implémenter `components/AutonomySlider.tsx` : contrôle niveau autonomie 0-5

### M5.3 — Curator Nocturne
- [ ] Implémenter `brain_python/proactive/curator.py` : job maintenance nocturne
- [ ] Générer rapport : facts ajoutés/contradictoires, skills inutilisées, coûts
- [ ] Proposer patches (validation humaine pour niveau ≥ 3)
- [ ] Planifier via Go scheduler (cron interne)

---

## Phase M6 — Polish UI & Bundle (3 semaines)

### M6.1 — UI Complète
- [ ] Implémenter `pages/MemoryExplorer.tsx` : navigation facts, recherche, graphe relations
- [ ] Implémenter `components/FactCard.tsx` : carte fact (sujet, prédicat, objet, confiance)
- [ ] Implémenter `components/FactGraph.tsx` : graphe relations facts (vis.js ou D3)
- [ ] Implémenter `pages/Analytics.tsx` : métriques usage (tokens, latence, coûts)
- [ ] Implémenter `components/MetricsChart.tsx` : graphiques Recharts (latence, throughput)
- [ ] Implémenter `pages/SystemHealth.tsx` : état services (Go, Rust, Python), logs, restart
- [ ] Implémenter `components/ServiceStatus.tsx` : indicateur status par service
- [ ] Implémenter `pages/Config.tsx` : modification configuration (sans mutation runtime)
- [ ] Implémenter `components/ConfigForm.tsx` : formulaire config typé

### M6.2 — Setup & Onboarding
- [ ] Finaliser `pages/Setup.tsx` : wizard complet (identité, clés API, modules, photo ref)
- [ ] Implémenter upload photo référence (reconnaissance faciale future)
- [ ] Implémenter validation clés API (test call à chaque fournisseur)
- [ ] Implémenter détection port occupé + auto-port
- [x] Créer `.env.example` documenté

### M6.3 — Bundle & Distribution
- [ ] Écrire `scripts/release/build_bundle.ps1` (Windows)
- [ ] Écrire `scripts/release/build_bundle.sh` (Linux/macOS)
- [ ] Télécharger Python 3.11 relocalisable dans `bundle/python`
- [ ] Créer venv dans `bundle/.venv`
- [ ] Télécharger modèles : Whisper, Piper, YOLOv8
- [ ] Compiler Go binaires statiques (`go build -ldflags="-s -w"`)
- [ ] Compiler Rust binaires statiques (`cargo build --release`)
- [ ] Créer `manifest.json` (version, checksums)
- [ ] Tester bundle froid (machine vierge, pas de Python installé)
- [ ] Tester bundle relocalisable (chemins relatifs uniquement)

---

## Phase M7 — Skill Lab (4 semaines)

### M7.1 — Skill Registry
- [ ] Implémenter `brain_python/skills/registry.py` : registry skills installés
- [ ] Implémenter `brain_python/skills/lifecycle.py` : install/update/uninstall
- [ ] Implémenter `gateway/skills_handler.go` : routes REST skills

### M7.2 — Skill Lab UI
- [ ] Implémenter `pages/SkillLab.tsx` : interface création/test skills
- [ ] Implémenter `components/SkillEditor.tsx` : éditeur code (CodeMirror)
- [ ] Implémenter `components/SkillTester.tsx` : bouton "Test dans sandbox"
- [ ] Implémenter `components/SkillMarketplace.tsx` : liste skills disponibles

### M7.3 — Sandbox
- [ ] Implémenter `engine_rust/sandbox/wasm.rs` : compilation skill → WASM
- [ ] Implémenter `engine_rust/sandbox/executor.rs` : exécution WASM (`wasmtime`)
- [ ] Implémenter `brain_python/skills/docker_sandbox.py` : sandbox Docker (tests Python)
- [ ] Implémenter `brain_python/skills/synthesizer.py` : génération skill depuis usage
- [ ] Implémenter validation humaine : workflow React (approve/reject)

---

## Phase M8 — Domotique (3 semaines)

### M8.1 — MQTT & Home Assistant
- [ ] Implémenter `gateway/mqtt_client.go` : client MQTT (paho)
- [ ] Implémenter `gateway/mqtt_discovery.go` : découverte appareils (mDNS)
- [ ] Implémenter `brain_python/tools/domotic.py` : tool domotique (Home Assistant API)
- [ ] Implémenter `brain_python/proactive/collectors/domotic.py` : collecteur état maison

### M8.2 — React Domotique UI
- [ ] Implémenter `components/DomoticTile.tsx` : tuile appareil (lumière, prise, thermostat)
- [ ] Implémenter `components/DomoticScene.tsx` : scènes ("Mode cinéma", "Dodo")
- [ ] Implémenter `pages/Domotic.tsx` : dashboard domotique complet

---

## Phase M9 — Release (2 semaines)

### M9.1 — Tests & Qualité
- [ ] Suite unitaire : > 80% couverture
- [ ] Tests intégration : 30+ scénarios (chat, voix, mission, tool)
- [ ] Tests charge : 10k connexions WebSocket simultanées
- [ ] Tests latence : voix < 1000ms, parsing Rust 1M msg/s
- [ ] Tests sécurité : secrets jamais dans logs, chiffrement OK
- [ ] Tests bundle : installation froid Windows, Linux, macOS
- [ ] Audit import-linter : 0 violation couches
- [ ] Audit mypy : 0 erreur kernel

### M9.2 — Documentation
- [ ] `README.md` : présentation, installation, démarrage rapide
- [ ] `docs/architecture/CDC.md` : contrat de développement complet
- [ ] `docs/architecture/EVENTS.md` : bus d'événements, messages
- [ ] `docs/architecture/API.md` : spécification API REST + WebSocket
- [ ] `docs/architecture/GRPC.md` : spécification gRPC Go ↔ Rust
- [ ] `docs/security/SECRETS.md` : gestion secrets, chiffrement
- [ ] `docs/security/GOVERNANCE.md` : gate composite, autonomie
- [ ] `docs/development/SETUP.md` : environnement développeur
- [ ] `docs/development/TESTS.md` : guide tests
- [ ] `docs/user/INSTALL.md` : guide installation utilisateur final
- [ ] `docs/user/COMMANDS.md` : référence commandes CLI
- [ ] `docs/user/TELEGRAM.md` : configuration bot Telegram
- [ ] `CHANGELOG.md` : version 1.0.0

### M9.3 — Release
- [ ] Tag Git `v1.0.0`
- [ ] Créer release GitHub avec bundle Windows
- [ ] Créer release GitHub avec bundle Linux
- [ ] Créer release GitHub avec bundle macOS
- [ ] Publier Docker image (`docker pull antaerus/antaerus`)
- [ ] Annonce (Twitter, Reddit, Hacker News, Discord)

---

## Tâches Transversales (tout au long du projet)

### Documentation continue
- [ ] Documenter chaque module au fur et à mesure (docstrings, comments)
- [ ] Maintenir `docs/migration/BACKLOG.md` (dettes techniques)
- [ ] Maintenir `CHANGELOG.md` (à chaque PR)

### Sécurité continue
- [ ] Réviser gate composite à chaque nouvel outil
- [ ] Vérifier `test_secrets_no_leak` à chaque ajout de clé API
- [ ] Auditer les dépendances (`cargo audit`, `pip-audit`, `govulncheck`)
- [ ] Vérifier pas de fuite mémoire Rust (valgrind, miri)
- [ ] Vérifier pas de data race Go (`go test -race`)

### Performance continue
- [ ] Benchmark Rust parsing à chaque modification
- [ ] Benchmark Go WebSocket à chaque modification
- [ ] Profiler Python LLM calls (mémoire, latence)
- [ ] Optimiser bundle taille (strip binaires, compression modèles)

### Community (futur)
- [ ] Créer Discord server
- [ ] Créer GitHub Discussions
- [ ] Rédiger CONTRIBUTING.md
- [ ] Rédiger CODE_OF_CONDUCT.md
- [ ] Choisir licence (MIT / Apache 2.0 / dual)

---

## Résumé par phase

| Phase | Semaines | Tâches clés | Livrable |
|-------|----------|-------------|----------|
| M0 | 3 | Architecture, CI/CD, bootstrap, gRPC, sécurité | Squelette compilable, tests passent |
| M1 | 3 | Go gateway, Python LLM, React chat, mémoire basique | Chat texte fonctionnel |
| M2 | 4 | Rust audio, gRPC voix, React voice UI, wake word | **Voix temps réel < 1000ms** |
| M3 | 3 | Tools Python/Rust, registry, function calling | 8+ outils fonctionnels |
| M4 | 3 | Mission Engine, vérification, recovery, UI | Missions complexes exécutables |
| M5 | 3 | Collecteurs, Command Center, Curator, autonomie | Proactif gouverné |
| M6 | 3 | UI complète, analytics, system health, bundle | Dashboard complet, bundle testé |
| M7 | 4 | Skill Lab, WASM sandbox, Docker sandbox, marketplace | Extensions utilisateur |
| M8 | 3 | MQTT, Home Assistant, domotique UI | Contrôle maison |
| M9 | 2 | Tests, doc, release, bundles | **v1.0.0** |

---

**Total : ~200+ tâches détaillées sur 7-8 mois**


75 507 90 60
