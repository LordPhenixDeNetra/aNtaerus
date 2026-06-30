# Plan M2.3 - React Voice UI

## Summary

Objectif: ajouter dans `interfaces/web` une interface voix React qui pilote le pipeline déjà livré en `M2.2` (`voice.start`, `voice.stop`, `voice.barge_in`) et affiche les retours temps réel (`voice.transcript`, `voice.vad_state`, `chat.token`, `chat.complete`) sans capturer le micro navigateur.

Succès attendu pour cette milestone:

- l’écran `Chat` expose un bouton micro avec états `idle`, `listening`, `speaking`
- l’utilisateur peut démarrer, arrêter et interrompre (`barge_in`) une session voix depuis l’UI
- la transcription temps réel s’affiche dans l’interface
- l’état VAD (`speaking`/`silence`) est visible dans l’UI
- l’état `speaking` est dérivé côté React à partir de la timeline de session, pas d’un nouveau signal backend
- l’implémentation reste compatible avec le transport WebSocket actuel et n’étend pas le contrat pour capturer l’audio navigateur
- les tests frontend couvrent les nouveaux hooks, les sérialisations WebSocket voix et l’intégration visuelle minimale

## Current State Analysis

### Backend et contrat déjà disponibles

- `tasks.md` indique `M2.2` terminé et `M2.3` encore vide.
- `antaerus/interfaces/gateway_go/internal/http/websocket.go` gère déjà `voice.start`, `voice.stop` et `voice.barge_in`.
- `antaerus/interfaces/gateway_go/internal/http/voice_proxy.go` relaie déjà `voice.transcript` et `voice.vad_state` puis `chat.token`/`chat.complete`.
- `antaerus/kernel/schemas/websocket-server-message.schema.json` et `antaerus/interfaces/web/src/lib/ws.ts` exposent déjà les types `voice.transcript`, `voice.audio` et `voice.vad_state`.
- décision produit déjà validée: la capture micro et la lecture TTS restent locales côté `engine_rust`; `voice.audio` reste réservé et ne doit pas être consommé dans `M2.3`.

### Frontend actuel

- `antaerus/interfaces/web/src/pages/Chat.tsx` n’affiche aujourd’hui qu’une UI texte avec `MessageInput`, `MessageBubble` et des boutons de connexion.
- `antaerus/interfaces/web/src/hooks/useWebSocket.ts` ne sait aujourd’hui que:
  - ouvrir la socket
  - envoyer `chat.message`
  - consommer `chat.token`, `chat.complete` et `health.heartbeat`
- `antaerus/interfaces/web/src/store/useAppStore.ts` ne stocke aucun état voix, aucun transcript live, aucun état VAD, aucun mode voix.
- `antaerus/interfaces/web/src/components/MessageInput.tsx` est un simple textarea + bouton `Envoyer`.
- il n’existe encore aucun fichier:
  - `components/VoiceButton.tsx`
  - `components/VoiceVisualizer.tsx`
  - `components/VoiceTranscript.tsx`
  - `hooks/useVoiceStream.ts`
  - `hooks/useVAD.ts`

### Contradiction résolue

- `tasks.md` mentionne `VoiceVisualizer` avec `Web Audio API`, mais la décision produit confirmée pour `M2.3` est de garder une UI de télécommande/visualisation du pipeline Rust local.
- en conséquence, `M2.3` ne doit pas implémenter de capture micro navigateur ni de transport PCM/MediaRecorder vers le backend.
- le visualiseur sera donc piloté par l’état de session et le VAD reçu du backend, pas par un vrai flux audio du navigateur.

## Assumptions & Decisions

- `M2.3` reste limité au frontend React et à l’adaptation des types/store/hooks associés; pas d’évolution gateway ou Rust dans ce jalon.
- le bouton voix sera intégré à la zone de saisie actuelle pour regrouper `envoyer`, `micro`, `stop` et `barge-in`.
- les états UI retenus sont:
  - `idle`: aucune session voix active
  - `listening`: session voix active avec attente ou VAD `silence`
  - `speaking`: état dérivé quand l’assistant est en train de répondre côté UI, de la première activité assistant jusqu’à la fin logique de réponse
- `speaking` sera dérivé côté React de la timeline suivante:
  - démarrage sur transcript final qui déclenche la réponse assistant, ou sur premier `chat.token`
  - fin sur `chat.complete`, `voice.stop`, `voice.barge_in`, erreur ou déconnexion
- `voice.audio` reste ignoré dans `M2.3`.
- le `VoiceVisualizer` utilisera une animation déterministe basée sur le mode voix et l’état VAD, pas un `AnalyserNode` branché sur le micro.
- `M2.3` ne modifie pas le mode `sse-dev`; la voix est disponible uniquement quand `chatTransport === "ws"`.

## Proposed Changes

### 1. Étendre les helpers WebSocket pour la voix

Fichiers:

- `antaerus/interfaces/web/src/lib/ws.ts`
- `antaerus/interfaces/web/src/hooks/useWebSocket.test.ts`

What:

- ajouter des helpers de sérialisation pour:
  - `createVoiceStartEnvelope(sessionId)`
  - `createVoiceStopEnvelope(sessionId)`
  - `createVoiceBargeInEnvelope(sessionId)`
- typer explicitement les événements serveur déjà existants pour faciliter leur consommation depuis les hooks voix.

Why:

- `useWebSocket.ts` ne doit plus construire uniquement `chat.message`; il faut une API claire et testable pour les commandes voix.

How:

- conserver `buildWebSocketUrl()` et `parseWebSocketServerMessage()`.
- compléter les tests existants pour vérifier la sérialisation de `voice.start`, `voice.stop` et `voice.barge_in`.

### 2. Introduire un état voix dans le store global

Fichiers:

- `antaerus/interfaces/web/src/store/useAppStore.ts`
- éventuellement `antaerus/interfaces/web/src/lib/chat.ts` si un message système synthétique doit être stocké

What:

- ajouter un slice voix avec au minimum:
  - `voiceMode: "idle" | "listening" | "speaking"`
  - `voiceSessionActive: boolean`
  - `voiceTranscript: string`
  - `voiceVADState: "speaking" | "silence" | null`
  - `voiceLastUpdatedAt` ou équivalent pour piloter l’animation
- ajouter les actions:
  - `setVoiceMode(...)`
  - `setVoiceSessionActive(...)`
  - `setVoiceTranscript(...)`
  - `appendVoiceTranscript(...)` si besoin
  - `setVoiceVADState(...)`
  - `resetVoiceState()`

Why:

- `Chat.tsx`, `VoiceButton`, `VoiceVisualizer`, `VoiceTranscript` et les hooks doivent partager le même état de session.

How:

- garder le store texte existant intact.
- remettre à zéro l’état voix lors de `disconnect()`, `resetSession()` et changement de session.

### 3. Étendre `useWebSocket` pour consommer et émettre les événements voix

Fichiers:

- `antaerus/interfaces/web/src/hooks/useWebSocket.ts`
- `antaerus/interfaces/web/src/hooks/useWebSocket.test.ts`

What:

- ajouter des méthodes publiques:
  - `sendVoiceStart()`
  - `sendVoiceStop()`
  - `sendVoiceBargeIn()`
- consommer les messages entrants:
  - `voice.transcript`
  - `voice.vad_state`
  - `system.alert` si utile pour erreurs voix
- mettre à jour le store voix selon la timeline retenue.

Why:

- le hook WebSocket est déjà le point unique de connexion et de parsing temps réel côté frontend.

How:

- sur `voice.start`:
  - ouvrir la connexion si besoin
  - basculer l’état vers `listening`
- sur `voice.transcript`:
  - remplacer le transcript live de la session
  - si transcript non vide et assistant en train de répondre, conserver `speaking`
- sur `voice.vad_state`:
  - stocker `speaking` ou `silence`
  - si UI non en mode assistant, refléter `listening`
- sur `chat.token`:
  - continuer à appeler `appendAssistantChunk`
  - forcer l’état voix à `speaking`
- sur `chat.complete`:
  - finaliser le message assistant
  - revenir à `listening` si la session voix reste active, sinon `idle`
- sur `disconnect()`:
  - réinitialiser l’état voix.

### 4. Créer le hook d’orchestration `useVoiceStream`

Fichiers:

- `antaerus/interfaces/web/src/hooks/useVoiceStream.ts`
- nouveau test: `antaerus/interfaces/web/src/hooks/useVoiceStream.test.ts`

What:

- créer un hook dédié qui encapsule:
  - la disponibilité voix (`config.chatTransport === "ws"`)
  - les handlers `startVoice()`, `stopVoice()`, `bargeIn()`
  - les états dérivés `isVoiceAvailable`, `canStart`, `canStop`, `canBargeIn`
  - les libellés/actions pour les composants UI

Why:

- éviter de surcharger `Chat.tsx` avec la logique de transition d’état.

How:

- `useVoiceStream` consomme `useWebSocket(sessionId)` et le slice voix du store.
- il ne capture aucun media navigateur.
- il centralise les transitions:
  - `idle -> listening` sur `startVoice`
  - `listening -> idle` sur `stopVoice`
  - `speaking/listening -> listening` après `bargeIn` si session relancée, sinon selon le retour du socket

### 5. Créer le hook `useVAD`

Fichiers:

- `antaerus/interfaces/web/src/hooks/useVAD.ts`
- nouveau test: `antaerus/interfaces/web/src/hooks/useVAD.test.ts`

What:

- créer un hook de lecture/normalisation du VAD pour l’UI.

Why:

- `VoiceVisualizer` et `VoiceButton` auront besoin d’un état simple et stable.

How:

- exposer par exemple:
  - `vadState`
  - `isSpeaking`
  - `isSilent`
  - `visualizerLevel`
- `visualizerLevel` sera dérivé de `voiceMode` + `voiceVADState`:
  - `idle`: repos
  - `listening + silence`: faible pulsation
  - `listening + speaking`: pulsation plus forte
  - `speaking`: animation assistant plus régulière

### 6. Créer les composants UI voix

Fichiers:

- `antaerus/interfaces/web/src/components/VoiceButton.tsx`
- `antaerus/interfaces/web/src/components/VoiceVisualizer.tsx`
- `antaerus/interfaces/web/src/components/VoiceTranscript.tsx`
- nouveaux tests:
  - `antaerus/interfaces/web/src/components/VoiceButton.test.tsx`
  - `antaerus/interfaces/web/src/components/VoiceVisualizer.test.tsx`
  - `antaerus/interfaces/web/src/components/VoiceTranscript.test.tsx`

What:

- `VoiceButton.tsx`
  - bouton principal micro
  - états visuels `idle`, `listening`, `speaking`
  - bouton secondaire `Interrompre` ou variante visuelle pour `barge_in`
- `VoiceVisualizer.tsx`
  - visualiseur animé à base de barres/ondes UI
  - animation pilotée par `visualizerLevel`, sans vraie source audio navigateur
- `VoiceTranscript.tsx`
  - bloc de transcription temps réel
  - libellés type `Écoute...`, `Silence`, `Réponse en cours...`

Why:

- les responsabilités UI doivent rester atomiques et testables.

How:

- utiliser les patterns de style existants (`rounded-[28px]`, `border-white/10`, `bg-slate-950/70`) pour rester cohérent avec `Chat.tsx` et `MessageInput.tsx`.
- utiliser `lucide-react` pour les icônes (`Mic`, `Square`, `AudioLines`, `PauseCircle` ou équivalent disponible).
- rendre les composants accessibles:
  - `aria-pressed`
  - `aria-live="polite"` pour le transcript
  - labels explicites pour `Démarrer`, `Arrêter`, `Interrompre`

### 7. Intégrer la Voice UI dans `MessageInput` et `Chat`

Fichiers:

- `antaerus/interfaces/web/src/components/MessageInput.tsx`
- `antaerus/interfaces/web/src/pages/Chat.tsx`
- `antaerus/interfaces/web/src/pages/Chat.test.tsx`
- éventuellement `antaerus/interfaces/web/src/components/MessageInput.test.tsx`

What:

- intégrer les contrôles voix à la zone de saisie.
- afficher le transcript et le visualiseur à proximité immédiate de l’input, pas dans la colonne système.
- ajouter un état vide/disabled quand:
  - le transport n’est pas `ws`
  - la socket n’est pas connectée et la reconnexion échoue

Why:

- la zone de saisie est déjà l’endroit naturel pour les actions conversationnelles.

How:

- `Chat.tsx` instancie `useVoiceStream(sessionId)` et passe les props utiles à `MessageInput`.
- `MessageInput.tsx` devient une barre mixte texte + voix:
  - textarea existante conservée
  - bouton micro principal
  - bouton `Interrompre` visible seulement en `speaking`
  - transcript/visualizer juste au-dessus ou au-dessous de la zone d’action
- conserver la compatibilité texte pure si la voix n’est pas disponible.

### 8. Ajouter la couverture de tests frontend

Fichiers:

- `antaerus/interfaces/web/src/hooks/useWebSocket.test.ts`
- `antaerus/interfaces/web/src/hooks/useVoiceStream.test.ts`
- `antaerus/interfaces/web/src/hooks/useVAD.test.ts`
- `antaerus/interfaces/web/src/components/VoiceButton.test.tsx`
- `antaerus/interfaces/web/src/components/VoiceTranscript.test.tsx`
- `antaerus/interfaces/web/src/pages/Chat.test.tsx`

What:

- couvrir les transitions d’état principales de `M2.3`.

Why:

- l’essentiel du travail se situe dans l’orchestration UI; sans tests, les régressions seront rapides.

How:

- cas minimum à couvrir:
  - sérialisation `voice.start`, `voice.stop`, `voice.barge_in`
  - réception `voice.transcript` met à jour le transcript live
  - réception `voice.vad_state` met à jour l’état VAD
  - réception `chat.token` force `speaking`
  - réception `chat.complete` rebascule correctement vers `listening`
  - `VoiceButton` change de libellé et d’état visuel selon `voiceMode`
  - `VoiceTranscript` affiche le transcript actif ou un placeholder lisible

### 9. Mettre à jour le backlog vivant

Fichiers:

- `tasks.md`

What:

- cocher les tâches `M2.3` effectivement livrées.
- ajouter un bloc `État actuel` résumant le mode choisi: UI de télécommande Rust local, sans capture micro navigateur.

Why:

- le projet impose `tasks.md` comme source de vérité.

How:

- expliciter que `VoiceVisualizer` de `M2.3` est un visualiseur d’état et non un oscilloscope navigateur branché sur un vrai flux micro.

## Implementation Order

1. Étendre `lib/ws.ts` avec les helpers voix.
2. Ajouter le slice voix dans `useAppStore.ts`.
3. Étendre `useWebSocket.ts` pour consommer/émettre les événements voix.
4. Créer `useVoiceStream.ts`.
5. Créer `useVAD.ts`.
6. Implémenter `VoiceButton.tsx`, `VoiceVisualizer.tsx`, `VoiceTranscript.tsx`.
7. Intégrer la UI voix dans `MessageInput.tsx` puis `Chat.tsx`.
8. Ajouter/adapter les tests frontend.
9. Mettre à jour `tasks.md`.

## Verification Steps

### Validation frontend

- `npm run check`
- `npm run test`
- `npm run lint`

### Vérifications fonctionnelles ciblées

- en mode `ws`, cliquer sur le bouton micro envoie `voice.start`
- un transcript entrant met à jour `VoiceTranscript`
- un `voice.vad_state = speaking` anime plus fort le visualiseur
- un `chat.token` fait passer le bouton en mode `speaking`
- `chat.complete` remet l’UI en `listening` si la session voix reste active
- cliquer sur `Arrêter` envoie `voice.stop`
- cliquer sur `Interrompre` envoie `voice.barge_in`
- en mode `sse-dev`, la voix est désactivée avec un libellé clair

### Risques connus

- sans signal backend explicite de lecture TTS réelle, l’état `speaking` reste une approximation UI volontairement choisie.
- `voice.audio` ne sera pas exploité tant que la décision produit reste `TTS local Rust`.
- le terme `Web Audio API` dans `tasks.md` doit être interprété ici comme visualisation UI du cycle voix, pas comme capture micro navigateur.
