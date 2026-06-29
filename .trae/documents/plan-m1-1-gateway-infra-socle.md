# Plan d'exécution — `M1.1` Gateway Go, lot `Infra socle`

## Résumé

Objectif : livrer le premier sous-lot exécutable de `M1.1` pour le gateway Go en renforçant la fondation réseau et d'intégration, sans ouvrir encore les chantiers `websocket`, `auth` et `rate_limit`.

Succès attendu :

- la configuration du gateway devient immuable, validée et chargée via `viper` ;
- le gateway expose un routage REST v1 explicite, tout en conservant les endpoints de fondation utiles ;
- l'agrégation de santé couvre Go + Python + Rust ;
- le canal Rust suit la décision verrouillée : `gRPC primaire + HTTP secours` ;
- le serveur HTTP supporte un mode standard sans TLS et un mode TLS optionnel basé sur certificat/clé fournis ;
- les tests couvrent la configuration, le routage et les cas principaux de collecte de santé ;
- `tasks.md` est synchronisé uniquement après validations réelles.

## Analyse de l'état actuel

### Backlog cible

Dans `tasks.md`, `M1.1` demande huit briques :

- `gateway/server.go`
- `gateway/websocket.go`
- `gateway/auth.go`
- `gateway/rate_limit.go`
- `gateway/router.go`
- `gateway/health.go`
- `gateway/http_client.go`
- `gateway/config.go`

Le cadrage utilisateur verrouille pour ce premier lot :

- priorité : **Infra socle**
- Rust : **gRPC primaire + HTTP secours**
- serveur : **TLS optionnel standard**

### État réel observé dans le dépôt

Le gateway existe déjà sous une forme minimale :

- [main.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/cmd/gateway/main.go) démarre l'application puis appelle `ListenAndServe()`.
- [bootstrap.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/app/bootstrap.go) charge `config.Load()` puis construit un `http.Server`.
- [config.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/config/config.go) lit l'environnement directement via `os.Getenv` sans validation structurée.
- [server.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/server.go) instancie un `http.Server` simple sans branchement TLS.
- [routes.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/routes.go) ne monte que `/health`, `/api/v1/system/services` et `/api/v1/system/status`.
- [handlers.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/system/handlers.go) agrège déjà une partie des informations système, mais Rust est encore interrogé en HTTP uniquement.
- [python_client.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/clients/python_client.go) fournit un client HTTP générique pour `health` et `capabilities`.
- [rust_client.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/clients/rust_client.go) ne décrit qu'un endpoint HTTP Rust.
- [engine_grpc_client.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/clients/engine_grpc_client.go) expose déjà `GetHealth()` et `GetCapabilities()` via gRPC.

### Contraintes et écarts

- `viper` est déjà disponible dans [go.mod](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/go.mod), mais n'est pas encore utilisé côté gateway.
- Le CDC demande une `Config` immuable et un gateway `HTTP/2 + TLS`, avec REST v1 et health agrégé.
- Les endpoints des dépendances existent déjà :
  - Python : `/health`, `/internal/capabilities`
  - Rust HTTP : `/health`, `/capabilities`
  - Rust gRPC : `GetHealth`, `GetCapabilities`
- Les tests du gateway sont encore limités à deux vérifications très superficielles dans [handlers_test.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/system/handlers_test.go).

## Hypothèses et décisions

- Ce lot ne traite pas `websocket`, `auth` ni `rate_limit` ; ils restent explicitement hors périmètre.
- Le fichier [routes.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/routes.go) sert de matérialisation du besoin `router.go` sans créer de doublon inutile.
- Le besoin `health.go` est matérialisé par une extraction de la logique d'agrégation hors de `handlers.go`, dans un nouveau fichier sous `internal/system/`.
- Le besoin `http_client.go` est matérialisé en renforçant les clients HTTP existants sous `internal/clients/`, plutôt qu'en créant un package concurrent.
- La configuration sera chargée une seule fois au bootstrap, stockée dans une struct non exportant pas de mutateurs, puis passée par valeur ou lecture seule.
- Le chargement `viper` lira les variables d'environnement et tentera un `.env` local optionnel, sans exiger sa présence.
- Le mode TLS est activé uniquement si les deux chemins `cert` et `key` sont fournis ; sinon le serveur démarre en clair.
- Le mode sans TLS reste l'option par défaut pour préserver le workflow local actuel (`dev-gateway.ps1`, `dev-all.ps1`).

## Changements proposés

### 1. Refondre la configuration du gateway

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/config/config.go`
- `antaerus/interfaces/gateway_go/app/bootstrap.go`
- `antaerus/engine/bootstrap.go`
- `antaerus/interfaces/gateway_go/cmd/gateway/main.go`

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/config/config_test.go`

#### Action

- remplacer le chargement `os.Getenv` par `viper` ;
- introduire une `Config` validée contenant au minimum :
  - `Environment`
  - `Port`
  - `Version`
  - `WebURL`
  - `BrainBaseURL`
  - `EngineHTTPURL`
  - `EngineGRPCTarget`
  - `RequestTimeout`
  - `ReadHeaderTimeout`
  - `ShutdownTimeout`
  - `TLSCertFile`
  - `TLSKeyFile`
- définir des valeurs par défaut de fondation cohérentes avec l'existant :
  - gateway `8080`
  - web `http://localhost:5173`
  - brain `http://localhost:8000`
  - engine HTTP `http://localhost:7000`
  - engine gRPC `localhost:7001`
- ajouter une validation explicite :
  - port > 0
  - URLs HTTP parsables
  - timeout > 0
  - TLS valide seulement si `cert` et `key` sont tous deux renseignés
- faire évoluer la chaîne de bootstrap pour propager les erreurs de configuration jusqu'à `main.go`, qui échouera proprement avec un message clair.

#### Pourquoi

- c'est la base requise pour un gateway immuable et fiable ;
- le dépôt possède déjà `viper`, donc cette évolution reste alignée avec la fondation du projet ;
- la propagation d'erreur évite les démarrages silencieusement mal configurés.

### 2. Clarifier les clients HTTP et le fallback Rust

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/clients/python_client.go`
- `antaerus/interfaces/gateway_go/internal/clients/rust_client.go`
- `antaerus/interfaces/gateway_go/internal/clients/engine_grpc_client.go`

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/clients/engine_runtime_client.go`
- `antaerus/interfaces/gateway_go/internal/clients/clients_test.go`

#### Action

- conserver les clients HTTP existants, mais les rendre plus explicites côté domaine :
  - `BrainClient` pour Python
  - `EngineHTTPClient` pour Rust HTTP
- ajouter une couche `EngineRuntimeClient` qui :
  - essaie `GetHealth()` et `GetCapabilities()` via gRPC ;
  - en cas d'échec ou timeout, retombe sur les endpoints HTTP Rust ;
  - annote le résultat pour distinguer si la réponse provient de `grpc` ou de `http-fallback` ;
- conserver des timeouts courts et déterministes ;
- normaliser les réponses offline afin que l'API agrégée reste stable.

#### Pourquoi

- la décision utilisateur impose clairement la priorité gRPC avec secours HTTP ;
- le dépôt dispose déjà de la brique gRPC, il faut maintenant l'orchestrer au niveau métier.

### 3. Extraire et renforcer l'agrégation de santé

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/system/handlers.go`

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/system/health.go`
- `antaerus/interfaces/gateway_go/internal/system/health_test.go`

#### Action

- extraire de `handlers.go` la logique de collecte dans un composant dédié, par exemple `HealthService` ;
- construire la réponse agrégée avec :
  - santé locale du gateway
  - santé du frontend configuré
  - santé/capacités Python via HTTP
  - santé/capacités Rust via `EngineRuntimeClient`
- définir deux sorties stables :
  - une réponse santé agrégée pour `/api/v1/health`
  - une réponse système détaillée pour `/api/v1/system/status`
- conserver `/health` comme endpoint léger de compatibilité pour la santé locale du gateway.

#### Pourquoi

- `handlers.go` est actuellement trop couplé ;
- ce découpage prépare les lots suivants sans mélanger encore auth/websocket/rate limit.

### 4. Étendre le routage REST v1

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/http/routes.go`

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/http/routes_test.go`

#### Action

- faire de `routes.go` le routeur REST v1 explicite du lot ;
- monter au minimum :
  - `GET /health` : santé locale gateway
  - `GET /api/v1/health` : santé agrégée Go + Python + Rust
  - `GET /api/v1/system/services` : liste des services observés
  - `GET /api/v1/system/status` : vue agrégée détaillée
- conserver `http.ServeMux` pour rester proportionné au besoin actuel et éviter d'introduire un framework supplémentaire non nécessaire.

#### Pourquoi

- le CDC demande du REST v1 ;
- la structure actuelle suffit pour ce premier lot si les routes sont clarifiées et testées.

### 5. Renforcer le serveur HTTP avec TLS optionnel

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/http/server.go`
- `antaerus/interfaces/gateway_go/cmd/gateway/main.go`

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/http/server_test.go`

#### Action

- faire évoluer `NewServer` pour appliquer la configuration validée :
  - `Addr`
  - `Handler`
  - `ReadHeaderTimeout`
  - `IdleTimeout`
  - `WriteTimeout`
- ajouter une fonction d'exécution, par exemple `Listen(server, cfg) error`, qui choisit :
  - `ListenAndServeTLS(cert, key)` si TLS est activé
  - `ListenAndServe()` sinon
- préparer le serveur pour HTTP/2 via le comportement standard de `net/http` en mode TLS, sans sur-ajouter une bibliothèque dédiée dans ce lot ;
- gérer correctement `http.ErrServerClosed`.

#### Pourquoi

- cela matérialise l'objectif `HTTP/2 + TLS optionnel` de manière proportionnée ;
- le mode natif local reste simple, tandis que le chemin TLS devient disponible pour les usages suivants.

### 6. Mettre à niveau les tests du gateway

#### Fichiers à créer ou modifier

- `antaerus/interfaces/gateway_go/internal/config/config_test.go`
- `antaerus/interfaces/gateway_go/internal/clients/clients_test.go`
- `antaerus/interfaces/gateway_go/internal/system/health_test.go`
- `antaerus/interfaces/gateway_go/internal/http/routes_test.go`
- `antaerus/interfaces/gateway_go/internal/http/server_test.go`
- `antaerus/interfaces/gateway_go/internal/system/handlers_test.go`

#### Action

- couvrir les validations de config et les défauts ;
- vérifier le comportement du fallback Rust :
  - succès gRPC
  - échec gRPC puis succès HTTP
  - indisponibilité totale
- vérifier les codes HTTP et les routes exposées ;
- vérifier le choix TLS/non-TLS au niveau logique sans lancer un vrai serveur longue durée ;
- réduire ou remplacer les tests superficiels actuels si des tests plus ciblés les rendent redondants.

#### Pourquoi

- les tests actuels ne sécurisent pas le futur refactoring ;
- ce lot introduit des branches de comportement qui doivent être verrouillées avant les chantiers suivants.

### 7. Synchroniser la documentation opérationnelle

#### Fichiers à modifier en phase d'exécution

- `tasks.md`
- éventuellement `antaerus/README.md` si de nouvelles variables de configuration ou le mode TLS nécessitent une note de démarrage

#### Action

- mettre à jour `tasks.md` seulement après validations réelles ;
- refléter que le premier sous-lot `M1.1` couvre :
  - `server.go`
  - `router.go`
  - `health.go`
  - `http_client.go`
  - `config.go`
- laisser `websocket`, `auth` et `rate_limit` ouverts.

#### Pourquoi

- l'utilisateur exige que `tasks.md` reste la source de vérité après chaque avancée validée.

## Interfaces et comportements décidés

### Variables de configuration retenues

- `ANTAERUS_ENV`
- `ANTAERUS_GATEWAY_PORT`
- `ANTAERUS_GATEWAY_VERSION`
- `ANTAERUS_WEB_URL`
- `ANTAERUS_BRAIN_URL`
- `ANTAERUS_ENGINE_URL`
- `ANTAERUS_ENGINE_GRPC_TARGET`
- `ANTAERUS_GATEWAY_REQUEST_TIMEOUT_MS`
- `ANTAERUS_GATEWAY_READ_HEADER_TIMEOUT_MS`
- `ANTAERUS_GATEWAY_SHUTDOWN_TIMEOUT_MS`
- `ANTAERUS_GATEWAY_TLS_CERT_FILE`
- `ANTAERUS_GATEWAY_TLS_KEY_FILE`

### Contrat de comportement Rust

- health :
  - tentative gRPC en premier ;
  - si gRPC échoue, tentative HTTP `/health` ;
  - si les deux échouent, service marqué `offline`
- capabilities :
  - tentative gRPC en premier ;
  - si gRPC échoue, tentative HTTP `/capabilities` ;
  - si les deux échouent, liste vide et version `unknown`

### Contrat de compatibilité

- `GET /health` reste disponible ;
- `GET /api/v1/system/services` et `GET /api/v1/system/status` restent disponibles ;
- `GET /api/v1/health` est ajouté comme endpoint agrégé principal ;
- le démarrage en clair sur `:8080` reste fonctionnel sans configuration TLS.

## Séquence d'exécution recommandée

1. Refondre `internal/config/config.go` et écrire `config_test.go`.
2. Propager les erreurs de config dans `app/bootstrap.go`, `engine/bootstrap.go` et `cmd/gateway/main.go`.
3. Introduire la couche `EngineRuntimeClient` et les tests de fallback.
4. Extraire l'agrégation de santé dans `internal/system/health.go`.
5. Étendre `internal/http/routes.go` avec `/api/v1/health`.
6. Renforcer `internal/http/server.go` pour le TLS optionnel.
7. Ajuster ou remplacer les tests existants du package `system`.
8. Rejouer les validations Go.
9. Mettre à jour `tasks.md`, puis `README.md` si nécessaire.

## Vérifications

### Tests ciblés

- `go test ./interfaces/gateway_go/...`

### Contrôles attendus

- config invalide : échec de bootstrap explicite ;
- config par défaut : gateway démarre toujours en local ;
- `GET /health` retourne 200 avec identité gateway ;
- `GET /api/v1/health` retourne un payload agrégé stable ;
- Rust en ligne via gRPC : la réponse agrégée utilise gRPC ;
- gRPC en panne mais HTTP Rust disponible : la réponse bascule proprement sur le fallback ;
- TLS non configuré : chemin standard en clair ;
- TLS configuré : le serveur choisit bien le mode `ListenAndServeTLS`.

### Synchronisation backlog

- `tasks.md` reflète exactement les sous-tâches `M1.1` réellement livrées ;
- les sous-tâches non traitées restent décochées.

## Risques surveillés

- dériver vers un refactoring trop large du bootstrap global ;
- introduire une couche client trop abstraite pour un besoin encore simple ;
- casser la compatibilité locale en imposant TLS par défaut ;
- rendre les tests instables si le fallback réseau dépend de ports réels plutôt que de doubles contrôlés.

## Résultat attendu

À la fin de ce lot `Infra socle`, le gateway Go doit disposer :

- d'une configuration propre, immuable et validée ;
- d'un routeur REST v1 clair ;
- d'un healthcheck agrégé prêt pour l'observabilité de base ;
- d'une intégration Rust robuste avec `gRPC primaire + HTTP secours` ;
- d'un serveur prêt pour TLS optionnel ;
- d'un socle testable sur lequel brancher ensuite `websocket`, `auth` et `rate_limit`.
