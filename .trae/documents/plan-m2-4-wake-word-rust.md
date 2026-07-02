# Plan M2.4 - Wake Word Rust

## Résumé

Objectif: livrer `M2.4` sous forme d'un wake word **basé sur le transcript Whisper** dans la pipeline voix Rust existante, sans nouveau moteur de keyword spotting audio.

Décisions produit figées pendant le cadrage:

- approche: **filtrage STT** après transcription finale
- mot-clé: **aNtaerus**
- matching: **normalisé tolérant**
- portée sessionnelle: **une seule détection par session voix**, puis la session reste armée jusqu'à `voice.stop`
- UX: **état wake word visible dans l'UI React**

Effet attendu:

- après `voice.start`, la session écoute le micro mais **n'envoie rien au LLM** tant que le wake word n'a pas été détecté
- si l'utterance finale contient seulement le wake word, la session passe en mode armé mais **aucune requête LLM n'est envoyée**
- si l'utterance finale commence par le wake word puis contient une demande, le wake word est retiré et **seule la demande utile** est transmise au LLM
- une fois armée, la session continue à traiter les utterances suivantes sans exiger de répéter `aNtaerus`

## Analyse De L'état Actuel

- Le runtime Rust capture déjà le micro et boucle sur `capture -> resample -> VAD -> STT` dans `antaerus/providers/engine_rust/src/protocol/server.rs`.
- `VadDetector` dans `antaerus/providers/engine_rust/src/audio/vad.rs` ne gère aujourd'hui que l'état binaire `speaking` / `silence`.
- Le transcript final déclenche immédiatement le brain Python via le proxy Go dans `antaerus/interfaces/gateway_go/internal/http/voice_proxy.go`.
- Le contrat gRPC `antaerus/kernel/proto/audio.proto` ne transporte actuellement que `vad`, `transcript` et `system`.
- Le contrat WebSocket React/Go ne transporte actuellement que `voice.vad_state`, `voice.transcript`, `system.alert`, etc. dans:
  - `antaerus/interfaces/gateway_go/internal/contracts/websocket.go`
  - `antaerus/interfaces/web/src/lib/ws.ts`
  - `antaerus/kernel/schemas/websocket-server-message.schema.json`
- Le store React ne possède pas encore d'état wake word dédié dans `antaerus/interfaces/web/src/store/useAppStore.ts`.
- L'UI voix actuelle affiche seulement mode, transcript et VAD dans:
  - `antaerus/interfaces/web/src/hooks/useVoiceStream.ts`
  - `antaerus/interfaces/web/src/components/VoiceTranscript.tsx`
- Les tests existants couvrent déjà le forwarding voix Go, la sérialisation WebSocket et l'UI voix, mais **aucun test wake word** n'existe encore.

## Changements Proposés

### 1. Ajouter un état wake word explicite au contrat Rust -> Go -> Web

Fichiers:

- `antaerus/kernel/proto/audio.proto`
- `antaerus/interfaces/gateway_go/internal/gen/audiopb/audio.pb.go`
- `antaerus/interfaces/gateway_go/internal/gen/audiopb/audio_grpc.pb.go`
- `antaerus/interfaces/gateway_go/internal/contracts/websocket.go`
- `antaerus/interfaces/web/src/lib/ws.ts`
- `antaerus/kernel/schemas/websocket-server-message.schema.json`
- `antaerus/docs/contracts.md`

Plan:

- étendre `audio.proto` avec un nouvel événement `WakeWordEvent`
- ajouter ce nouveau payload au `oneof` de `VoiceEvent`
- définir un état simple et durable, suffisant pour l'UI:
  - `waiting`
  - `armed`
- exposer le relay WebSocket correspondant sous un nouveau message `voice.wake_state`
- documenter ce nouvel événement dans `docs/contracts.md`

Pourquoi:

- un état dédié évite de détourner `system.alert` pour une information métier persistante
- l'UI pourra afficher clairement "en attente du wake word" puis "session armée"

### 2. Introduire une logique de wake word transcript-first côté Rust

Fichiers:

- `antaerus/providers/engine_rust/src/config.rs`
- `antaerus/providers/engine_rust/src/protocol/server.rs`
- nouveau module recommandé: `antaerus/providers/engine_rust/src/audio/wake_word.rs`
- selon l'organisation du module audio: `antaerus/providers/engine_rust/src/audio/mod.rs` si nécessaire

Plan:

- ajouter une petite machine d'état wake word côté runtime Rust, **au niveau de la session voix**, pas dans l'UI
- garder `VadDetector` responsable uniquement des frontières de parole; le wake word se branche **après STT final**
- créer un module dédié `wake_word.rs` pour:
  - normaliser le transcript (`lowercase`, suppression des accents usuels, espaces/punctuations parasites)
  - détecter si l'utterance commence par le wake word
  - retirer proprement le wake word du texte à transmettre
  - retourner une décision du type:
    - `Ignored`
    - `ArmedNoCommand`
    - `ArmedWithCommand(cleaned_text)`
    - `PassThrough(cleaned_text)` si la session est déjà armée
- ajouter à `Settings` une configuration simple:
  - `wake_word: String`
  - chargée depuis `ANTAERUS_ENGINE_WAKE_WORD`
  - valeur par défaut: `aNtaerus`

Pourquoi:

- l'approche transcript-first est cohérente avec votre arbitrage produit et l'état réel du dépôt
- l'isolation dans un module dédié permet de tester la logique sans dépendre du micro, du modèle Whisper ou d'un banc audio complet

### 3. Modifier la boucle de session voix Rust pour armer la session et filtrer les transcripts

Fichier:

- `antaerus/providers/engine_rust/src/protocol/server.rs`

Plan:

- initialiser chaque session voix avec `wake_state = waiting`
- envoyer immédiatement un événement `wake_state = waiting` après `voice session started`
- quand `VAD` retombe à `silence` et qu'un transcript final est produit:
  - si la session est `waiting`:
    - détecter le wake word sur le transcript final
    - si non détecté: ne pas émettre `voice.transcript`, ne pas transmettre au Go/LLM
    - si détecté sans commande résiduelle: passer à `armed`, émettre `wake_state = armed`, éventuellement émettre un transcript nettoyé vide ou ne rien émettre selon la logique retenue, mais ne pas déclencher le LLM
    - si détecté avec commande résiduelle: passer à `armed`, émettre `wake_state = armed`, émettre `voice.transcript` avec **le texte nettoyé sans wake word**
  - si la session est déjà `armed`:
    - émettre `voice.transcript` normalement
- conserver les événements `voice.vad_state` inchangés
- conserver `voice.stop` comme remise à zéro implicite de l'état wake word via la destruction de session

Décision détaillée:

- le wake word doit être traité comme **préfixe d'activation**, pas comme commande à envoyer au LLM
- une utterance contenant seulement `aNtaerus` sert à armer la session, sans réponse du LLM

### 4. Relayer l'état wake word dans le gateway Go

Fichiers:

- `antaerus/interfaces/gateway_go/internal/http/voice_proxy.go`
- `antaerus/interfaces/gateway_go/internal/http/websocket_test.go`

Plan:

- étendre `forwardVoiceEvent()` pour traiter le nouveau `WakeWordEvent`
- relayer cet état vers le client via `voice.wake_state`
- garder `processFinalTranscript()` inchangé sur le principe: il ne recevra déjà plus que les transcripts autorisés par Rust

Pourquoi:

- le filtrage d'activation reste centralisé dans Rust
- Go reste un proxy simple des transcripts finaux autorisés

### 5. Exposer un état wake word persistant dans le frontend

Fichiers:

- `antaerus/interfaces/web/src/store/useAppStore.ts`
- `antaerus/interfaces/web/src/lib/ws.ts`
- `antaerus/interfaces/web/src/hooks/useWebSocket.ts`
- `antaerus/interfaces/web/src/hooks/useVoiceStream.ts`
- `antaerus/interfaces/web/src/components/VoiceTranscript.tsx`
- éventuellement `antaerus/interfaces/web/src/components/VoiceButton.tsx` si le libellé doit refléter l'état
- `antaerus/interfaces/web/src/pages/Chat.tsx` si des props supplémentaires sont nécessaires

Plan:

- ajouter au store un nouvel état durable:
  - `VoiceWakeState = "waiting" | "armed" | null`
- réinitialiser cet état dans `resetVoiceState()`
- étendre `useWebSocket.ts` pour consommer `voice.wake_state`
- faire évoluer `useVoiceStream.ts` pour produire un `statusLabel` orienté wake word:
  - `waiting` -> "En attente du wake word aNtaerus"
  - `armed` + VAD silence -> "Session armée, écoute prête"
  - `armed` + VAD speaking -> "Parole détectée"
  - `speaking` -> "Réponse vocale en cours"
- faire évoluer `VoiceTranscript.tsx` pour refléter la nouvelle phase d'attente:
  - placeholder dédié avant activation
  - transcript affiché sans le wake word une fois nettoyé

Décision UX:

- l'UI ne change pas le geste principal utilisateur: `Démarrer la voix` / `Arrêter la voix`
- l'ajout principal est un **retour visuel persistant** sur l'état `waiting` vs `armed`

### 6. Ajouter une couverture de tests ciblée sur la logique wake word

Fichiers:

- nouveau test Rust recommandé:
  - `antaerus/providers/engine_rust/tests/wake_word.rs`
- `antaerus/interfaces/gateway_go/internal/http/websocket_test.go`
- `antaerus/interfaces/web/src/hooks/useWebSocket.test.ts`
- `antaerus/interfaces/web/src/hooks/useVoiceStream.test.ts`
- éventuellement `antaerus/interfaces/web/src/components/VoiceTranscript.test.tsx` si un test composant dédié apporte une vraie valeur

Plan:

- tests Rust:
  - détecte `aNtaerus` après normalisation
  - accepte les variantes simples de casse/accents/espaces
  - retire le wake word et renvoie le texte utile
  - n'arme pas la session sur une phrase sans wake word
  - arme sans commande quand le transcript ne contient que le wake word
  - laisse passer les utterances suivantes quand la session est déjà armée
- tests Go:
  - forward d'un `WakeWordEvent` vers `voice.wake_state`
  - vérifie qu'un transcript final déjà filtré continue à déclencher le brain et `Speak`
- tests frontend:
  - consommation de `voice.wake_state`
  - mise à jour du store
  - libellés/status selon `waiting` et `armed`
  - reset de l'état wake word sur fermeture/erreur/stop

### 7. Mettre à jour la documentation projet et le backlog

Fichiers:

- `tasks.md`
- `antaerus/.env.example`
- `antaerus/docs/contracts.md`

Plan:

- documenter `ANTAERUS_ENGINE_WAKE_WORD=aNtaerus` dans `.env.example`
- mettre à jour `tasks.md` pour marquer `M2.4` et résumer la stratégie livrée
- expliciter dans `docs/contracts.md` le nouveau message `voice.wake_state` et le fait que les transcripts envoyés au brain sont désormais filtrés par wake word tant que la session n'est pas armée

## Hypothèses Et Décisions

- `M2.4` est livré comme **wake word logique dans la pipeline Rust existante**, pas comme moteur acoustique dédié.
- Le matching "normalisé tolérant" reste volontairement conservateur pour limiter les faux positifs:
  - casse ignorée
  - accents usuels ignorés
  - ponctuation et espaces parasites tolérés
  - pas de liste large de variantes phonétiques agressives au premier lot
- Le mot-clé est interprété comme **préfixe d'activation**, pas comme contenu sémantique destiné au LLM.
- Une fois la session armée, aucun timeout d'expiration n'est introduit dans ce lot.
- Le mode `SSE dev` reste sans voix, comme aujourd'hui.
- La preuve "fausses acceptations < 1/jour" sera traitée dans ce lot sous forme de **couverture déterministe des heuristiques** et d'une validation manuelle explicitée, pas comme benchmark acoustique exhaustif.

## Vérifications

Vérifications de code et de contrat:

- régénération/validation des contrats touchés si `audio.proto` change
- `go test ./interfaces/gateway_go/...`
- `npm run check`
- `npm run test`
- `npm run lint`
- `cargo test`
- `cargo check --features voice` si l'environnement LLVM/libclang est disponible

Vérifications fonctionnelles ciblées:

- `voice.start` met l'UI en attente du wake word
- une phrase sans `aNtaerus` ne produit ni `voice.transcript` utile ni réponse LLM
- `aNtaerus` seul arme la session sans réponse LLM
- `aNtaerus bonjour` arme la session et transmet seulement `bonjour`
- l'état visuel passe bien de `waiting` à `armed`
- après armement, une phrase suivante sans wake word est acceptée
- `voice.stop` remet l'état à zéro

Vérification documentaire:

- `tasks.md` mis à jour à la fin de l'implémentation
- `.env.example` et `docs/contracts.md` alignés avec le comportement livré
