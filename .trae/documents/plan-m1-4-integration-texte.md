# Plan d'exécution — `M1.4` Intégration texte

## Résumé

Objectif : livrer le premier flux texte réellement intégré de bout en bout :

- `React -> Go WebSocket -> Python LLM -> Go -> React` avec streaming token par token ;
- persistance d'historique de conversation en SQLite ;
- rechargement de l'historique d'une session ;
- isolation multi-session via `sessionId` ;
- validation automatisée et smoke test local.

Décisions verrouillées :

- persistance : **SQLite dédié dans le `brain_python`** avec tables conversationnelles distinctes ;
- auth navigateur : **endpoint Go de JWT de développement** ;
- validation : **tests automatisés + smoke test local**.

Succès attendu :

- un message envoyé depuis l'UI `Chat` déclenche un vrai flux WS côté Go ;
- le gateway appelle le brain Python, relaie les tokens en `chat.token`, puis clôture en `chat.complete` ;
- les messages utilisateur et assistant sont persistés dans le SQLite du brain, regroupés par session ;
- l'UI peut recharger l'historique de la session active via le gateway ;
- deux sessions distinctes restent isolées dans les tests ;
- le dépôt contient une preuve automatisée et une preuve smoke du flux complet.

## Analyse de l'état actuel

### Backlog cible

Dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L160-L164), `M1.4` demande :

- connecter `React -> Go WebSocket -> Python LLM -> Go -> React (streaming)` ;
- persister l'historique chat en SQLite ;
- tester l'end-to-end `< 2s` ;
- tester le multi-session avec contexte isolé.

### État réel observé dans le dépôt

- [websocket.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/websocket.go) accepte bien `chat.message`, mais renvoie encore un placeholder `chat.complete` au lieu de brancher le brain.
- [python_client.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/clients/python_client.go) ne couvre actuellement que santé + capabilities.
- [api/llm.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/llm.py) expose déjà `/llm/chat` et `/llm/stream`, mais sans gestion de session/historique persistant.
- [memory/schemas.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/memory/schemas.py) et [memory/kernel.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py) gèrent déjà `events`, `facts` et `session_id` au niveau des events, mais pas encore de tables conversationnelles dédiées.
- [Chat.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/pages/Chat.tsx) sait déjà envoyer un `chat.message` sur WebSocket et consommer un mode `sse-dev`, mais ne recharge pas d'historique persistant ni ne dépend encore d'un vrai proxy Go -> Python.
- [useAppStore.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/store/useAppStore.ts) maintient un tableau de messages local pour une session active, sans synchronisation serveur.
- [websocket_test.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/websocket_test.go) vérifie aujourd'hui le placeholder `chat.complete`.

### Contrainte d'architecture

Le CDC fixe déjà les points suivants :

- `F-101` : interface conversation texte avec historique ;
- `F-102` : streaming réponses token par token ;
- `F-103` : support multi-session avec contexte ;
- `session ID` géré par Go ;
- le brain Python reste la couche naturelle pour le LLM et le SQLite conversationnel.

## Hypothèses et décisions

- Le SQLite de conversation reste dans `brain_python`, à côté de la mémoire existante, afin d'éviter une deuxième source de vérité côté gateway.
- La persistance de chat utilise un sous-schéma dédié, distinct des `facts` et des `events`, pour rester lisible et exploitable ensuite par les lots suivants.
- Le gateway Go devient le proxy unique vu du navigateur pour :
  - l'ouverture WebSocket ;
  - l'émission d'un JWT de développement ;
  - le chargement d'historique de session.
- Le brain reçoit une requête session-aware qui lui permet de :
  - charger le contexte de session ;
  - appeler le LLM ;
  - persister les tours utilisateur/assistant ;
  - streamer les événements au gateway.
- `M1.4` garde le mode `sse-dev` comme outil secondaire si utile, mais le flux cible de l'écran `Chat` devient le flux WebSocket via Go.
- Le test de performance `< 2s` est traité comme un smoke local mesuré sur le flux intégré, pas comme une garantie de benchmark universelle en environnement variable.

## Changements proposés

### 1. Étendre le schéma conversationnel du brain

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/memory/schemas.py`
- `antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py`
- `antaerus/providers/brain_python/src/antaerus_brain/memory/__init__.py`

#### Action

- ajouter des tables dédiées :
  - `chat_sessions`
  - `chat_messages`
- conserver `events` / `facts` inchangés pour la mémoire atomique ;
- enrichir `MemoryKernel` avec des opérations conversationnelles :
  - créer/garantir une session ;
  - ajouter un message utilisateur/assistant ;
  - lister les messages d'une session dans l'ordre ;
  - reconstruire le contexte LLM d'une session ;
  - éventuellement exposer un résumé minimal du thread de session.

#### Pourquoi

- `M1.4` demande un historique SQLite et une isolation multi-session ;
- ce sous-schéma dédié est plus robuste que de détourner `events`.

### 2. Ajouter un flux session-aware dans l'API Python

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/api/llm.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/streaming.py`

#### Fichiers à créer

- `antaerus/providers/brain_python/src/antaerus_brain/chat.py`

#### Action

- introduire un service applicatif dédié au chat texte de session :
  - charge l'historique de session ;
  - construit `GenerationRequest.messages` ;
  - persiste le message utilisateur ;
  - stream les tokens du LLM ;
  - persiste le message assistant final ;
- exposer un endpoint interne session-aware, par exemple :
  - `POST /llm/session-stream`
- définir explicitement le payload entrant :
  - `sessionId`
  - `message`
  - `provider` optionnel
- définir les événements streamés attendus pour Go :
  - `token`
  - `complete`
  - `error`

#### Pourquoi

- le gateway a besoin d'un point d'entrée unique qui gère à la fois le contexte et la persistance ;
- cela évite de répartir l'intelligence conversationnelle entre Go et Python.

### 3. Exposer la lecture d'historique côté brain

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/api/memory.py`
- `antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py`

#### Action

- exposer un endpoint interne de lecture d'historique de session, par exemple :
  - `GET /memory/chat/sessions/{session_id}`
- retourner un payload ordonné des messages persistés avec :
  - rôle
  - contenu
  - horodatage
  - sessionId

#### Pourquoi

- le gateway doit pouvoir recharger l'historique pour le frontend ;
- l'UI doit pouvoir retrouver une session persistée après rechargement.

### 4. Introduire un vrai client Go vers le chat Python

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/clients/brain_chat_client.go`

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/clients/python_client.go`
- éventuellement `antaerus/interfaces/gateway_go/internal/system/health.go` uniquement si un wiring commun devient utile

#### Action

- ajouter un client Go dédié au brain chat pour :
  - appeler `POST /llm/session-stream`
  - lire le flux SSE en streaming
  - charger `GET /memory/chat/sessions/{session_id}`
- définir les structures Go de transport :
  - requête chat session-aware
  - message d'historique
  - événements SSE du brain

#### Pourquoi

- le client santé/capabilities actuel est trop limité pour supporter `M1.4` ;
- le parsing SSE doit être centralisé et testé côté Go.

### 5. Brancher le proxy Python -> Go -> WebSocket

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/http/websocket.go`
- `antaerus/interfaces/gateway_go/internal/contracts/websocket.go`
- `antaerus/interfaces/gateway_go/internal/http/routes.go`

#### Action

- remplacer le placeholder `chat.complete` dans `handleMessage()` par un vrai appel au brain ;
- sur réception d'un `chat.message` :
  - appeler le client Go vers `POST /llm/session-stream`
  - relayer chaque token Python en `chat.token`
  - relayer la fin en `chat.complete`
  - relayer les erreurs en `system.alert` ou en événement WS dédié si nécessaire
- préserver le `sessionId` de bout en bout.

#### Pourquoi

- c'est le cœur fonctionnel de `M1.4`.

### 6. Ajouter un endpoint Go de JWT de développement

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/http/dev_auth.go`

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/http/routes.go`
- `antaerus/interfaces/gateway_go/internal/http/auth.go`

#### Action

- exposer un endpoint minimal de développement, par exemple :
  - `POST /api/v1/auth/dev-token`
- réutiliser `Authenticator.IssueToken()` ;
- fixer un payload simple, par exemple :
  - `subject`
  - `role`
- garder la portée clairement développement/local, sans prétendre livrer une auth complète.

#### Pourquoi

- l'utilisateur a explicitement choisi un endpoint dev token pour fluidifier l'e2e.

### 7. Exposer un endpoint Go de lecture d'historique de session

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/http/chat_history.go`

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/http/routes.go`

#### Action

- exposer un endpoint frontend-friendly, par exemple :
  - `GET /api/v1/chat/sessions/{session_id}`
- le handler appelle le brain et retourne l'historique ordonné de la session.

#### Pourquoi

- l'UI ne doit pas parler directement au brain pour le flux principal `M1.4`.

### 8. Mettre à niveau l'UI `Chat` pour le vrai flux intégré

#### Fichiers à modifier

- `antaerus/interfaces/web/src/pages/Chat.tsx`
- `antaerus/interfaces/web/src/store/useAppStore.ts`
- `antaerus/interfaces/web/src/hooks/useWebSocket.ts`
- `antaerus/interfaces/web/src/hooks/useSession.ts`
- `antaerus/interfaces/web/src/lib/api.ts`
- `antaerus/interfaces/web/src/lib/chat.ts`

#### Action

- faire du mode WebSocket Go le flux principal par défaut ;
- récupérer un JWT de développement via le nouvel endpoint Go au lieu de dépendre uniquement d'une saisie manuelle ;
- charger l'historique de la session active via `GET /api/v1/chat/sessions/{session_id}` ;
- remplacer ou compléter l'état de store pour :
  - hydrater une session depuis le backend ;
  - éviter les doublons lors du rechargement ;
  - marquer proprement les messages streamés puis finalisés ;
- conserver `sessionId` stable dans le navigateur, avec capacité de reset explicite.

#### Pourquoi

- `M1.4` doit matérialiser une vraie conversation persistée, pas seulement un flux éphémère.

### 9. Ajuster `Setup` au nouveau flux d'auth et de chat

#### Fichiers à modifier

- `antaerus/interfaces/web/src/pages/Setup.tsx`
- `antaerus/interfaces/web/src/components/ApiKeyInput.tsx`
- `antaerus/interfaces/web/src/lib/setup.ts`

#### Action

- garder les réglages locaux existants ;
- ajouter une action UI pour générer/rafraîchir un JWT de dev via le gateway ;
- clarifier dans l'écran que :
  - le flux intégré passe maintenant par Go ;
  - le mode `sse-dev` devient un mode secondaire de développement si conservé.

#### Pourquoi

- l'UI doit refléter la bascule d'un mode transitoire `M1.3` vers le vrai flux `M1.4`.

### 10. Ajouter les tests Python ciblés

#### Fichiers à créer ou modifier

- `antaerus/providers/brain_python/tests/test_llm_api.py`
- `antaerus/providers/brain_python/tests/test_memory_kernel.py`
- `antaerus/providers/brain_python/tests/test_memory_api.py`
- `antaerus/providers/brain_python/tests/test_chat_session.py`

#### Action

- couvrir :
  - création de session ;
  - persistance de messages utilisateur/assistant ;
  - reconstruction du contexte `GenerationRequest.messages` ;
  - endpoint `session-stream` ;
  - lecture d'historique de session ;
  - isolation de deux sessions distinctes.

#### Pourquoi

- la logique critique de persistance et de contexte vivra côté Python.

### 11. Ajouter les tests Go ciblés

#### Fichiers à créer ou modifier

- `antaerus/interfaces/gateway_go/internal/http/websocket_test.go`
- `antaerus/interfaces/gateway_go/internal/http/routes_test.go`
- `antaerus/interfaces/gateway_go/internal/http/dev_auth_test.go`
- `antaerus/interfaces/gateway_go/internal/http/chat_history_test.go`
- `antaerus/interfaces/gateway_go/internal/clients/brain_chat_client_test.go`

#### Action

- couvrir :
  - émission du JWT de dev ;
  - proxy SSE Python -> WS Go ;
  - émission réelle de `chat.token` puis `chat.complete` ;
  - récupération de l'historique de session ;
  - isolation multi-session via deux `sessionId` distincts.

#### Pourquoi

- le cœur de `M1.4` passe par la logique de proxy et de fan-out Go.

### 12. Ajouter les tests frontend ciblés

#### Fichiers à créer ou modifier

- `antaerus/interfaces/web/src/hooks/useWebSocket.test.ts`
- `antaerus/interfaces/web/src/pages/Chat.test.tsx`
- `antaerus/interfaces/web/src/hooks/useSession.test.ts`
- `antaerus/interfaces/web/src/lib/api.test.ts`

#### Action

- couvrir :
  - récupération du JWT de dev ;
  - hydratation d'historique de session ;
  - affichage progressif d'une réponse streamée ;
  - rechargement d'une session existante ;
  - reset vers une nouvelle session vide.

#### Pourquoi

- l'UI doit démontrer qu'elle exploite réellement le flux intégré et l'historique persistant.

### 13. Ajouter un smoke test local `M1.4`

#### Fichiers à créer

- `antaerus/scripts/validation/smoke-text-chat.ps1`
- `antaerus/scripts/validation/smoke-text-chat.sh`

#### Action

- automatiser un smoke local qui :
  - génère un JWT de dev ;
  - ouvre une session ;
  - envoie un message ;
  - vérifie qu'au moins un token et un message final reviennent ;
  - mesure grossièrement le temps entre envoi et fin ;
  - vérifie qu'une seconde session ne récupère pas l'historique de la première.

#### Pourquoi

- l'utilisateur a explicitement choisi une validation `tests auto + smoke`.

### 14. Synchroniser documentation et backlog

#### Fichiers à modifier

- `antaerus/interfaces/web/README.md`
- `antaerus/providers/brain_python/README.md`
- éventuellement `antaerus/README.md` si les commandes de démonstration changent réellement
- `tasks.md`

#### Action

- documenter :
  - le nouveau flux texte intégré ;
  - l'endpoint de dev token ;
  - le chargement d'historique par session ;
  - le smoke test `M1.4` ;
- mettre `tasks.md` à jour seulement après validations réelles.

#### Pourquoi

- `M1.4` change le mode de fonctionnement du chat de façon visible pour l'équipe.

## Interfaces et comportements décidés

### Endpoint Python principal

- `POST /llm/session-stream`
  - entrée :
    - `sessionId`
    - `message`
    - `provider` optionnel
  - sortie :
    - flux SSE `token` / `complete` / `error`

### Lecture d'historique Python

- `GET /memory/chat/sessions/{session_id}`

### Endpoints Go ajoutés

- `POST /api/v1/auth/dev-token`
- `GET /api/v1/chat/sessions/{session_id}`

### Flux cible navigateur

1. L'UI obtient un JWT de développement depuis Go.
2. L'UI ouvre `/api/v1/ws?token=...`.
3. L'UI envoie `chat.message` avec `sessionId`.
4. Go appelle Python `POST /llm/session-stream`.
5. Python charge l'historique, génère, persiste et stream.
6. Go relaie en `chat.token` puis `chat.complete`.
7. L'UI recharge si nécessaire `GET /api/v1/chat/sessions/{session_id}`.

### Persistance SQLite retenue

- base : `antaerus/memory_data/antaerus_memory.db`
- nouvelles tables :
  - `chat_sessions`
  - `chat_messages`

### Hors portée volontaire

- auth complète utilisateur ;
- partage texte/voix complet ;
- export conversation ;
- tuning avancé de prompts ou résumés de contexte ;
- vectorisation/retrieval conversationnel avancé.

## Séquence d'exécution recommandée

1. Étendre le schéma SQLite conversationnel du brain.
2. Implémenter le service Python de session chat + endpoints internes.
3. Créer le client Go de chat Python.
4. Brancher le proxy SSE -> WebSocket dans `websocket.go`.
5. Ajouter le dev token endpoint et l'historique session côté Go.
6. Mettre à jour le frontend pour consommer le flux intégré et hydrater l'historique.
7. Ajouter tests Python, Go et frontend.
8. Ajouter le smoke test local `M1.4`.
9. Rejouer validations complètes.
10. Mettre à jour `tasks.md` et la documentation.

## Vérifications

### Python

- `python -m mypy src tests`
- `python -m pytest tests`
- `python -m ruff check .`

### Web

- `npm run lint`
- `npm run check`
- `npm run test`
- `npm run build`

### Go

- `go test ./interfaces/gateway_go/...`

### Smoke

- `powershell -ExecutionPolicy Bypass -File .\scripts\validation\smoke-text-chat.ps1`
- `bash ./scripts/validation/smoke-text-chat.sh`

### Contrôles attendus

- un message UI reçoit bien des `chat.token` avant `chat.complete` ;
- l'historique d'une session survit au rechargement ;
- deux sessions distinctes n'échangent pas leur contexte ;
- le smoke test local reste sous l'objectif `< 2s` sur l'environnement de validation.

## Résultat attendu

À la fin de `M1.4`, `aNtaerus` dispose de son premier chat texte réellement intégré :

- flux WebSocket navigateur -> Go -> Python -> Go -> navigateur ;
- streaming token par token ;
- historique SQLite persistant ;
- sessions isolées ;
- validation technique et smoke reproductibles.
