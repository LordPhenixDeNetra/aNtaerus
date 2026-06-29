# Plan d'exécution — `M1.1` Gateway Go, lot `WebSocket + Auth + Rate Limit`

## Résumé

Objectif : terminer la partie restante de `M1.1` côté gateway Go en livrant un hub WebSocket minimal mais exploitable, une authentification JWT cohérente pour REST et WebSocket, et un rate limiting en mémoire couvrant HTTP + WebSocket.

Succès attendu :

- le gateway expose un endpoint WebSocket versionné et branché sur les contrats déjà présents ;
- les routes REST protégées acceptent `Authorization: Bearer <token>` ;
- le WebSocket exige un JWT via query param `?token=...` au moment du handshake ;
- le gateway sait générer et valider des JWT sans introduire encore de système utilisateur persistant ;
- le rate limiting couvre :
  - les routes REST protégées ;
  - les handshakes WebSocket ;
  - les messages WebSocket entrants ;
- les tests couvrent l’auth, le hub WebSocket et les refus par limite/jeton invalide ;
- `tasks.md` est synchronisé uniquement après validations réelles.

## Analyse de l'état actuel

### Backlog `M1.1` restant

Dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L96-L110), les briques restantes du gateway sont :

- `gateway/websocket.go`
- `gateway/auth.go`
- `gateway/rate_limit.go`

Le lot `Infra socle` est déjà livré et validé :

- `server.go`
- `router.go`
- `health.go`
- `http_client.go`
- `config.go`

### État réel du dépôt

La base du gateway existe déjà :

- [config.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/config/config.go) charge une configuration validée via `viper`.
- [routes.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/routes.go) expose déjà `/health`, `/api/v1/health`, `/api/v1/system/services` et `/api/v1/system/status`.
- [server.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/server.go) supporte le mode TLS optionnel.
- [websocket.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/contracts/websocket.go) contient déjà le contrat Go des messages WebSocket.
- [ws.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/ws.ts) contient le miroir typé côté frontend.

### Écarts constatés

- aucun hub WebSocket n’existe encore sous `antaerus/interfaces/gateway_go/internal/` ;
- aucun middleware JWT n’est présent ;
- aucun rate limiter n’est présent ;
- aucun modèle d’utilisateur ou de compte n’existe dans le dépôt ;
- aucun endpoint d’authentification n’est défini dans le CDC ;
- aucun path WebSocket concret n’est encore matérialisé côté gateway.

### Référence CDC utile

Le CDC demande explicitement :

- un `websocket.go` de type hub + goroutine par client ;
- un `auth.go` pour JWT, sessions, rate limiting ;
- un transport React ↔ Go en WebSocket ;
- des événements `chat.message`, `voice.start`, `voice.stop`, `voice.barge_in`, `mission.cancel` ;
- des événements serveur `chat.token`, `chat.complete`, `voice.transcript`, `voice.audio`, `voice.vad_state`, `mission.update`, `system.alert`, `proactive.notification`, `health.heartbeat`.

## Décisions et hypothèses verrouillées

- Le périmètre du prochain lot couvre **ensemble** `websocket + auth JWT + rate limiting`.
- L’authentification WebSocket passe par `query param`, donc le handshake exige `?token=<jwt>`.
- Le rate limiting couvre **HTTP + WebSocket**, y compris les messages entrants.
- Le lot reste proportionné : il ne crée pas encore de système de comptes, de login UI, de stockage de sessions ni de persistance des limites.
- Le JWT servira d’identité technique minimale avec des claims simples :
  - `sub`
  - `role`
  - `iss`
  - `aud`
  - `iat`
  - `exp`
- Les `sessionId` des messages WebSocket restent des identifiants applicatifs de conversation, pas des sessions d’authentification.
- Aucune route publique d’émission de token n’est ajoutée dans ce lot, car le CDC ne définit pas encore de login ; la génération JWT sera fournie via service/utilitaire Go et testée unitairement.
- Le path WebSocket retenu est `GET /api/v1/ws`, cohérent avec l’organisation existante en `/api/v1/*`.

## Changements proposés

### 1. Étendre la configuration pour JWT, WebSocket et limites

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/config/config.go`
- `antaerus/interfaces/gateway_go/internal/config/config_test.go`

#### Action

- ajouter à `Config` les paramètres nécessaires au lot :
  - `JWTSecret`
  - `JWTIssuer`
  - `JWTAudience`
  - `JWTTokenTTL`
  - `WSHeartbeatInterval`
  - `HTTPRateLimitRPS`
  - `HTTPRateLimitBurst`
  - `WSConnectRateLimitRPS`
  - `WSConnectRateLimitBurst`
  - `WSMessageRateLimitRPS`
  - `WSMessageRateLimitBurst`
- charger ces valeurs via `viper`, avec défauts locaux raisonnables ;
- valider :
  - secret JWT non vide ;
  - TTL > 0 ;
  - heartbeat > 0 ;
  - limites et bursts > 0.

#### Pourquoi

- le lot introduit des comportements temps réel et sécurité qui doivent rester configurables et immuables ;
- cela évite de coder en dur les limites et le TTL des jetons.

### 2. Ajouter les dépendances Go nécessaires

#### Fichiers à modifier

- `antaerus/go.mod`
- éventuellement `antaerus/go.sum`

#### Action

- ajouter :
  - `github.com/gorilla/websocket`
  - `github.com/golang-jwt/jwt/v5`
  - `golang.org/x/time/rate`

#### Pourquoi

- le CDC mentionne Gorilla WebSocket ;
- le JWT et le rate limiting ont besoin de briques standard et reconnues.

### 3. Implémenter l’authentificateur JWT

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/http/auth.go`
- `antaerus/interfaces/gateway_go/internal/http/auth_test.go`

#### Action

- créer un `Authenticator` dans le package `httpapi` pour rester proche des middlewares/routage existants ;
- exposer au minimum :
  - `IssueToken(subject, role string) (string, error)`
  - `ValidateToken(raw string) (Claims, error)`
  - middleware HTTP `RequireJWT(next http.Handler) http.Handler`
  - extraction WebSocket `AuthenticateWebSocket(request *http.Request) (Claims, error)`
- valider :
  - signature HMAC avec le secret configuré ;
  - audience et issuer ;
  - expiration ;
  - présence minimale de `sub`.

#### Décision de portée

- pas de route `POST /auth/login` dans ce lot ;
- la génération JWT sert d’API interne testable et de base pour les lots suivants.

#### Pourquoi

- le dépôt ne possède encore aucun domaine `user/account` ;
- cette approche livre bien `JWT génération + validation` sans inventer un flux produit non décrit.

### 4. Implémenter le rate limiter partagé HTTP + WebSocket

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/http/rate_limit.go`
- `antaerus/interfaces/gateway_go/internal/http/rate_limit_test.go`

#### Action

- créer un store en mémoire basé sur `x/time/rate`, avec clés distinctes pour :
  - HTTP protégé : `subject` si authentifié, sinon IP ;
  - handshake WebSocket : IP + `subject` si disponible ;
  - message WebSocket entrant : connexion/client et `subject`.
- exposer au minimum :
  - middleware HTTP `RateLimitHTTP(next http.Handler) http.Handler`
  - vérification WebSocket `AllowWSConnect(claims, ip) bool`
  - vérification message `AllowWSMessage(clientID, claims) bool`
- retourner :
  - `429 Too Many Requests` en HTTP ;
  - fermeture contrôlée ou message d’erreur puis fermeture côté WebSocket si la limite est dépassée au handshake ;
  - message d’erreur WebSocket puis abandon du traitement si la limite est dépassée sur un message entrant.

#### Pourquoi

- le CDC demande explicitement un rate limiting par IP / user ;
- le périmètre validé par l’utilisateur inclut HTTP + WebSocket.

### 5. Implémenter le hub WebSocket

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/http/websocket.go`
- `antaerus/interfaces/gateway_go/internal/http/websocket_test.go`

#### Action

- créer un hub WebSocket dans `httpapi` avec :
  - `Hub`
  - `Client`
  - `register`
  - `unregister`
  - `broadcast` ou équivalent ciblé
  - boucle par client en lecture/écriture
- utiliser Gorilla WebSocket pour :
  - upgrade de `GET /api/v1/ws`
  - lecture JSON du contrat `contracts.ClientMessage`
  - écriture JSON du contrat `contracts.ServerMessage`
- appliquer :
  - authentification JWT en query param avant l’upgrade final ou juste après récupération de la requête ;
  - limitation de handshake ;
  - limitation par message entrant ;
- traiter les types de message connus du contrat sans implémenter encore la logique métier complète :
  - `chat.message`
  - `voice.start`
  - `voice.stop`
  - `voice.barge_in`
  - `mission.cancel`
- pour ce lot, répondre avec un comportement minimal mais structuré :
  - `chat.message` : émission immédiate d’un `chat.complete` de placeholder contrôlé, ou d’un accusé structuré compatible contrat ;
  - `voice.*` et `mission.cancel` : accusé ou `system.alert` / `mission.update` minimal cohérent tant que les providers ne sont pas encore connectés ;
  - heartbeat périodique `health.heartbeat` depuis les données déjà disponibles dans `internal/system/health.go`.

#### Décision de proportion

- le hub doit être **fonctionnellement raccordé**, pas encore branché au brain LLM ni au pipeline voix réel ;
- il doit surtout verrouiller le transport, la sécurité et la structure des messages.

#### Pourquoi

- `M1.1` doit poser le canal temps réel du chat ;
- le contrat existe déjà, donc il faut maintenant le concrétiser côté serveur.

### 6. Brancher l’auth et le WebSocket dans le routeur existant

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/http/routes.go`
- `antaerus/interfaces/gateway_go/internal/http/routes_test.go`

#### Action

- construire explicitement les composants :
  - `Authenticator`
  - `RateLimiter`
  - `Hub`
- monter dans le mux :
  - `GET /api/v1/ws`
  - les routes système/health existantes non protégées
- préparer les points d’extension pour futures routes JWT du CDC, sans les inventer toutes maintenant.

#### Décision de protection

- routes non protégées dans ce lot :
  - `/health`
  - `/api/v1/health`
  - `/api/v1/system/services`
  - `/api/v1/system/status`
  - `/api/v1/ws` avec auth spécifique WebSocket par query token
- les futures routes métier REST ajoutées ultérieurement devront passer par `RequireJWT` + `RateLimitHTTP`.

#### Pourquoi

- il faut préserver les endpoints d’observabilité ;
- le WebSocket a sa propre mécanique d’auth handshake.

### 7. Préserver la compatibilité de la santé agrégée

#### Fichiers à modifier si nécessaire

- `antaerus/interfaces/gateway_go/internal/system/health.go`
- `antaerus/interfaces/gateway_go/internal/system/handlers.go`
- `antaerus/interfaces/gateway_go/internal/system/health_test.go`

#### Action

- réutiliser `HealthService` pour alimenter `health.heartbeat` ;
- ne pas dupliquer l’agrégation déjà livrée ;
- garder les réponses HTTP existantes stables.

#### Pourquoi

- le lot temps réel doit s’appuyer sur le socle `Infra socle`, pas le réécrire.

### 8. Ajouter les tests ciblés du lot

#### Fichiers à créer ou modifier

- `antaerus/interfaces/gateway_go/internal/http/auth_test.go`
- `antaerus/interfaces/gateway_go/internal/http/rate_limit_test.go`
- `antaerus/interfaces/gateway_go/internal/http/websocket_test.go`
- `antaerus/interfaces/gateway_go/internal/http/routes_test.go`
- `antaerus/interfaces/gateway_go/internal/config/config_test.go`

#### Action

- couvrir :
  - génération puis validation d’un JWT ;
  - rejet d’un JWT expiré, mal signé ou sans `sub` ;
  - rejet HTTP par rate limit ;
  - rejet handshake WebSocket sans token, avec token invalide, puis avec token valide ;
  - rejet message WebSocket si la limite est dépassée ;
  - réception d’un `health.heartbeat` périodique ou d’un message serveur minimal ;
  - stabilité du routeur avec `/api/v1/ws`.

#### Pourquoi

- ce lot ajoute plusieurs branches de sécurité et de concurrence, donc les tests doivent être plus précis que les tests actuels du socle.

### 9. Synchroniser le backlog après validation

#### Fichiers à modifier en exécution

- `tasks.md`
- éventuellement `antaerus/README.md` si l’usage du JWT de dev ou du WebSocket doit être noté pour le lancement local

#### Action

- ne cocher `websocket.go`, `auth.go` et `rate_limit.go` qu’après validation réelle ;
- conserver le résumé `M1.1` cohérent avec les nouvelles briques livrées.

#### Pourquoi

- `tasks.md` reste la source de vérité opérationnelle du projet.

## Interfaces et comportements décidés

### Endpoint WebSocket

- `GET /api/v1/ws?token=<jwt>`

### Auth REST

- header obligatoire sur les routes protégées : `Authorization: Bearer <jwt>`

### Claims JWT minimaux

- `sub` : identité technique minimale
- `role` : `user` ou `admin`
- `iss`
- `aud`
- `iat`
- `exp`

### Comportement de refus

- REST sans JWT ou JWT invalide : `401 Unauthorized`
- REST au-delà de la limite : `429 Too Many Requests`
- WS sans token ou token invalide : refus handshake ou fermeture immédiate contrôlée
- WS au-delà de la limite de messages : message d’erreur structuré puis abandon du message, sans corrompre le hub

### Messages WebSocket de ce lot

- `chat.message` : réponse structurée minimale de démonstration transport
- `voice.start`, `voice.stop`, `voice.barge_in` : réponse placeholder cohérente, sans pipeline voix réel
- `mission.cancel` : réponse placeholder cohérente
- `health.heartbeat` : push périodique basé sur `HealthService`

## Séquence d'exécution recommandée

1. Étendre `internal/config/config.go` avec la configuration JWT/WS/limites.
2. Ajouter les dépendances `gorilla/websocket`, `jwt/v5` et `x/time/rate`.
3. Implémenter `internal/http/auth.go` et ses tests.
4. Implémenter `internal/http/rate_limit.go` et ses tests.
5. Implémenter `internal/http/websocket.go` avec hub, client loops, auth query param et heartbeat.
6. Brancher `/api/v1/ws` dans `internal/http/routes.go`.
7. Réutiliser `internal/system/health.go` pour le heartbeat.
8. Rejouer les tests Go du gateway.
9. Mettre à jour `tasks.md`, puis `README.md` si nécessaire.

## Vérifications

### Tests ciblés

- `go test ./interfaces/gateway_go/...`

### Contrôles attendus

- config invalide : échec propre si secret JWT ou limites sont invalides ;
- JWT valide : authentification HTTP acceptée ;
- JWT invalide ou expiré : refus HTTP et WebSocket ;
- `/api/v1/ws` accepte un token valide et ouvre la connexion ;
- un client WebSocket reçoit des messages JSON conformes au contrat ;
- le heartbeat `health.heartbeat` peut être émis à intervalle configuré ;
- les limites HTTP et WS déclenchent bien les refus attendus.

### Synchronisation backlog

- `tasks.md` reflète exactement la clôture réelle de `websocket.go`, `auth.go` et `rate_limit.go` ;
- les éléments encore non branchés au brain/voice réel restent explicitement décrits comme placeholders de transport.

## Risques surveillés

- surdimensionner le hub WebSocket avant l’intégration réelle au brain ;
- introduire un flux d’authentification produit non défini dans le CDC ;
- rendre les tests WebSocket instables s’ils dépendent du temps réel sans marges contrôlées ;
- coupler trop fortement la limitation au transport au lieu de la garder réutilisable.

## Résultat attendu

À la fin de ce lot, `M1.1` côté gateway Go doit disposer :

- d’un transport WebSocket fonctionnel et protégé ;
- d’une authentification JWT cohérente pour REST et WebSocket ;
- d’un rate limiting en mémoire couvrant HTTP + WebSocket ;
- d’un socle temps réel prêt pour le branchement futur au brain texte, puis à la voix.
