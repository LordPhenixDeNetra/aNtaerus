# Contrats De Fondation

Les contrats de cette phase définissent trois objets JSON partagés :

- `service-health.schema.json` : santé d'un service individuel
- `service-capabilities.schema.json` : capacités déclarées d'un service
- `system-status.schema.json` : agrégation retournée par le gateway
- `websocket-client-message.schema.json` : messages client → gateway
- `websocket-server-message.schema.json` : messages gateway → client
- `kernel/proto/engine.proto` : contrat Protobuf fondation Go ↔ Rust
- `kernel/proto/audio.proto` : contrat Protobuf voix Go ↔ Rust

## Principes

- les réponses sont sérialisées en JSON
- la source de vérité du dashboard est le `gateway_go`
- `brain_python` et `engine_rust` exposent leurs états et capacités via HTTP
- le frontend ne contacte pas directement Python ou Rust
- les protos gRPC partagés restent sous `kernel/proto/`
- les stubs Go sont commités sous `interfaces/gateway_go/internal/gen/enginepb/` et `interfaces/gateway_go/internal/gen/audiopb/`
- le provider Rust consomme des stubs serveur sous `providers/engine_rust/src/gen/`

## Services Référencés

- `web`
- `gateway_go`
- `brain_python`
- `engine_rust`

## Contrats HTTP Internes

Le service `brain_python` expose des routes HTTP internes consommées par le reste du système pour le texte, la mémoire et, depuis `M3.1`, le catalogue d'outils.

### Capabilities `brain_python`

Le endpoint `GET /internal/capabilities` publie désormais notamment :

- `llm-routing`
- `llm-streaming-sse`
- `memory-kernel`
- `memory-search`
- `memory-mirror`
- `tools-registry`
- `tools-execution`
- `tools-schema-generation`

### API `tools`

Le lot `M3.1` ajoute une API interne minimale pour les outils Python :

- `GET /tools` : retourne le catalogue des outils, leur schéma d'entrée, leur niveau de risque et leur état `enabled` / `available`
- `POST /tools/execute` : exécute un outil par nom avec un payload JSON validé

Sémantique de disponibilité :

- `enabled` : l'outil est activé dans `antaerus/config/tools.yaml`
- `available` : l'outil peut réellement être utilisé dans l'environnement courant
- `reason` : motif explicite si l'outil est désactivé, non configuré ou indisponible

Format homogène de réponse d'exécution :

- `ok`
- `tool`
- `status`
- `result`
- `error`
- `meta`

Depuis `M3.3`, cette API reste utile comme point d'administration interne, mais l'orchestration `LLM -> tool -> réponse finale` est désormais branchée sur `POST /llm/session-stream`.

### Session Stream Tool-Aware

Le endpoint `POST /llm/session-stream` devient la surface unique tool-aware du lot `M3.3` :

- le brain recharge l'historique conversationnel de la session
- il injecte les schémas tools issus du registry dynamique dans le premier appel LLM
- si le provider retourne un ou plusieurs `tool_calls`, le brain exécute les tools concernés
- chaque résultat est réinjecté comme message `tool` avant un second appel LLM
- le SSE retourné au client continue de publier uniquement la réponse finale normalisée via `token`, `complete` ou `error`

Portée volontaire :

- `POST /llm/chat` et `POST /llm/stream` ne deviennent pas tool-aware dans ce lot
- le function calling est limité à un nombre borné de tours internes pour éviter les boucles infinies

## Régénération

- Go (`engine.proto`) : `task generate:proto:go` ou `protoc --proto_path=antaerus/kernel/proto --go_out=paths=source_relative:antaerus/interfaces/gateway_go/internal/gen/enginepb --go-grpc_out=paths=source_relative:antaerus/interfaces/gateway_go/internal/gen/enginepb antaerus/kernel/proto/engine.proto`
- Go (`audio.proto`) : `protoc --proto_path=antaerus/kernel/proto --go_out=paths=source_relative:antaerus/interfaces/gateway_go/internal/gen/audiopb --go-grpc_out=paths=source_relative:antaerus/interfaces/gateway_go/internal/gen/audiopb antaerus/kernel/proto/audio.proto`
- Rust : `task generate:proto:rust`, qui appelle le helper `providers/engine_rust/tools/proto_codegen`

## Évolution Prévue

Ces schémas servent de base légère pour la phase fondation. Ils évolueront ensuite vers :

- handlers WebSocket métier complets
- intégration gRPC voix détaillée en `M2`
- contrats de configuration et d'authentification

## WebSocket Fondation

Le format WebSocket fondation utilise une enveloppe commune :

- `type` : identifiant d'événement
- `timestamp` : date ISO-8601 UTC
- `payload` : contenu métier sérialisé en JSON

### Client → Serveur

- `chat.message`
- `voice.start`
- `voice.stop`
- `voice.barge_in`
- `mission.cancel`

### Serveur → Client

- `chat.token`
- `chat.complete`
- `voice.transcript`
- `voice.audio`
- `voice.vad_state`
- `voice.wake_state`
- `mission.update`
- `system.alert`
- `proactive.notification`
- `health.heartbeat`

Notes `M2.2` :

- `voice.start`, `voice.stop` et `voice.barge_in` sont maintenant branchés au pipeline Go ↔ Rust.
- `voice.transcript` et `voice.vad_state` sont alimentés depuis `AudioRuntime.StartVoiceSession`.
- `voice.wake_state` expose l'etat d'armement de la session voix (`waiting`, `armed`) pour l'UI React.
- un transcript final déclenche automatiquement le brain Python puis `AudioRuntime.Speak`.
- tant que la session est en etat `waiting`, seuls les utterances commencant par le wake word configure (`ANTAERUS_ENGINE_WAKE_WORD`, par defaut `aNtaerus`) sont transmis au brain; le wake word est retire du transcript utile.
- `voice.audio` reste réservé pour une évolution future navigateur; en `M2.2`, la lecture TTS reste locale dans `engine_rust`.

## gRPC Fondation Go ↔ Rust

Le contrat `kernel/proto/engine.proto` introduit le service `EngineRuntime` avec trois RPC minimaux :

- `Ping` : mesure de latence locale et validation de connectivité
- `GetHealth` : récupération de l'état du provider Rust
- `GetCapabilities` : récupération des capacités déclarées

Ce contrat reste volontairement minimal pour éviter d'empiéter sur le pipeline audio détaillé prévu en `M2`.

Le contrat `kernel/proto/audio.proto` couvre désormais le pipeline voix local :

- `StartVoiceSession` : ouvre le stream d'événements voix (`vad`, `transcript`, `system`)
- `WakeWordEvent` : expose l'etat `waiting` / `armed` du wake word sur le stream de session
- `StopVoiceSession` : ferme une session voix active
- `Speak` : déclenche la synthèse locale côté `engine_rust`

## Capacités Locales `M3.2`

Le lot `M3.2` ajoute des briques locales de sandbox dans `engine_rust`, sans modifier le contrat gRPC réel `kernel/proto/engine.proto` à ce stade.

Capacités désormais déclarées par `GET /capabilities` côté moteur Rust :

- `fs-sandbox`
- `fs-readonly-reader`
- `cli-sandbox`
- `wasm-runtime` quand la feature `wasm-runtime` est activée

Portée de ces capacités en `M3.2` :

- `fs-sandbox` : validation whitelistée de chemins et ouverture bornée de fichiers autorisés
- `fs-readonly-reader` : lecture sécurisée de fichiers texte avec limite de taille
- `cli-sandbox` : exécution locale d'une commande explicitement whitelistée, sans shell libre
- `wasm-runtime` : chargement local d'un module WASM et exécution d'un export simple sous `wasmtime`

Limites volontaires du lot :

- aucun nouveau RPC `ExecuteWASM` n'est encore exposé
- la source de vérité de whitelist reste `antaerus/config/tools.yaml`

## Endpoints HTTP Internes `M3.3`

Le lot `M3.3` ajoute un pont HTTP interne `brain_python -> engine_rust` pour les tools sandboxés.

Routes désormais exposées par `engine_rust` :

- `POST /internal/tools/filesystem/read`
- `POST /internal/tools/cli/execute`

Contrat de réponse homogène :

- `ok`
- `tool`
- `status`
- `result`
- `error`
- `meta`

Sémantique attendue :

- `filesystem/read` lit un fichier texte autorisé par la whitelist Rust et retourne notamment `path`, `content`, `size`, `truncated`
- `cli/execute` exécute une commande whitelistée sans shell libre et retourne notamment `command`, `args`, `exitCode`, `stdout`, `stderr`
- en cas d'erreur métier ou de refus sandbox, `ok=false` avec un `status` compatible `ToolResult` (`denied`, `not_configured`, `error`)

## Gate Composite `M3.3`

Le gate composite décrit dans `antaerus/kernel/approval/gate.md` est désormais matérialisé côté `brain_python` :

- `category=rust-sandbox` et `autonomy_level >= 3` => `allow` automatique avec audit append-only
- `autonomy_level >= 4` => `review`
- les autres tools suivent une politique `allow` par défaut, avec audit si le niveau d'autonomie est au moins `3`

## Validation Locale

- `go test ./interfaces/gateway_go/...`
- `cargo check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test`
- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-go-python-latency.ps1`
- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-go-rust-latency.ps1`
- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-voice-e2e-latency.ps1`
