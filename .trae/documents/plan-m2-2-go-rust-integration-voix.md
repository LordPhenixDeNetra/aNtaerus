# Plan M2.2 - Go <-> Rust Integration Voix

## Summary

Objectif: brancher le pipeline voix entre le gateway Go et `engine_rust` en reutilisant la session WebSocket existante, avec transcription automatique vers le brain Python puis synthese vocale locale dans Rust.

Succes attendu pour cette milestone:

- `voice.start` ouvre une session voix cote gateway puis un stream gRPC `AudioRuntime.StartVoiceSession` cote Rust.
- les evenements Rust `vad` et `transcript` sont retransmis au client WebSocket sous les types deja declares.
- un transcript final declenche automatiquement `BrainChatClient.StreamSession(...)`, puis la reponse finale du LLM est envoyee a `AudioRuntime.Speak(...)`.
- `voice.stop` ferme proprement la session gRPC active.
- `voice.barge_in` arrete la lecture TTS en cours et interrompt le cycle voix courant.
- la session texte et la session voix partagent le meme `sessionId`.
- les tests Go couvrent le transport WebSocket, le mapping gRPC -> WebSocket, et la boucle transcript -> LLM -> Speak.

## Current State Analysis

### Contrats et proto deja presents

- `antaerus/kernel/proto/audio.proto` expose deja `StartVoiceSession`, `StopVoiceSession` et `Speak`.
- `antaerus/interfaces/gateway_go/internal/contracts/websocket.go` declare deja `voice.start`, `voice.stop`, `voice.barge_in`, `voice.transcript`, `voice.audio` et `voice.vad_state`.
- `antaerus/interfaces/web/src/lib/ws.ts` consomme deja ces types cote frontend, mais aucune logique voix active n'existe encore dans les hooks/pages.

### Gateway Go actuel

- `antaerus/interfaces/gateway_go/internal/http/websocket.go` gere `chat.message`, mais les messages voix retournent encore un placeholder.
- `antaerus/interfaces/gateway_go/internal/http/routes.go` injecte seulement `BrainChatClient` et `HealthService` dans `NewHub(...)`.
- `antaerus/interfaces/gateway_go/internal/clients/engine_grpc_client.go` ne couvre aujourd'hui que `EngineRuntime` (`Ping`, `GetHealth`, `GetCapabilities`).
- `antaerus/interfaces/gateway_go/internal/clients/engine_runtime_client.go` utilise deja `ANTAERUS_ENGINE_GRPC_TARGET`, donc le point de connexion gRPC Rust est deja disponible.

### Engine Rust actuel

- `antaerus/providers/engine_rust/src/protocol/server.rs` sait deja:
  - demarrer une session voix locale basee sur capture micro,
  - emettre des evenements `VadEvent` et `TranscriptEvent`,
  - arreter une session via `StopVoiceSession`,
  - lancer la synthese via `Speak`.
- la sortie TTS retenue pour `M2.2` est locale cote Rust, pas un flux PCM renvoye vers React.

### Gaps identifies

- aucun stub Go pour `audio.proto` n'est committe sous `antaerus/interfaces/gateway_go/internal/gen/`.
- aucun client Go n'encapsule `AudioRuntime`.
- aucune structure de session voix n'existe dans le hub WebSocket.
- aucun pont automatique `transcript final -> brain -> speak` n'est encore implemente.
- `voice.audio` existe dans le contrat WebSocket mais ne sera pas utilise dans cette milestone car la lecture reste locale cote Rust.

## Assumptions & Decisions

- La decision produit est fixee a `TTS local dans engine_rust`.
- La decision produit est fixee a `transcript final -> LLM -> Speak` automatiquement dans cette milestone.
- Le `sessionId` transporte par `voice.start` est la cle de correlation unique entre WebSocket, stream gRPC audio et historique brain.
- Le gateway ne transporte pas d'audio brut navigateur -> Go -> Rust dans `M2.2`; la capture micro reste locale dans Rust conformement a `M2.1`.
- `voice.audio` reste reserve dans le contrat WebSocket pour une evolution future, mais n'est pas emis dans l'implementation `M2.2`.
- En l'absence de champ `language` cote WebSocket, le gateway enverra une valeur par defaut stable au RPC `StartVoiceSessionRequest.language` (par exemple `fr`) tant que le contrat n'est pas enrichi ulterieurement.
- Le declenchement TTS se fera sur le message `complete` du brain, pas sur chaque token, afin d'eviter une file de synthese fragmentee.
- Le `barge_in` sera traite comme une interruption de lecture et du cycle voix en cours pour la session active.

## Proposed Changes

### 1. Ajouter les stubs Go pour `audio.proto`

Fichiers:

- `antaerus/interfaces/gateway_go/internal/gen/audiopb/audio.pb.go`
- `antaerus/interfaces/gateway_go/internal/gen/audiopb/audio_grpc.pb.go`
- `antaerus/docs/contracts.md`

What:

- generer et committer les stubs Go de `antaerus/kernel/proto/audio.proto` dans un nouveau package `audiopb`.
- documenter la commande de generation Go pour `audio.proto`, en parallele de celle deja documentee pour `engine.proto`.

Why:

- le gateway ne peut pas appeler `AudioRuntime` sans types gRPC Go stables.
- le projet a deja le precedent `enginepb` committe dans le repo; `audiopb` doit suivre le meme modele.

How:

- reutiliser le meme style de generation que `enginepb`, mais avec un package de sortie distinct `internal/gen/audiopb`.
- verifier que le `go_package`/namespace genere reste coherent avec les imports internes du gateway.

### 2. Etendre le client gRPC Rust cote Go

Fichiers:

- `antaerus/interfaces/gateway_go/internal/clients/engine_grpc_client.go`
- eventuellement `antaerus/interfaces/gateway_go/internal/clients/clients_test.go`

What:

- etendre `EngineGRPCClient` pour ouvrir aussi un client `audiopb.AudioRuntimeClient` sur la meme connexion gRPC.
- ajouter des methodes de haut niveau:
  - `StartVoiceSession(ctx, sessionID, language)`
  - `StopVoiceSession(ctx, sessionID)`
  - `Speak(ctx, sessionID, text)`

Why:

- `M2.2` a deja un point de connexion unique `ANTAERUS_ENGINE_GRPC_TARGET`; il faut le mutualiser pour `EngineRuntime` et `AudioRuntime`.

How:

- conserver `conn *grpc.ClientConn`.
- garder les methodes existantes `Ping/GetHealth/GetCapabilities`.
- ajouter la couche `AudioRuntimeClient` sans casser les usages actuels de `EngineRuntimeClient`.
- prevoir une interface de stream simple cote Go pour faciliter les tests du proxy voix.

### 3. Introduire une session voix explicite dans le hub WebSocket

Fichiers:

- `antaerus/interfaces/gateway_go/internal/http/voice_session.go`
- `antaerus/interfaces/gateway_go/internal/http/websocket.go`

What:

- creer une structure dediee a la session voix par client/session:
  - `sessionID`
  - reference client WebSocket
  - stream gRPC audio actif
  - contexte d'annulation
  - etat `speaking/silence`
  - drapeaux d'interruption (`barge_in`, `stopped`)
- stocker ces sessions dans `Hub`, indexees au minimum par `client.id + sessionID` ou equivalent.

Why:

- `websocket.go` devient trop charge si la logique voix reste inline.
- la fermeture propre, l'idempotence de `voice.start`/`voice.stop`, et l'interruption `barge_in` exigent un etat explicite.

How:

- ajouter au `Hub` une map protegee par mutex pour les sessions voix.
- factoriser la creation, la recuperation et la destruction de session dans `voice_session.go`.
- garantir que `client.close()` arrete aussi toute session voix restante.

### 4. Ajouter un proxy de flux Rust -> WebSocket et la boucle automatique vers le brain

Fichiers:

- `antaerus/interfaces/gateway_go/internal/http/voice_proxy.go`
- `antaerus/interfaces/gateway_go/internal/http/websocket.go`

What:

- implementer le coeur de `M2.2` dans un proxy dedie:
  - lecture du stream gRPC `VoiceEvent`,
  - mapping vers `voice.vad_state`, `voice.transcript` et `system.alert`,
  - detection d'un transcript final non vide,
  - appel automatique du brain avec `BrainChatClient.StreamSession(...)`,
  - emission `chat.token` / `chat.complete` au client,
  - appel `Speak(...)` cote Rust avec le texte final du LLM.

Why:

- cette boucle realise l'integration attendue `micro local Rust -> Go -> brain Python -> Go -> Rust speaker local`.

How:

- pour `VadEvent`:
  - envoyer `voice.vad_state` avec `speaking` ou `silence`.
- pour `TranscriptEvent`:
  - envoyer `voice.transcript`.
  - ne declencher le brain que si `is_final == true` et `text` non vide.
- pour `SystemEvent`:
  - convertir vers `system.alert`.
- pour le stream brain:
  - conserver le comportement texte existant du gateway afin de garder une UI homogene.
  - accumuler le texte final du `complete` et seulement ensuite appeler `Speak(...)`.
- pour `barge_in`:
  - interrompre le cycle courant de session et tenter un `StopVoiceSession(...)` suivi d'un redemarrage controle si necessaire.
  - ne pas essayer d'inventer un nouveau RPC Rust dans `M2.2`; rester dans le contrat existant.

### 5. Remplacer le placeholder voix dans le hub par des handlers reels

Fichiers:

- `antaerus/interfaces/gateway_go/internal/http/websocket.go`
- `antaerus/interfaces/gateway_go/internal/http/routes.go`

What:

- remplacer le `placeholder active` par des handlers:
  - `handleVoiceStart`
  - `handleVoiceStop`
  - `handleVoiceBargeIn`
- injecter la dependance gRPC Rust necessaire dans `NewHub(...)`.

Why:

- la route WebSocket centrale doit maintenant orchestrer texte + voix.

How:

- dans `routes.go`, construire le client runtime/GRPC requis a partir de `cfg.EngineGRPCTarget`.
- dans `websocket.go`, parser les payloads `SessionControlPayload` comme aujourd'hui, puis deleguer a la couche voix.
- conserver les limites de debit WebSocket existantes.

### 6. Stabiliser les cas limites et la gestion d'erreur

Fichiers:

- `antaerus/interfaces/gateway_go/internal/http/voice_session.go`
- `antaerus/interfaces/gateway_go/internal/http/voice_proxy.go`
- `antaerus/interfaces/gateway_go/internal/http/websocket.go`

What:

- definir le comportement sur:
  - double `voice.start` pour une meme session,
  - `voice.stop` sans session active,
  - fermeture WebSocket pendant un stream gRPC actif,
  - echec gRPC au demarrage,
  - echec brain pendant la generation,
  - transcript vide ou whitespace,
  - `barge_in` pendant que le brain streame encore.

Why:

- ces cas pilotent la robustesse temps reel et doivent etre decides avant implementation.

How:

- `voice.start` sur session deja active:
  - retourner `system.alert` niveau `warn`, sans dupliquer le stream.
- `voice.stop` sans session:
  - operation idempotente, avec alert `info` ou reponse silencieuse selon la simplicite du code.
- echec gRPC / brain:
  - retourner `system.alert` niveau `error`.
- transcript vide:
  - ne pas appeler le brain.
- fermeture client:
  - annuler le contexte et fermer la session cote Go, puis appeler `StopVoiceSession`.

### 7. Mettre a jour les tests Go existants et ajouter les tests voix cibles

Fichiers:

- `antaerus/interfaces/gateway_go/internal/http/websocket_test.go`
- `antaerus/interfaces/gateway_go/internal/clients/clients_test.go`
- eventuellement nouveaux tests:
  - `antaerus/interfaces/gateway_go/internal/http/voice_proxy_test.go`
  - `antaerus/interfaces/gateway_go/internal/http/voice_session_test.go`

What:

- completer la couverture avec des fakes/stubs pour le client audio gRPC et le brain.

Why:

- `M2.2` introduit une orchestration concurrente; les regressions seront difficiles a voir sans tests cibles.

How:

- cas a couvrir:
  - `voice.start` ouvre la session et relaie `voice.vad_state` puis `voice.transcript`.
  - transcript final declenche `chat.token`, `chat.complete`, puis `Speak`.
  - `voice.stop` appelle `StopVoiceSession`.
  - `barge_in` interrompt proprement la session courante.
  - un echec gRPC remonte un `system.alert`.
- conserver les tests existants de rate limit et de chat texte.

### 8. Mettre a jour la documentation et le backlog vivant

Fichiers:

- `tasks.md`
- `antaerus/docs/contracts.md`

What:

- marquer les taches `M2.2` effectuees une fois l'implementation terminee.
- documenter explicitement que `M2.2` conserve la lecture TTS locale dans Rust et n'emet pas encore `voice.audio`.

Why:

- le repo impose `tasks.md` comme source de verite.
- le contrat fonctionnel doit expliquer pourquoi `voice.audio` reste reserve.

How:

- ajouter un bloc `Etat actuel` sous `M2.2` avec le flux reel branche.
- noter les limites restantes pour la future phase de capture/playback navigateur si elle est demandee plus tard.

## Implementation Order

1. Generer/committer `audiopb` pour Go.
2. Etendre `engine_grpc_client.go` avec `AudioRuntime`.
3. Introduire `voice_session.go` et le stockage des sessions dans `Hub`.
4. Introduire `voice_proxy.go` avec mapping gRPC -> WebSocket.
5. Brancher `voice.start`, `voice.stop`, `voice.barge_in` dans `websocket.go`.
6. Mettre a jour `routes.go` si une injection explicite est necessaire.
7. Ajouter/adapter les tests.
8. Mettre a jour `docs/contracts.md` puis `tasks.md`.

## Verification Steps

### Tests automatiques

- `go test ./interfaces/gateway_go/...`

### Verifications ciblees

- verifier qu'un `voice.start` produit un stream gRPC unique par `sessionId`.
- verifier qu'un `TranscriptEvent{is_final:true}` non vide:
  - emet `voice.transcript`,
  - declenche le stream brain,
  - emet `chat.token` puis `chat.complete`,
  - appelle `Speak(sessionId, llmFinalText)`.
- verifier que `voice.stop` ferme la session sans fuite goroutine evidente.
- verifier que `barge_in` coupe le cycle courant et n'envoie plus de `Speak` obsolete.
- verifier qu'une erreur Rust ou brain remonte un `system.alert`.

### Benchmarks / smokes a executer apres implementation

- rejouer la validation Go existante.
- si l'environnement local le permet, adapter ou ajouter un bench/smoke pour mesurer:
  - latence Go <-> Rust gRPC `< 10ms`,
  - latence bout-en-bout `micro Rust -> Go -> brain -> Go -> Rust speaker` `< 1000ms`.

### Risques connus

- le contrat `audio.proto` actuel ne fournit pas de RPC dedie au `barge_in`; l'implementation devra rester dans les primitives existantes.
- la capture micro et la lecture audio restent locales au moteur Rust; aucune UX navigateur micro/speaker n'est livree dans `M2.2`.
- la preuve de latence bout-en-bout dependra de la disponibilite reelle des modeles locaux et du provider LLM configure.
