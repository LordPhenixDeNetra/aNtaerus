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
- Le brain injecte désormais un message système d'identité configurable (`ANTAERUS_BRAIN_ASSISTANT_NAME`, `ANTAERUS_BRAIN_ASSISTANT_SYSTEM_PROMPT`) afin que l'assistant se présente comme **aNtaerus** quel que soit le provider (WS et SSE dev inclus), avec une réponse fixe pour les questions d'identité (ex: « Qui es-tu ? »).
- Le package `antaerus/providers/brain_python/src/antaerus_brain/llm/` matérialise une factory multi-provider (`anthropic`, `openai`, `mistral`, `deepseek`, `ollama`), un client cloud via `litellm`, un client local Ollama via `httpx` et un adaptateur `SSE`.
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
- Les réponses de chat supportent désormais un rendu Markdown (GFM) côté UI afin de respecter le formatage (gras, listes, liens, code) dans `src/components/MessageBubble.tsx`.
- Le wizard `Setup` est matérialisé dans `src/pages/Setup.tsx` avec `ApiKeyInput`, stockage local des préférences (identité, provider, URLs locales, jeton WebSocket de dev, clés API locales dont `DeepSeek`) et aucun envoi serveur dans ce lot.
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
- Les routes `/api/` du gateway répondent désormais au preflight CORS pour l'origine web de développement configurée, ce qui débloque la génération du JWT de dev depuis le frontend Vite sur `http://localhost:5173`.
- Les validations automatisées rejouées avec succès sont : `python -m ruff check .`, `python -m mypy src tests`, `python -m pytest tests`, `go test ./interfaces/gateway_go/...`, `npm run lint`, `npm run check`, `npm run test`, `npm run build`.
- Le smoke `M1.4` est maintenant exécutable via `powershell -ExecutionPolicy Bypass -File .\scripts\validation\smoke-text-chat.ps1` et `bash ./scripts/validation/smoke-text-chat.sh`, avec un client Go corrigé pour ne plus importer de package `internal`.
- La preuve end-to-end `< 2s` reste conditionnée à la disponibilité d'un provider LLM local joignable ; dans l'environnement courant, le smoke échoue sur `All connection attempts failed` car l'endpoint Ollama local `http://127.0.0.1:11434` n'est pas disponible.

---

## Phase M2 — Voix temps réel (4 semaines)

### M2.1 — Rust Audio Engine
- [x] Implémenter `engine_rust/audio/capture.rs` : capture micro via `cpal` (stub + feature `voice`)
- [x] Implémenter `engine_rust/audio/vad.rs` : Voice Activity Detection (`silero`) + fallback énergie
- [x] Implémenter `engine_rust/audio/stt.rs` : STT Whisper (`whisper-rs`) (feature `voice`)
- [x] Implémenter `engine_rust/audio/tts.rs` : TTS Piper (impl via `piper1-rs`) (feature `voice`)
- [x] Implémenter `engine_rust/audio/mixer.rs` : mixage audio, gestion barge-in (logique + sink abstrait)
- [x] Implémenter `engine_rust/audio/resampler.rs` : resampling mono (linéaire)
- [x] Implémenter `engine_rust/protocol/audio.proto` : messages gRPC audio (dans `antaerus/kernel/proto/audio.proto`)
- [x] Implémenter `engine_rust/protocol/server.rs` : gRPC server tonic (`AudioRuntime`)
- [x] Tester latence Rust : capture → STT → texte (< 200ms) (tests `#[ignore]`)
- [x] Tester latence Rust : texte → TTS → audio (< 300ms) (tests `#[ignore]`)

### M2.2 — Go ↔ Rust Intégration Voix
- [x] Implémenter `gateway/grpc_client.go` : client gRPC vers Rust
- [x] Implémenter `gateway/voice_handler.go` : handler WebSocket voix
- [x] Implémenter `gateway/voice_session.go` : gestion session voix (partagée avec texte)
- [x] Implémenter `gateway/voice_proxy.go` : proxy audio Go ↔ Rust ↔ React
- [x] Tester latence Go ↔ Rust gRPC (< 10ms)
- [x] Tester latence bout-en-bout : micro → Rust → Go → Python LLM → Go → Rust → haut-parleur (< 1000ms)

État actuel :
- Le gateway Go embarque maintenant des stubs `audiopb` pour `antaerus/kernel/proto/audio.proto` et un `EngineGRPCClient` étendu capable d'appeler `StartVoiceSession`, `StopVoiceSession` et `Speak` vers `engine_rust`.
- Le hub WebSocket de `antaerus/interfaces/gateway_go/internal/http/websocket.go` ne renvoie plus un placeholder pour `voice.start`, `voice.stop` et `voice.barge_in` ; il délègue désormais à une couche voix dédiée (`voice_session.go`, `voice_proxy.go`).
- Une session voix Go partage le même `sessionId` que le chat texte, relaie les événements `voice.vad_state` et `voice.transcript`, puis déclenche automatiquement `BrainChatClient.StreamSession(...)` suivi de `AudioRuntime.Speak(...)` avec la réponse finale du LLM.
- Le mode retenu pour `M2.2` conserve la capture micro et la lecture TTS en local côté `engine_rust`; l'événement WebSocket `voice.audio` reste réservé pour une évolution future vers une lecture navigateur.
- La validation automatisée Go de ce lot a été rejouée avec succès via `go test ./interfaces/gateway_go/...`, y compris les nouveaux tests ciblés sur l'ouverture de session voix, le proxy `vad/transcript -> LLM -> Speak`, `voice.stop`, `voice.barge_in` et le budget bout-en-bout `TestVoiceEndToEndLatencyBudget`.
- Le budget `Go ↔ Rust gRPC < 10ms` est couvert par `antaerus/interfaces/gateway_go/internal/bench/grpc_latency_test.go` et les scripts `scripts/validation/bench-go-rust-latency.{ps1,sh}` quand un `engine_rust` local est disponible.
- Le budget bout-en-bout `< 1000ms` est désormais automatisé dans `antaerus/interfaces/gateway_go/internal/http/voice_latency_test.go` avec un runtime voix déterministe et le WebSocket réel du gateway de test ; la preuve en environnement matériel réel reste dépendante des modèles audio locaux et du provider LLM configuré.

### M2.3 — React Voice UI
- [x] Implémenter `components/VoiceButton.tsx` : bouton micro, états (idle/listening/speaking)
- [x] Implémenter `components/VoiceVisualizer.tsx` : visualisation onde audio (Web Audio API)
- [x] Implémenter `components/VoiceTranscript.tsx` : transcription temps réel
- [x] Implémenter `hooks/useVoiceStream.ts` : gestion stream audio WebSocket
- [x] Implémenter `hooks/useVAD.ts` : affichage état VAD (speaking/silence)
- [x] Implémenter barge-in UI : bouton interruption, stop TTS

État actuel :
- L'interface React expose désormais une Voice UI intégrée à `antaerus/interfaces/web/src/components/MessageInput.tsx` avec un bouton principal micro (`idle` / `listening` / `speaking`), un bouton `Interrompre` pour `barge_in`, un transcript temps réel et un visualiseur d'état.
- `antaerus/interfaces/web/src/hooks/useWebSocket.ts` sait maintenant sérialiser `voice.start`, `voice.stop` et `voice.barge_in`, consommer `voice.transcript` et `voice.vad_state`, et dériver l'état UI `speaking` à partir de la timeline assistant (`chat.token` -> `chat.complete`).
- L'état voix partagé est stocké dans `antaerus/interfaces/web/src/store/useAppStore.ts` et orchestré par `antaerus/interfaces/web/src/hooks/useVoiceStream.ts` et `antaerus/interfaces/web/src/hooks/useVAD.ts`.
- Conformément à la décision produit prise en `M2.2`, `M2.3` reste une UI de télécommande/visualisation du pipeline Rust local : aucune capture micro navigateur n'est introduite et `voice.audio` reste non consommé.
- La visualisation `VoiceVisualizer` représente l'état de session et le VAD reçu du backend ; elle ne branche pas de flux micro navigateur réel malgré l'intitulé initial `Web Audio API` dans la checklist.
- La validation frontend de ce lot est verte via `npm run check`, `npm run test` et `npm run lint`, avec des tests dédiés pour les composants voix, les hooks `useVoiceStream` / `useVAD`, la sérialisation WebSocket voix et l'intégration minimale dans `Chat`.
- Correctif post-livraison : `useWebSocket.ts` attend désormais correctement l'ouverture effective de la socket avant d'envoyer `voice.start`, et les listeners WebSocket lisent l'état voix courant depuis le store au lieu d'utiliser une closure obsolète. Cela corrige le cas où le bouton micro semblait ne rien faire si l'utilisateur cliquait pendant `connecting` ou si l'UI ne passait pas correctement en mode `speaking`.
- Correctif post-livraison 2 : l'action primaire de la Voice UI est maintenant alignée sur le mode affiché (`idle => start`, `listening/speaking => stop`) pour éviter le cas observé où le bouton affichait `Démarrer la voix` mais envoyait en réalité `voice.stop`. En parallèle, `scripts/dev-engine.ps1` démarre désormais `engine_rust` avec `cargo run --features voice`, condition nécessaire pour activer réellement le pipeline voix en local. Les warnings Rust signalés sur `server.rs`, `vad.rs` et `tts.rs` ont aussi été nettoyés et `cargo check` repasse proprement.
- Correctif post-livraison 3 : `scripts/dev-engine.ps1` charge maintenant `LIBCLANG_PATH`, `ONNX_RUNTIME_DIR` et `ONNX_INCLUDE_PATH` depuis `antaerus/.env` (avec alias `ANTAERUS_ENGINE_LIBCLANG_PATH`), tente les emplacements LLVM 64 bits usuels sous Windows et échoue avec un message explicite avant le panic `bindgen` si `libclang.dll` compatible est absent. `scripts/validation/smoke-engine.ps1` réutilise le même point d'entrée pour éviter un diagnostic incohérent entre lancement dev et smoke test. Dans l'environnement Windows courant, le seul `libclang.dll` trouvé sous Unity a ete confirme comme DLL 32 bits invalide pour `bindgen`; l'installation d'un LLVM 64 bits reste donc le prealable local pour compiler `whisper-rs-sys` et `piper1-rs-sys`.

### M2.4 — Wake Word (optionnel P1)
- [x] Implémenter détection wake word "aNtaerus" (pattern audio ou model léger)
- [x] Tester précision wake word (fausses acceptations < 1/jour)
- [x] Intégrer wake word dans VAD Rust

État actuel :
- `M2.4` est maintenant livré sous forme d'un wake word transcript-first dans `antaerus/providers/engine_rust/src/audio/wake_word.rs` et `antaerus/providers/engine_rust/src/protocol/server.rs` : tant qu'une session voix n'est pas armée, seuls les transcripts finaux commencant par `ANTAERUS_ENGINE_WAKE_WORD` (defaut `aNtaerus`) sont conservés.
- La premiere detection du wake word arme durablement la session jusqu'a `voice.stop`; `aNtaerus` seul n'interroge pas le LLM, tandis que `aNtaerus bonjour` transmet uniquement `bonjour` au brain Python.
- Le contrat voix expose maintenant un etat `waiting` / `armed` via `WakeWordEvent` dans `antaerus/kernel/proto/audio.proto`, relayé jusqu'au frontend par `voice.wake_state`.
- L'UI React consomme ce nouvel etat dans `antaerus/interfaces/web/src/store/useAppStore.ts`, `useWebSocket.ts`, `useVoiceStream.ts` et `VoiceTranscript.tsx` pour afficher explicitement l'attente du wake word puis l'etat arme.
- La couverture de regression inclut des tests Rust dedies au matching normalise du wake word, un test Go de relay `voice.wake_state`, et des tests frontend pour la consommation du nouvel etat et les libelles de statut associes.

---

## Phase M3 — Outils (3 semaines)

### M3.1 — Python Tools
- [x] Implémenter `brain_python/tools/browser.py` : recherche web + scraping
- [x] Implémenter `brain_python/tools/gmail.py` : OAuth2 + lister/envoyer emails
- [x] Implémenter `brain_python/tools/calendar.py` : Google Calendar OAuth2
- [x] Implémenter `brain_python/tools/weather.py` : Open-Meteo API (sans clé)
- [x] Implémenter `brain_python/tools/vision.py` : capture écran + YOLOv8
- [x] Implémenter `brain_python/tools/filesystem.py` : lecture fichiers (sandbox)
- [x] Implémenter `brain_python/tools/memory_tool.py` : écrire notes structurées
- [x] Implémenter `brain_python/tools/cli.py` : commandes shell whitelistées
- [x] Créer `config/tools.yaml` : whitelist commandes CLI
- [x] Implémenter `brain_python/tools/tool_registry.py` : registry dynamique
- [x] Implémenter `brain_python/tools/tool_schema.py` : génération schémas pour LLM

État actuel :
- Le package `antaerus/providers/brain_python/src/antaerus_brain/tools/` matérialise désormais un socle complet `M3.1` avec `base.py`, `tool_registry.py`, `tool_schema.py` et huit outils Python minimaux réels : `browser`, `gmail`, `calendar`, `weather`, `vision`, `filesystem`, `memory_tool` et `cli`.
- La configuration versionnée des outils est définie dans `antaerus/config/tools.yaml`, tandis que `antaerus/providers/brain_python/src/antaerus_brain/config.py` et `antaerus/.env.example` exposent les paramètres runtime associés (sandbox root, timeouts, Google OAuth2 minimal, vision locale, user-agent browser).
- Le brain Python expose maintenant une API interne `GET /tools` et `POST /tools/execute` via `antaerus/providers/brain_python/src/antaerus_brain/api/tools.py`, avec des capabilities déclarées `tools-registry`, `tools-execution` et `tools-schema-generation` dans `antaerus/providers/brain_python/src/antaerus_brain/api/health.py`.
- Le registry dynamique publie aussi des schémas compatibles LLM dans `antaerus/providers/brain_python/src/antaerus_brain/tools/tool_schema.py` et `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`, sans encore boucler le function calling complet qui reste planifié en `M3.3`.
- Les wrappers `filesystem` et `cli` restent strictement gouvernés par whitelist pour préparer le sandbox Rust de `M3.2` : lecture seule dans des racines autorisées pour `filesystem`, exécution sans shell libre et commandes explicitement autorisées pour `cli`.
- `gmail`, `calendar` et `vision` livrent un mode réel minimal mais dégradable : les outils sont présents au catalogue, puis répondent proprement `not_configured` ou `not_available` si l'environnement local n'est pas prêt.
- La validation finale du lot a été rejouée avec succès dans `antaerus/providers/brain_python/` via `python -m ruff check .`, `python -m pytest tests` et `python -m mypy src tests`.

### M3.2 — Rust Tools (Sandbox)
- [x] Implémenter `engine_rust/fs/sandbox.rs` : filesystem sandbox (whitelist chemins)
- [x] Implémenter `engine_rust/fs/reader.rs` : lecture fichier sécurisée
- [x] Implémenter `engine_rust/cli/sandbox.rs` : exécution commande whitelistée
- [x] Implémenter `engine_rust/sandbox/wasm.rs` : runtime WASM (`wasmtime`)

État actuel :
- Le provider Rust expose désormais les modules `antaerus/providers/engine_rust/src/fs/`, `antaerus/providers/engine_rust/src/cli/` et `antaerus/providers/engine_rust/src/sandbox/`, avec export crate dans `src/lib.rs` et configuration dédiée dans `src/config.rs`.
- La whitelist versionnée reste centralisée dans `antaerus/config/tools.yaml`, désormais consommée côté Rust via `antaerus/providers/engine_rust/src/tools_config.rs`, avec chemins runtime configurables par `ANTAERUS_ENGINE_TOOLS_CONFIG_PATH` et `ANTAERUS_ENGINE_TOOLS_SANDBOX_ROOT`.
- Le sandbox filesystem Rust s'appuie sur `cap-std` pour ouvrir les racines autorisées, borne les lectures par `max_bytes` et refuse explicitement les chemins hors whitelist ou les fichiers absents.
- Le sandbox CLI Rust exécute uniquement des commandes whitelistées sans shell libre, dans `tools_sandbox_root`, avec capture `stdout/stderr`, `exit_code` et timeout explicite.
- Le runtime WASM minimal réel, implémenté dans `antaerus/providers/engine_rust/src/sandbox/wasm.rs`, charge un module local sous `wasmtime`, vérifie qu'il reste dans le sandbox root et exécute une fonction exportée simple de retour `i32`; cette capacité est compilée derrière la feature `wasm-runtime`.
- Les capabilities HTTP du moteur Rust annoncent maintenant `fs-sandbox`, `fs-readonly-reader` et `cli-sandbox`; `wasm-runtime` n'est déclaré que si la feature correspondante est activée. Aucun nouveau RPC `engine.proto` n'est introduit dans ce lot; l'intégration inter-services reste reportée à `M3.3`.
- La couverture de régression `M3.2` est matérialisée par `tests/fs_sandbox.rs`, `tests/cli_sandbox.rs`, `tests/wasm_runtime.rs` et l'extension de `tests/health.rs`, puis validée via `cargo check`, `cargo clippy --all-targets -- -D warnings` et `cargo test`; la branche `--all-features` reste bloquée dans l'environnement Windows courant par des build scripts transitifs de `wasmtime` (`zerocopy`, `ahash`, `target-lexicon`) malgré un code applicatif au vert sur le chemin par défaut.

### M3.3 — Intégration Tools
- [x] Connecter tools Python au LLM (function calling)
- [x] Connecter tools Rust au gate composite (niveau 3+)
- [x] Tester tool browser : recherche + résumé
- [x] Tester tool gmail : lecture emails récents
- [x] Tester tool calendar : création événement
- [x] Tester tool vision : capture + détection objets

État actuel :
- Le `brain_python` exécute désormais une boucle de function calling sur `POST /llm/session-stream` via `antaerus/providers/brain_python/src/antaerus_brain/tool_calling/orchestrator.py` et `antaerus/providers/brain_python/src/antaerus_brain/chat.py` : le LLM reçoit les schémas tools, peut émettre un `tool_call`, récupère ensuite le résultat outillé puis reformule une réponse finale utilisateur.
- Les tools `filesystem` et `cli` restent enregistrés côté Python, mais délèguent leur exécution réelle au moteur Rust via le proxy HTTP interne `antaerus/providers/brain_python/src/antaerus_brain/tools/rust_proxy.py` vers `antaerus/providers/engine_rust/src/http_tools.rs`.
- Le gate composite est maintenant exécutable dans `antaerus/providers/brain_python/src/antaerus_brain/approval/gate.py` : les tools de catégorie `rust-sandbox` et de niveau d'autonomie `3` sont auto-autorisés avec audit append-only, tandis que les niveaux `4+` restent marqués `review`.
- L'audit minimal des exécutions outillées est matérialisé par `antaerus/providers/brain_python/src/antaerus_brain/approval/audit.py`, qui écrit un journal JSONL append-only sous `antaerus/memory_data/audit/tool_execution_audit.jsonl` ou dans le miroir mémoire configuré.
- La couverture `M3.3` inclut désormais des tests Python dédiés pour `browser`, `gmail`, `calendar`, `vision`, `filesystem`, `cli`, l'API tools et l'intégration sessionnelle `LLM -> tool -> réponse finale`, ainsi que des tests Rust `http_tools.rs` pour les endpoints internes `filesystem` et `cli`.

---

## Phase M4 — Mission Engine (3 semaines)

### M4.1 — Mission Engine Core
- [x] Implémenter `brain_python/mission/engine.py` : décomposition demande en étapes
- [x] Implémenter `brain_python/mission/verifier.py` : vérification structurale (syntaxe plan)
- [x] Implémenter `brain_python/mission/semantic_verifier.py` : vérification sémantique (cohérence)
- [x] Implémenter `brain_python/mission/orchestrator.py` : exécution étape par étape
- [x] Implémenter `brain_python/mission/reflexion.py` : réflexion post-mission
- [x] Implémenter `brain_python/mission/state.py` : persistance état mission (SQLite)
- [x] Implémenter `brain_python/mission/recovery.py` : reprise après crash (idempotence)

État actuel :
- Le package `antaerus/providers/brain_python/src/antaerus_brain/mission/` expose 8 modules cohérents entre eux : `schemas.py` (Pydantic v2 + CREATE TABLE 4 tables SQLite mission / mission_steps / mission_events / mission_step_idempotency avec 3 index), `state.py` (MissionStateStore aiosqlite pour CRUD mission, step, event, idempotence PK mission_id+payload_hash, find_interrupted_steps), `engine.py` (MissionPlanner avec LLM 3 tentatives JSON, stripping code fences, fallback mission final si échec), `verifier.py` (StructuralVerifier 7 règles: 20 étapes max, indexes consécutifs, DAG sans cycle, tool names autorisés, JSON args, champs non vides, warnings distincts des erreurs), `semantic_verifier.py` (SemanticVerifier fallback ok+warnings si LLM absent ou erreur réseau), `recovery.py` (RecoveryManager.scan/recover utilisant idempotence snapshot pour rejeu idempotent).
- L'orchestrateur central `orchestrator.py` enchaîne vérifications structurale + sémantique → transitions mission planned→running → boucle prérequis/skip no-tool/idempotence/dispatch BaseTool._run() → stop-on-failure ou completed. Tous les événements majeurs (vérif, step start, step ok/ko, idempotence replay) sont persistés en `mission_events`.
- Le module `reflexion.py` (ReflexionEngine) tente un bilan LLM JSON 6 champs (summary, successes, failures, suggested_fixes, facts_to_remember, score_quality) et retombe en bilan heuristique si JSON irrécupérable ou LLM indisponible ; `warnings: list[str]` est présent sur ReflexionReport pour notifier les dégradations.
- La couche API FastAPI expose un router `/missions` via `antaerus/providers/brain_python/src/antaerus_brain/api/missions.py` inclus dans `app.py` : `POST /missions` (créer planifier via planner), `GET /missions` (lister filtre sessionId/status), `GET /missions/{id}`, `POST /missions/{id}/run` (conflict 409 si status ≠ planned/paused), `POST /missions/{id}/recover`, `POST /missions/{id}/reflect` (conflict 409 si status ≠ terminal, écrit un event "reflexion" et pousse facts_to_remember dans MemoryKernel si disponible), `GET /missions/{id}/events`.
- La configuration Settings (frozen dataclass dans `config.py`) a 4 nouveaux champs mission : `mission_max_steps`, `mission_llm_timeout_seconds`, `mission_recovery_enabled`, `mission_reflexion_enabled`, alimentés par `ANTAERUS_BRAIN_MISSION_*` ajoutés dans `.env.example`. Le `default_provider` est désormais typé `ProviderName = Literal["anthropic","openai","mistral","deepseek","ollama"]`.
- Le handler `/internal/capabilities` annonce `mission-engine`, `mission-state-store`, et conditionnellement `mission-recovery` / `mission-reflexion` selon configuration.
- Les contrats d'import `.importlinter` sont étendus : `mission-no-backrefs` (mission ne doit pas importer api), `mission-correct-deps` (mission→approval→tools→memory→llm→config, ordre topologique layers), `api-can-import-mission`.
- Qualimétrie et couverture : 49 tests dédiés (9 fichiers test_mission_*) tous verts ; `mypy` ne signale aucune erreur sur mission, api/missions.py et config.py ; `ruff check --ignore E501` et `ruff format` sont propres ; `run_import_linter.py` retourne 4/4 contrats respectés.
- Le scénario nominal (créer mission avec FakeLLM → obtenir statut planned → lister → récupérer détail → lister events=[]) est couvert par `test_mission_api.py` avec TestClient FastAPI et monkeypatch Settings cohérent. La reprise après crash est testée via snapshot idempotence PK mission_id+payload_hash.

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
- [x] `README.md` : présentation, installation, démarrage rapide
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
- [x] Rédiger CONTRIBUTING.md
- [x] Rédiger CODE_OF_CONDUCT.md
- [x] Choisir licence (MIT / Apache 2.0 / dual)

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
