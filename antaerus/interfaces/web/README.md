# aNtaerus Web UI

Frontend `React + Vite + TypeScript` du monorepo `aNtaerus`.

## Rôle

Le package `antaerus/interfaces/web/` porte le lot `M1.3` de l'UI core :

- page `Chat` pour le texte ;
- page `Setup` pour la configuration locale navigateur ;
- hook WebSocket vers le gateway Go ;
- hook `SSE` direct vers `brain_python` pour le développement ;
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
- configuration locale du wizard `Setup`.

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

- ces valeurs restent en local navigateur dans `M1.3` ;
- aucune clé n'est envoyée au backend dans ce lot ;
- le jeton WebSocket est traité comme un jeton de développement.

## Modes de transport texte

### WebSocket Go

Mode par défaut du chat.

- URL : `GET /api/v1/ws?token=<jwt>`
- messages sortants : `chat.message`
- messages entrants exploités en priorité :
  - `chat.token`
  - `chat.complete`
  - `health.heartbeat`

### SSE direct Brain

Mode de développement pour tester le streaming avant le proxy Go final.

- cible : `POST {brainBaseUrl}/llm/stream`
- événements attendus :
  - `token`
  - `complete`
  - `error`

## Server State

`TanStack Query` est utilisé pour le cache server state :

- état système depuis le gateway Go ;
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
- un JWT de développement valide pour le WebSocket si le mode `ws` est utilisé

Le branchement bout-en-bout final `React -> Go -> Python` pour le texte streamé reste le lot `M1.4`.
