# Contrats De Fondation

Les contrats de cette phase définissent trois objets JSON partagés :

- `service-health.schema.json` : santé d'un service individuel
- `service-capabilities.schema.json` : capacités déclarées d'un service
- `system-status.schema.json` : agrégation retournée par le gateway
- `websocket-client-message.schema.json` : messages client → gateway
- `websocket-server-message.schema.json` : messages gateway → client
- `kernel/proto/engine.proto` : contrat Protobuf fondation Go ↔ Rust

## Principes

- les réponses sont sérialisées en JSON
- la source de vérité du dashboard est le `gateway_go`
- `brain_python` et `engine_rust` exposent leurs états et capacités via HTTP
- le frontend ne contacte pas directement Python ou Rust
- le proto gRPC partagé reste sous `kernel/proto/engine.proto`
- les stubs Go sont commités sous `interfaces/gateway_go/internal/gen/enginepb/`
- le provider Rust consomme un stub serveur sous `providers/engine_rust/src/gen/engine.rs`

## Services Référencés

- `web`
- `gateway_go`
- `brain_python`
- `engine_rust`

## Régénération

- Go : `task generate:proto:go` ou `protoc --proto_path=antaerus/kernel/proto --go_out=paths=source_relative:antaerus/interfaces/gateway_go/internal/gen/enginepb --go-grpc_out=paths=source_relative:antaerus/interfaces/gateway_go/internal/gen/enginepb antaerus/kernel/proto/engine.proto`
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

## gRPC Fondation Go ↔ Rust

Le contrat `kernel/proto/engine.proto` introduit le service `EngineRuntime` avec trois RPC minimaux :

- `Ping` : mesure de latence locale et validation de connectivité
- `GetHealth` : récupération de l'état du provider Rust
- `GetCapabilities` : récupération des capacités déclarées

Ce contrat reste volontairement minimal pour éviter d'empiéter sur le pipeline audio détaillé prévu en `M2`.

## Validation Locale

- `go test ./interfaces/gateway_go/...`
- `cargo check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test`
- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-go-python-latency.ps1`
- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\bench-go-rust-latency.ps1`
