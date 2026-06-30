# Plan — M2.1 : Rust Audio Engine (capture/VAD/STT/TTS + gRPC)

## Summary

Implémenter le lot **M2.1** dans `antaerus/providers/engine_rust/` :
- pipeline audio local : **capture micro → VAD → STT (Whisper) → texte**
- pipeline audio local : **texte → TTS (Piper) → sortie haut‑parleur** avec **mixer + barge‑in**
- primitives audio : resampling, formats, buffers
- **API gRPC tonic** dédiée à la voix via un nouveau `audio.proto`
- tests unitaires + tests latence **ignorés** (exécutables en local quand les modèles sont présents)

Décisions validées :
- moteur audio **local** (micro + speaker sur la machine `engine_rust`)
- modèles **fournis par chemins locaux** (pas de téléchargement automatique)
- TTS **joué localement** par `engine_rust` (pas de retour audio au client)

## Current State Analysis (repo)

- Le provider Rust actuel expose un gRPC minimal `EngineRuntime` dans [grpc_service.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/grpc_service.rs) et charge les stubs depuis [grpc.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/grpc.rs) (`src/gen/engine.rs`).
- La génération protobuf côté Rust est centralisée via [tools/proto_codegen](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/tools/proto_codegen/src/main.rs) et compile uniquement `antaerus/kernel/proto/engine.proto`.
- `engine_rust` n’a actuellement **aucune** implémentation audio ni dépendances (`cpal`, `whisper-rs`, `piper-rs`, `silero-vad`) dans [Cargo.toml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/Cargo.toml).
- Les capacités Rust sont encore “placeholder” (`audio-slot-reserved`) dans [state.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/state.rs#L36-L48).
- Les tâches M2.1 sont listées dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L181-L192).

## Proposed Changes (decision-complete)

### A) Structure de modules Rust (audio)

Créer un nouveau module `audio` sous `antaerus/providers/engine_rust/src/` :

- `audio/mod.rs` : types partagés (format audio, erreurs) + façade `AudioEngine`
- `audio/capture.rs` : capture micro via `cpal` → stream PCM
- `audio/resampler.rs` : resampling (input device rate → 16kHz mono pour VAD/STT, et inverse pour sortie)
- `audio/vad.rs` : wrapper VAD (`silero-vad`) + segmentation (début/fin de parole)
- `audio/stt.rs` : wrapper STT (`whisper-rs`) + conversion segment → texte
- `audio/tts.rs` : wrapper TTS (`piper-rs`) + synthèse texte → audio
- `audio/mixer.rs` : mixage + file de lecture + barge-in (interruption TTS quand VAD détecte une prise de parole)

Contrainte : ne pas introduire de commentaires dans le code.

### B) Config / chemins modèles (env)

Étendre `engine_rust` pour accepter des chemins modèles via `.env` (chemins locaux) :

Fichier à modifier :
- `antaerus/providers/engine_rust/src/config.rs`

Champs à ajouter à `Settings` (exemples) :
- `audio_input_device: Option<String>`
- `audio_output_device: Option<String>`
- `audio_input_sample_rate: Option<u32>`
- `audio_output_sample_rate: Option<u32>`
- `vad_model_path: Option<PathBuf>` (ou `String`)
- `whisper_model_path: Option<PathBuf>`
- `piper_model_path: Option<PathBuf>`
- `piper_config_path: Option<PathBuf>` (si requis par le crate)

Mettre à jour le contrat global :
- `antaerus/.env.example` : ajouter les variables `ANTAERUS_ENGINE_*` associées, **optionnelles** (vides par défaut).

Règle : si un modèle n’est pas configuré alors la fonctionnalité correspondante retourne une erreur explicite (et l’API gRPC renvoie un event `error`).

### C) Protobuf audio + génération stubs Rust

Objectif : introduire `audio.proto` et stubs Rust (server) au même niveau que `engine.proto`.

Créer :
- `antaerus/kernel/proto/audio.proto`

Conventions :
- `package antaerus.kernel.audio.v1;`
- Service `AudioRuntime` avec RPC orientés “pilotage” (local) :
  - `StartVoiceSession(StartVoiceSessionRequest) returns (stream VoiceEvent)`
  - `StopVoiceSession(StopVoiceSessionRequest) returns (StopVoiceSessionResponse)`
  - `Speak(SpeakRequest) returns (SpeakResponse)` (joue localement via mixer)

Messages (minimum viable) :
- `StartVoiceSessionRequest { string session_id; string language; }`
- `StopVoiceSessionRequest { string session_id; }`
- `SpeakRequest { string session_id; string text; }`
- `VoiceEvent { string session_id; oneof payload { VadEvent vad; TranscriptEvent transcript; SystemEvent system; } }`
- `VadEvent { bool speaking; }`
- `TranscriptEvent { string text; bool is_final; }`
- `SystemEvent { string level; string message; }`

Mettre à jour le générateur Rust :
- `antaerus/providers/engine_rust/tools/proto_codegen/src/main.rs`
  - compiler `engine.proto` **et** `audio.proto`
  - générer `src/gen/audio.rs` en plus de `src/gen/engine.rs`

Mettre à jour le module `grpc` :
- `antaerus/providers/engine_rust/src/grpc.rs` :
  - ajouter `pub mod audiopb { include!("gen/audio.rs"); }`

### D) gRPC server : intégration AudioRuntime

Implémenter la partie “server tonic” demandée par M2.1 en s’alignant sur la structure existante :

Créer :
- `antaerus/providers/engine_rust/src/protocol/server.rs` (entrée de la logique gRPC audio)
- `antaerus/providers/engine_rust/src/protocol/mod.rs`

Évolutions :
- Modifier `antaerus/providers/engine_rust/src/grpc_service.rs` pour :
  - instancier `AudioEngine` (avec `Settings`)
  - ajouter le service tonic `AudioRuntimeServer` à `Server::builder()`
  - conserver `EngineRuntimeServer`

Comportement “local” :
- `StartVoiceSession` :
  - démarre une tâche capture → resample → VAD → segmentation → STT
  - stream des `VoiceEvent` :
    - `VadEvent(speaking=true|false)`
    - `TranscriptEvent(text=..., is_final=...)`
    - `SystemEvent` en cas d’erreur ou d’état (ex: modèle manquant)
  - arrêt via :
    - cancellation du stream côté client (Go) **ou**
    - `StopVoiceSession(session_id)` si la session doit survivre à des reconnects
- `Speak` :
  - synthèse (Piper) puis enqueue dans `mixer`
  - barge-in :
    - si `vad` détecte parole alors `mixer` stoppe la lecture courante (génération id / cancel token)

### E) Dépendances Rust

Mettre à jour `antaerus/providers/engine_rust/Cargo.toml` :
- ajouter crates audio :
  - `cpal` (capture + output)
  - `silero-vad`
  - `whisper-rs`
  - `piper` / `piper-rs` (selon crate existant)
  - resampling : choisir une lib pure Rust (ex: `rubato` ou `dasp`)
- ajouter utilitaires robustes :
  - `thiserror` ou `anyhow` pour erreurs (au choix, mais unifier)

Décision d’implémentation : garder le provider compilable sur Windows, et éviter toute auto‑installation de modèles.

### F) Tests (unitaires + latence)

1) **Tests unitaires** (toujours exécutables en CI)
- `resampler` : conversion sample rate + mono/stereo
- `mixer` : enqueue + barge-in (sans device réel, via “sink” abstrait test)
- `protocol/server` : tests de logique sans transport (appel direct des méthodes tonic)

2) **Tests latence** (ignorés, exécutables localement)
- Ajouter `antaerus/providers/engine_rust/tests/voice_latency.rs` avec `#[ignore]` :
  - `capture → stt → texte` : mesure et affichage, assertion optionnelle si env `ANTAERUS_STRICT_LATENCY=1`
  - `texte → tts → audio` : idem
- Condition d’exécution :
  - nécessite devices audio + chemins modèles valides

### G) Capabilities & doc/runtime

Mettre à jour :
- `antaerus/providers/engine_rust/src/state.rs`
  - remplacer `audio-slot-reserved` par des capacités réelles :
    - `audio-capture`
    - `audio-vad`
    - `audio-stt`
    - `audio-tts`
    - `audio-mixer`
    - `grpc-audio-runtime`
- `tasks.md` :
  - cocher M2.1 et noter les variables `.env` ajoutées

## Assumptions & Decisions

- L’audio est **local** : le gRPC sert à piloter et à récupérer les événements, pas à transporter le micro/speaker.
- Les modèles sont fournis par chemins locaux (variables `.env`), aucun téléchargement automatique.
- Les tests de latence sont `#[ignore]` pour éviter la non-déterminisme CI.
- L’API gRPC audio est ajoutée sans casser l’existant (service `EngineRuntime` conservé).

## Verification Steps

### Rust
- Depuis `antaerus/providers/engine_rust/` :
  - `cargo fmt --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test`

### Proto generation
- Exécuter le générateur (selon workflow actuel) et vérifier :
  - `src/gen/audio.rs` présent
  - `engine_rust::grpc::audiopb` compile

### Latence (manuel)
- Configurer `.env` avec chemins modèles + devices.
- Lancer :
  - `cargo test --test voice_latency -- --ignored`
  - Vérifier que les métriques imprimées sont < 200ms / < 300ms sur la machine cible.

