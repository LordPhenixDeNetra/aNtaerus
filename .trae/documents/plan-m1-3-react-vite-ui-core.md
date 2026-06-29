# Plan d'exécution — `M1.3` React + Vite (UI Core)

## Résumé

Objectif : faire passer `antaerus/interfaces/web/` d'un dashboard de fondation à une UI cœur exploitable pour le texte, en livrant les briques demandées par `M1.3` :

- état applicatif `Zustand` ;
- cache server state via `TanStack Query` ;
- pages `Chat` et `Setup` ;
- composants `MessageBubble`, `MessageInput`, `ApiKeyInput` ;
- hooks `useWebSocket`, `useChatStream`, `useSession` ;
- build statique Vite servie par Go.

Décisions verrouillées :

- périmètre : **lot complet `M1.3`** ;
- wizard `Setup` : **stockage local navigateur** ;
- auth WebSocket : **jeton dev local** fourni/configuré côté UI ;
- hook SSE : **mode dev direct vers `brain_python`** ;
- build servie par Go : **fichiers `dist` servis via `http.FileServer`**.

Succès attendu :

- l'UI web n'affiche plus `FoundationDashboard` comme écran principal ;
- `Chat` et `Setup` sont navigables ;
- le chat sait ouvrir le WebSocket Go avec un JWT de dev et afficher les messages/token placeholders déjà exposés par le gateway ;
- le hook SSE existe et peut streamer directement depuis `brain_python` en mode développement ;
- le wizard `Setup` permet de stocker localement l'identité, les préférences de provider et les secrets saisis côté navigateur ;
- la build Vite est générée de façon compatible avec un service statique côté gateway Go ;
- `tasks.md` pourra ensuite être mis à jour sur une base validée.

## Analyse de l'état actuel

### Backlog cible

Dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L136-L152), `M1.3` demande :

- `Zustand`
- `TanStack Query`
- `pages/Chat.tsx`
- `components/MessageBubble.tsx`
- `components/MessageInput.tsx`
- `hooks/useWebSocket.ts`
- `hooks/useChatStream.ts`
- `hooks/useSession.ts`
- `pages/Setup.tsx`
- `components/ApiKeyInput.tsx`
- build statique servie par Go

### État réel observé dans le dépôt

- [package.json](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/package.json) contient `zustand`, mais pas `@tanstack/react-query`.
- [App.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/App.tsx) ne route aujourd'hui que `/` vers [FoundationDashboard.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/pages/FoundationDashboard.tsx).
- [Home.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/pages/Home.tsx) est vide.
- [lib/ws.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/ws.ts) contient déjà le contrat TypeScript du WebSocket Go (`chat.message`, `chat.token`, `chat.complete`, `health.heartbeat`, etc.).
- [lib/api.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/api.ts) ne couvre aujourd'hui que l'état système.
- [vite.config.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/vite.config.ts) ne configure encore ni `outDir` spécifique, ni stratégie de build alignée avec un service statique Go.
- [README.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/README.md) est encore le README générique Vite.
- Côté Go, [routes.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/routes.go) expose `/health`, `/api/v1/health`, `/api/v1/system/services`, `/api/v1/system/status` et `/api/v1/ws`, mais aucune route de service de fichiers statiques ni endpoint de config/auth navigateur.

### Contexte backend réellement disponible

- Le gateway Go a déjà un WebSocket opérationnel sur `GET /api/v1/ws?token=<jwt>`.
- Le brain Python expose déjà `POST /llm/stream`, mais directement côté service Python, pas via le gateway.
- Il n'existe pas encore :
  - d'endpoint Go d'émission de JWT pour le navigateur ;
  - d'endpoint Go de persistance de configuration UI ;
  - de proxy SSE Go -> Python final pour le chat.

## Hypothèses et décisions

- `M1.3` reste principalement centré sur `antaerus/interfaces/web/`, avec seulement les ajustements Go minimaux nécessaires pour servir la build frontend.
- Le stockage de configuration du wizard `Setup` se fait dans le navigateur, via une couche de persistance locale, sans prétendre configurer le runtime serveur.
- Les secrets saisis dans `Setup` ne sont pas envoyés au backend dans ce lot ; ils servent au mode local de l'UI et à la préparation du lot suivant.
- Le JWT WebSocket est traité comme un jeton de développement local : sa valeur est saisie/stockée côté UI, puis passée au hook WebSocket.
- `useChatStream.ts` parle directement à `brain_python` en développement via une URL configurable côté navigateur ; ce hook existe dès `M1.3` mais n'impose pas encore un proxy Go.
- La build Vite reste produite dans `antaerus/interfaces/web/dist/`, puis servie par le gateway Go via `http.FileServer`.
- Le routage UI retenu pour ce lot est simple et explicite :
  - `/` -> `Chat`
  - `/setup` -> `Setup`

## Changements proposés

### 1. Mettre à niveau les dépendances frontend et le bootstrap applicatif

#### Fichiers à modifier

- `antaerus/interfaces/web/package.json`
- `antaerus/interfaces/web/src/main.tsx`
- `antaerus/interfaces/web/src/App.tsx`
- `antaerus/interfaces/web/src/App.test.tsx`

#### Action

- ajouter `@tanstack/react-query` aux dépendances ;
- initialiser `QueryClientProvider` dans `main.tsx` ;
- remplacer le routage actuel mono-page par un routage réel `Chat` / `Setup` ;
- adapter le test d'application pour vérifier la nouvelle page par défaut et/ou la navigation principale.

#### Pourquoi

- `TanStack Query` est explicitement demandé par le backlog ;
- le bootstrap doit accueillir la couche de cache et la navigation réelle.

### 2. Introduire un état applicatif métier avec `Zustand`

#### Fichiers à créer

- `antaerus/interfaces/web/src/store/useAppStore.ts`
- `antaerus/interfaces/web/src/lib/storage.ts`

#### Action

- centraliser dans `Zustand` :
  - session active ;
  - configuration locale du setup ;
  - messages du chat ;
  - état de connexion WebSocket ;
  - mode d'interaction sélectionné (`ws` / `sse-dev` si nécessaire) ;
- persister localement les préférences du wizard (`identity`, `provider`, `brainBaseUrl`, `gatewayBaseUrl`, `devToken`, flags UI) ;
- isoler la lecture/écriture navigateur dans `lib/storage.ts` pour éviter la duplication dans les composants.

#### Pourquoi

- `zustand` est déjà installé et constitue la bonne couche légère pour l'état UI demandé par `M1.3`.

### 3. Ajouter les modèles de données frontend pour chat et setup

#### Fichiers à créer

- `antaerus/interfaces/web/src/lib/chat.ts`
- `antaerus/interfaces/web/src/lib/setup.ts`

#### Action

- définir les types frontend pour :
  - message de conversation (`user`, `assistant`, `system`) ;
  - brouillon de réponse streamée ;
  - configuration locale du setup ;
  - mode de connexion ;
- réutiliser les types WebSocket existants de `lib/ws.ts` plutôt que dupliquer le contrat réseau.

#### Pourquoi

- les hooks et composants de `M1.3` ont besoin d'un modèle partagé pour rester cohérents.

### 4. Implémenter `useSession.ts`

#### Fichier à créer

- `antaerus/interfaces/web/src/hooks/useSession.ts`

#### Action

- générer et maintenir un `sessionId` stable côté navigateur ;
- lier ce `sessionId` au store global ;
- permettre une réinitialisation explicite depuis l'UI si nécessaire.

#### Pourquoi

- le CDC indique que le support multi-session est géré par identifiant ;
- le WebSocket et les futurs flux SSE en dépendent déjà.

### 5. Implémenter `useWebSocket.ts`

#### Fichiers à créer ou modifier

- `antaerus/interfaces/web/src/hooks/useWebSocket.ts`
- `antaerus/interfaces/web/src/lib/ws.ts`

#### Action

- encapsuler l'ouverture du WebSocket vers `/api/v1/ws?token=...` ;
- construire l'URL à partir de la config locale (`gatewayBaseUrl`, `devToken`) ;
- exposer :
  - `connect`
  - `disconnect`
  - `sendChatMessage`
  - `connectionState`
  - derniers heartbeat/services si utile ;
- parser les événements déjà typés :
  - `chat.token`
  - `chat.complete`
  - `health.heartbeat`
  - autres événements conservés en extension.

#### Pourquoi

- le gateway offre déjà ce transport ; `M1.3` doit le rendre exploitable côté UI.

### 6. Implémenter `useChatStream.ts`

#### Fichiers à créer ou modifier

- `antaerus/interfaces/web/src/hooks/useChatStream.ts`
- `antaerus/interfaces/web/src/lib/api.ts`

#### Action

- créer un hook de streaming direct vers `brain_python` en mode développement, avec URL configurable depuis `Setup` ;
- appeler `POST /llm/stream` sur la base `brainBaseUrl` locale ;
- parser le flux `text/event-stream` et normaliser les événements `token`, `complete`, `error` ;
- exposer un contrat simple consommable par `Chat.tsx`, distinct du WebSocket.

#### Pourquoi

- le hook est demandé par `M1.3` ;
- le proxy SSE via Go n'existe pas encore, donc le mode dev direct est la meilleure solution intermédiaire déjà validée.

### 7. Implémenter les composants `MessageBubble` et `MessageInput`

#### Fichiers à créer

- `antaerus/interfaces/web/src/components/MessageBubble.tsx`
- `antaerus/interfaces/web/src/components/MessageInput.tsx`

#### Action

- `MessageBubble.tsx` :
  - afficher clairement les messages `user`, `assistant`, `system` ;
  - supporter un état `streaming` pour le message assistant en cours ;
- `MessageInput.tsx` :
  - gérer saisie, validation, désactivation pendant envoi/stream si nécessaire ;
  - exposer un callback métier sans y mélanger la logique réseau.

#### Pourquoi

- ces composants constituent la base réutilisable de `Chat.tsx`.

### 8. Implémenter `ApiKeyInput.tsx` et le wizard `Setup.tsx`

#### Fichiers à créer

- `antaerus/interfaces/web/src/components/ApiKeyInput.tsx`
- `antaerus/interfaces/web/src/pages/Setup.tsx`

#### Action

- `ApiKeyInput.tsx` :
  - champ masqué/affiché ;
  - état visuel clair ;
  - réutilisable pour Anthropic/OpenAI/Mistral/dev token ;
- `Setup.tsx` :
  - écran de configuration locale guidée ;
  - sections :
    - identité/utilisateur
    - provider par défaut
    - URLs locales (`gateway`, `brain`)
    - jeton WebSocket de dev
    - clés API locales saisies côté navigateur
  - persistance immédiate via store + `localStorage`.

#### Pourquoi

- le backlog demande explicitement `Setup` et `ApiKeyInput` ;
- aucune API backend n'existant encore, la persistance locale est la bonne forme de livraison pour `M1.3`.

### 9. Implémenter `Chat.tsx`

#### Fichiers à créer ou modifier

- `antaerus/interfaces/web/src/pages/Chat.tsx`
- `antaerus/interfaces/web/src/pages/Home.tsx`

#### Action

- faire de `Chat.tsx` l'écran principal ;
- connecter :
  - `useSession`
  - `useWebSocket`
  - `useChatStream`
  - store `Zustand`
- prévoir un mode opératoire clair :
  - mode WebSocket Go par défaut avec jeton dev ;
  - mode SSE dev direct vers `brain_python` comme fallback/outillage de développement ;
- utiliser `Home.tsx` soit comme alias simple vers `Chat`, soit le retirer du flux si devenu inutile.

#### Pourquoi

- `M1.3` vise explicitement l'interface conversation principale ;
- l'écran doit être utile même avant le branchement complet `M1.4`.

### 10. Introduire `TanStack Query` sur le server state utile

#### Fichiers à modifier

- `antaerus/interfaces/web/src/lib/api.ts`
- `antaerus/interfaces/web/src/pages/Chat.tsx`
- éventuellement `antaerus/interfaces/web/src/pages/FoundationDashboard.tsx`

#### Action

- conserver `fetchSystemStatus()` mais le consommer via `TanStack Query` au lieu d'un `useEffect` manuel quand pertinent ;
- utiliser Query pour les états réellement côté serveur :
  - santé système ;
  - éventuellement liste providers du brain si on choisit de l'exposer en dev via `brainBaseUrl` ;
- laisser le flux de chat en WebSocket/SSE hors Query.

#### Pourquoi

- `TanStack Query` est demandé pour le cache server state ;
- il ne faut pas détourner Query pour les flux temps réel qui relèvent des hooks dédiés.

### 11. Remplacer ou rétrograder `FoundationDashboard`

#### Fichiers à modifier

- `antaerus/interfaces/web/src/pages/FoundationDashboard.tsx`
- `antaerus/interfaces/web/src/App.tsx`

#### Action

- soit conserver `FoundationDashboard` comme vue secondaire/outillage ;
- soit le remplacer par `Chat` comme page racine, avec navigation visible vers `Setup` ;
- éviter de mélanger dashboard fondation et écran chat comme page unique.

#### Pourquoi

- `M1.3` doit matérialiser l'UI core, pas seulement la supervision technique.

### 12. Configurer la build statique pour Go

#### Fichiers à modifier

- `antaerus/interfaces/web/vite.config.ts`
- `antaerus/interfaces/web/package.json`
- `antaerus/interfaces/gateway_go/internal/http/routes.go`
- `antaerus/interfaces/gateway_go/internal/http/server.go`
- éventuellement `antaerus/interfaces/gateway_go/internal/http/routes_test.go`

#### Action

- côté Vite :
  - fixer proprement l'`outDir` ;
  - s'assurer que les assets générés restent compatibles avec un service statique depuis Go ;
- côté Go :
  - servir `antaerus/interfaces/web/dist/` via `http.FileServer` ;
  - conserver les routes API `/health`, `/api/*`, `/api/v1/ws` prioritaires ;
  - ajouter un fallback vers `index.html` pour le routage SPA.

#### Pourquoi

- le backlog demande explicitement une build servie par Go ;
- aucun service statique n'existe encore dans le gateway.

### 13. Étendre la couverture de tests frontend

#### Fichiers à créer ou modifier

- `antaerus/interfaces/web/src/App.test.tsx`
- `antaerus/interfaces/web/src/components/MessageBubble.test.tsx`
- `antaerus/interfaces/web/src/components/MessageInput.test.tsx`
- `antaerus/interfaces/web/src/components/ApiKeyInput.test.tsx`
- `antaerus/interfaces/web/src/hooks/useSession.test.ts`
- `antaerus/interfaces/web/src/hooks/useWebSocket.test.ts`
- `antaerus/interfaces/web/src/hooks/useChatStream.test.ts`

#### Action

- couvrir au minimum :
  - rendu de la navigation `Chat` / `Setup` ;
  - persistance locale du setup ;
  - génération et réutilisation du `sessionId` ;
  - sérialisation d'un message WebSocket `chat.message` ;
  - parsing minimal d'un flux SSE ;
  - rendu des bulles de messages.

#### Pourquoi

- `M1.3` introduit de la logique UI et temps réel suffisamment importante pour nécessiter des tests ciblés, pas seulement un test de présence du dashboard.

### 14. Mettre à jour la documentation frontend et le backlog

#### Fichiers à modifier

- `antaerus/interfaces/web/README.md`
- `tasks.md`

#### Action

- documenter :
  - routes UI ;
  - variables/paramètres de configuration locale ;
  - prérequis du mode WebSocket dev et du mode SSE direct brain ;
  - build et lancement ;
- mettre `tasks.md` à jour seulement après validations réelles.

#### Pourquoi

- le README actuel est encore générique ;
- `tasks.md` doit refléter le jalon réellement livré.

## Interfaces et comportements décidés

### Routage UI

- `/` -> `Chat`
- `/setup` -> `Setup`

### Configuration locale stockée côté navigateur

- `displayName`
- `defaultProvider`
- `gatewayBaseUrl`
- `brainBaseUrl`
- `websocketDevToken`
- clés API saisies localement

### Modes de transport du texte dans `M1.3`

- **WebSocket Go** :
  - canal principal pour l'écran `Chat`
  - nécessite un JWT de dev local
- **SSE direct brain** :
  - mode développement/outillage
  - cible `POST /llm/stream` sur `brain_python`

### Messages WebSocket utilisés en priorité

- sortant : `chat.message`
- entrants : `chat.token`, `chat.complete`, `health.heartbeat`

### Hors portée volontaire dans ce lot

- persistance serveur du wizard `Setup`
- endpoint Go d'émission de JWT navigateur
- proxy SSE final Go -> Python
- historique chat persistant SQLite côté UI
- intégration bout-en-bout finale `M1.4`

## Séquence d'exécution recommandée

1. Ajouter `TanStack Query` et refondre `App.tsx` / `main.tsx`.
2. Introduire le store `Zustand` et la persistance locale.
3. Implémenter `useSession.ts`.
4. Implémenter `useWebSocket.ts`.
5. Implémenter `useChatStream.ts`.
6. Créer `MessageBubble`, `MessageInput`, `ApiKeyInput`.
7. Créer `Setup.tsx`.
8. Créer `Chat.tsx` et en faire la route principale.
9. Ajuster ou rétrograder `FoundationDashboard`.
10. Configurer la build Vite et le service statique Go.
11. Ajouter/adapter les tests web et Go nécessaires.
12. Rejouer `lint`, `check`, `test`, puis mettre à jour `tasks.md` et `README.md`.

## Vérifications

### Frontend

- `npm run lint`
- `npm run check`
- `npm run test`
- `npm run build`

### Go

- `go test ./interfaces/gateway_go/...`

### Contrôles attendus

- l'application démarre sur un écran `Chat` au lieu du dashboard fondation ;
- `/setup` permet de saisir et retrouver les paramètres locaux ;
- l'UI peut ouvrir le WebSocket Go avec un JWT de dev local ;
- le hook SSE sait consommer `brain_python` en développement ;
- la build Vite produit un `dist` compatible avec le service statique Go ;
- le gateway sert les assets frontend sans casser les routes `/health`, `/api/*` et `/api/v1/ws`.

## Résultat attendu

À la fin de `M1.3`, le monorepo dispose d'une véritable UI cœur :

- conversation texte prête à brancher complètement en `M1.4` ;
- écran `Setup` utilisable sans backend de configuration ;
- hooks temps réel structurés ;
- état frontend métier installé ;
- build web servie par le gateway Go.
