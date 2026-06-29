# aNtaerus Web UI

Frontend `React + Vite + TypeScript` du monorepo `aNtaerus`.

## Rôle

Le package `antaerus/interfaces/web/` porte l'UI texte des lots `M1.3` et `M1.4` :

- page `Chat` pour le texte ;
- page `Setup` pour la configuration locale navigateur ;
- hook WebSocket vers le gateway Go ;
- hook `SSE` direct vers `brain_python` pour le développement ;
- hydratation de l'historique de session via le gateway Go ;
- build statique servie ensuite par le gateway Go.

## Routes

- `/` : interface de chat principale
- `/setup` : wizard local de configuration
- `/foundation` : vue de fondation conservée comme écran technique secondaire

## État frontend

L'état métier est centralisé dans `Zustand` via `src/store/useAppStore.ts`.

Le store gère :

- session active ;
- messages du chat ;
- état de connexion WebSocket ;
- heartbeat remonté par le gateway ;
- configuration locale du wizard `Setup` ;
- remplacement local des messages lors du rechargement d'historique.

## Configuration locale

Le wizard `Setup` persiste localement dans le navigateur :

- nom affiché ;
- provider par défaut ;
- `gatewayBaseUrl` ;
- `brainBaseUrl` ;
- `websocketDevToken` ;
- clés API locales `Anthropic`, `OpenAI`, `Mistral` ;
- mode de transport texte (`ws` ou `sse-dev`).

Important :

- ces valeurs restent en local navigateur ;
- aucune clé API locale n'est envoyée au backend ;
- le jeton WebSocket est traité comme un jeton de développement ;
- l'UI peut désormais générer ou rafraîchir ce JWT via `POST /api/v1/auth/dev-token`.

## Modes de transport texte

### WebSocket Go

Mode principal du chat intégré.

- URL : `GET /api/v1/ws?token=<jwt>`
- génération du JWT de dev : `POST /api/v1/auth/dev-token`
- historique d'une session : `GET /api/v1/chat/sessions/{session_id}`
- messages sortants : `chat.message`
- messages entrants exploités en priorité :
  - `chat.token`
  - `chat.complete`
  - `health.heartbeat`

Le composant `Chat` recharge l'historique de la session active au montage puis continue le flux en temps réel sur la même session.

### SSE direct Brain

Mode secondaire de développement pour tester le streaming sans passer par le proxy Go.

- cible : `POST {brainBaseUrl}/llm/stream`
- événements attendus :
  - `token`
  - `complete`
  - `error`

## Server State

`TanStack Query` est utilisé pour le cache server state :

- état système depuis le gateway Go ;
- historique de session depuis le gateway Go ;
- providers du brain quand le mode `sse-dev` est actif.

Les flux temps réel restent gérés par les hooks dédiés, pas par Query.

## Build statique

La build Vite est produite dans :

- `antaerus/interfaces/web/dist/`

Le gateway Go sert ensuite ces fichiers statiques via `http.FileServer` avec fallback SPA sur `index.html`.

## Développement local

Installation :

```bash
npm install
```

Lancement dev :

```bash
npm run dev
```

Validation :

```bash
npm run lint
npm run check
npm run test
npm run build
```

## Intégration attendue

Pour un usage local complet :

- gateway Go sur `http://localhost:8080`
- brain Python sur `http://localhost:8000`
- un provider LLM joignable par le brain, par défaut `Ollama` sur `http://localhost:11434`
- un JWT de développement valide pour le WebSocket si le mode `ws` est utilisé

Le flux nominal est désormais :

- `React -> Go WebSocket -> Python LLM -> Go -> React`
- persistance SQLite par `sessionId`
- rechargement d'historique via le gateway

## Smoke M1.4

Smoke local :

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\validation\smoke-text-chat.ps1
```

ou :

```bash
bash ./scripts/validation/smoke-text-chat.sh
```

Le smoke vérifie :

- la génération du JWT de développement ;
- l'ouverture du WebSocket ;
- la réception de `chat.token` puis `chat.complete` ;
- la persistance d'au moins deux messages par session ;
- l'isolation entre deux sessions ;
- l'objectif `< 2s` sur la première session.

Si aucun provider local n'est joignable, le smoke échoue explicitement au niveau du flux LLM.
