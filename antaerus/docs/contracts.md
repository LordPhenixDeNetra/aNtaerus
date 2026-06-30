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
- `mission.update`
- `system.alert`
- `proactive.notification`
- `health.heartbeat`

Notes `M2.2` :

- `voice.start`, `voice.stop` et `voice.barge_in` sont maintenant branchés au pipeline Go ↔ Rust.
- `voice.transcript` et `voice.vad_state` sont alimentés depuis `AudioRuntime.StartVoiceSession`.
- un transcript final déclenche automatiquement le brain Python puis `AudioRuntime.Speak`.
- `voice.audio` reste réservé pour une évolution future navigateur; en `M2.2`, la lecture TTS reste locale dans `engine_rust`.

## gRPC Fondation Go ↔ Rust

Le contrat `kernel/proto/engine.proto` introduit le service `EngineRuntime` avec trois RPC minimaux :

- `Ping` : mesure de latence locale et validation de connectivité
- `GetHealth` : récupération de l'état du provider Rust
- `GetCapabilities` : récupération des capacités déclarées

Ce contrat reste volontairement minimal pour éviter d'empiéter sur le pipeline audio détaillé prévu en `M2`.

Le contrat `kernel/proto/audio.proto` couvre désormais le pipeline voix local :

- `StartVoiceSession` : ouvre le stream d'événements voix (`vad`, `transcript`, `system`)
- `StopVoiceSession` : ferme une session voix active
- `Speak` : déclenche la synthèse locale côté `engine_rust`

## Validation Locale

- `go test ./interfaces/gateway_go/...`
- `cargo check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test`
- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-go-python-latency.ps1`
- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-go-rust-latency.ps1`
- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-voice-e2e-latency.ps1`
