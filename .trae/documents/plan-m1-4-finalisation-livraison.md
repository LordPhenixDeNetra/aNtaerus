# Plan d'exécution — Finalisation `M1.4`

## Résumé

Objectif : clôturer proprement le jalon `M1.4 — Intégration texte` à partir de l'état réel du dépôt, où l'implémentation principale est déjà présente mais où le backlog et la documentation ne sont pas encore synchronisés, et où la preuve smoke locale reste à exécuter après approbation.

Succès attendu :

- `tasks.md` reflète la livraison effective de `M1.4` ;
- la documentation `README` décrit le flux texte intégré `React -> Go -> Python -> Go -> React` ;
- le smoke test `M1.4` est rejoué sur un environnement local complet si les services sont démarrables ;
- les validations déjà vertes sont conservées, sans dérive fonctionnelle ni documentaire.

## Analyse de l'état actuel

### Backlog

Dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L160-L164), les quatre sous-tâches `M1.4` sont encore ouvertes :

- connexion streaming `React -> Go WebSocket -> Python LLM -> Go -> React` ;
- persistance de l'historique chat en SQLite ;
- test end-to-end `< 2s` ;
- test multi-session avec contexte isolé.

### Implémentation réellement présente

- [websocket.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/websocket.go#L219-L247) relaie déjà le streaming du brain via `StreamSession()` et émet `chat.token` puis `chat.complete`.
- [chat.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/chat.py#L20-L79) persiste le message utilisateur, reconstruit le contexte de session, stream la génération et persiste la réponse assistant.
- [smoke_text_chat.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/validation/smoke_text_chat.go#L28-L67) vérifie déjà le JWT de dev, le streaming WS, l'historique et l'isolation de deux sessions, avec un objectif `< 2s` sur la première session.
- [smoke-text-chat.ps1](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/validation/smoke-text-chat.ps1) existe déjà comme wrapper PowerShell.

### Documentation réellement en retard

- [web README](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/README.md) décrit encore `M1.3` et indique que le branchement complet reste `M1.4`.
- [brain README](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/README.md) ne mentionne ni `session-stream`, ni l'historique conversationnel, ni les tables chat dédiées.
- [root README](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/README.md) reste centré sur la fondation et n'expose pas le flux texte intégré ni le smoke `M1.4`.

## Hypothèses et décisions

- Le périmètre utile n'est plus l'implémentation du coeur `M1.4`, mais sa finalisation de livraison.
- `tasks.md` ne sera coché qu'après revalidation ciblée et, si possible, exécution du smoke test local.
- Le smoke test constitue la preuve locale du critère `< 2s`, avec une valeur indicative dépendante de l'environnement de validation.
- Si l'environnement local ne permet pas de démarrer proprement `gateway_go` et `brain_python`, le plan conserve un fallback : documenter que les tests automatisés sont verts et laisser la case smoke explicitement conditionnée à l'environnement.
- Le README racine doit être mis à jour, car il sert de point d'entrée transverse pour le monorepo et l'usage local complet.

## Changements proposés

### 1. Revalider l'état technique `M1.4`

#### Fichiers impactés

- aucun fichier fonctionnel en première intention ;
- lecture ciblée des fichiers déjà modifiés autour de `gateway_go`, `brain_python`, `web` et `scripts/validation/`.

#### Action

- relire les points d'entrée déjà ajoutés pour confirmer qu'ils couvrent bien :
  - streaming `chat.token` puis `chat.complete` ;
  - persistance SQLite par session ;
  - endpoint de JWT de développement ;
  - endpoint d'historique de session ;
  - consommation frontend de l'historique et du vrai flux WebSocket ;
- rejouer les validations déjà identifiées comme vertes ;
- exécuter le smoke test `M1.4` si l'environnement complet peut être lancé.

#### Pourquoi

- éviter de documenter ou cocher un état non reconfirmé.

### 2. Mettre à jour `tasks.md`

#### Fichiers à modifier

- `tasks.md`

#### Action

- cocher les quatre sous-tâches `M1.4` si la revalidation confirme :
  - proxy streaming intégré ;
  - persistance SQLite ;
  - preuve end-to-end locale ou, a minima, test automatisé + smoke prêt à l'emploi ;
  - isolation multi-session ;
- ajouter un bloc `État actuel` sous `M1.4` dans le même style que `M1.1`, `M1.2` et `M1.3` avec :
  - les fichiers de référence ;
  - les endpoints introduits ;
  - les validations rejouées ;
  - la mention du smoke script.

#### Pourquoi

- `tasks.md` est la source de vérité du projet et doit refléter l'avancement réel.

### 3. Mettre à jour le README du frontend

#### Fichiers à modifier

- `antaerus/interfaces/web/README.md`

#### Action

- faire évoluer la description du lot de `M1.3` vers `M1.3 + M1.4` ;
- documenter que le mode principal est désormais le WebSocket via Go ;
- préciser les flux pris en charge :
  - génération automatique ou rafraîchissement du JWT de dev ;
  - hydratation de l'historique de session via Go ;
  - `chat.token`, `chat.complete`, `health.heartbeat` ;
- repositionner `sse-dev` comme mode secondaire de développement ;
- ajouter les commandes utiles de validation si elles ont changé ou été enrichies.

#### Pourquoi

- le README frontend est aujourd'hui en contradiction avec le comportement réel de l'application.

### 4. Mettre à jour le README du brain Python

#### Fichiers à modifier

- `antaerus/providers/brain_python/README.md`

#### Action

- documenter les routes supplémentaires :
  - `POST /llm/session-stream`
  - `GET /memory/chat/sessions/{session_id}` ;
- expliciter le stockage conversationnel :
  - `chat_sessions`
  - `chat_messages` ;
- clarifier que le brain reconstruit le contexte d'une session avant génération ;
- conserver les routes `M1.2` existantes et les distinguer du flux conversationnel `M1.4`.

#### Pourquoi

- le README brain doit expliquer la responsabilité session-aware désormais assumée par ce service.

### 5. Mettre à jour le README racine

#### Fichiers à modifier

- `antaerus/README.md`

#### Action

- enrichir la section "Phase Courante" pour refléter le premier chat texte réellement intégré ;
- ajouter les endpoints ou commandes utiles au flux `M1.4` ;
- référencer le smoke test texte :
  - `powershell -ExecutionPolicy Bypass -File .\scripts\validation\smoke-text-chat.ps1`
  - `bash ./scripts/validation/smoke-text-chat.sh` ;
- faire apparaître le scénario local complet :
  - brain Python ;
  - gateway Go ;
  - UI React ;
  - JWT de dev ;
  - historique persistant.

#### Pourquoi

- le README racine est la vue d'ensemble consommée par l'équipe pour lancer et comprendre le système.

### 6. Finaliser la preuve `M1.4` par smoke test

#### Fichiers concernés

- `antaerus/scripts/validation/smoke_text_chat.go`
- `antaerus/scripts/validation/smoke-text-chat.ps1`
- `antaerus/scripts/validation/smoke-text-chat.sh`

#### Action

- si les services peuvent être démarrés localement, lancer le smoke script ;
- confirmer les critères suivants :
  - obtention du JWT de dev ;
  - ouverture WebSocket ;
  - réception d'au moins un `chat.token` ;
  - réception de `chat.complete` ;
  - historique contenant au moins deux messages par session ;
  - non-fuite entre `smoke-session-a` et `smoke-session-b` ;
  - durée de la première session inférieure à `2s` sur l'environnement courant.

#### Pourquoi

- c'est la preuve la plus directe des deux dernières cases du backlog `M1.4`.

## Séquence d'exécution recommandée

1. Relire les points d'entrée `M1.4` déjà présents.
2. Rejouer lint, typecheck, tests et diagnostics ciblés.
3. Lancer le smoke test si l'environnement complet est disponible.
4. Mettre à jour `tasks.md` avec l'état `M1.4`.
5. Synchroniser `antaerus/interfaces/web/README.md`.
6. Synchroniser `antaerus/providers/brain_python/README.md`.
7. Synchroniser `antaerus/README.md`.
8. Faire une dernière passe diagnostics sur les fichiers édités.

## Vérifications

### Python

- `python -m ruff check .`
- `python -m mypy src tests`
- `python -m pytest tests`

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

- le frontend consomme le flux WebSocket intégré sans fallback obligatoire ;
- l'historique de session est rechargé depuis Go ;
- le brain persiste bien les tours utilisateur et assistant ;
- deux sessions distinctes restent isolées ;
- la documentation finale n'annonce plus `M1.4` comme restant à faire.
