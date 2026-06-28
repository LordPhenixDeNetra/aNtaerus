## Résumé

Objectif de cette première itération : construire la **fondation exécutable** de `aNtaerus` sous forme de **monorepo polyglotte cross-platform** aligné avec le cahier des charges, sans chercher à livrer encore tout le produit final.

Le livrable visé est un dépôt prêt à évoluer, dans lequel les quatre briques principales démarrent réellement :
- `web/` : interface React + Vite avec page de statut fondation
- `gateway_go/` : service Go exposant API HTTP de base et healthcheck
- `brain_python/` : service Python exposant healthcheck et contrat minimal interne
- `engine_rust/` : service Rust exposant healthcheck et contrat moteur minimal

L’orchestration de développement sera **hybride** :
- scripts natifs pour le développement quotidien
- `docker-compose` pour standardiser l’environnement et vérifier la portabilité

Cette phase inclut aussi la création des documents de cadrage exigés par le workflow (`PRD` et architecture technique), car ils n’existent pas encore dans le dépôt.

## Analyse De L’État Actuel

Constats observés dans le dépôt :
- le dépôt ne contient actuellement que [`cahier-des-charges.md`](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/cahier-des-charges.md)
- le document décrit une vision complète de `aNtaerus` : assistant IA self-hosted, stack `Go/Rust/Python/React`, architecture en couches `L0 -> L3`, roadmap multi-phases et contraintes de sécurité
- le répertoire `.trae/` n’existe pas encore, donc aucun `PRD`, aucune architecture technique, aucun plan antérieur
- aucun code source, aucun manifeste d’outillage (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`), aucun script de démarrage, aucune CI, aucun container de dev n’existent encore

Implication :
- il faut commencer par formaliser un **socle documentaire minimal** puis poser une **structure d’exécution réelle**, plutôt que d’attaquer directement les fonctionnalités ambitieuses du cahier des charges
- le périmètre retenu par l’utilisateur est cohérent avec une **phase M0 renforcée** : fondation seule, mais fondation réellement lançable

## Changements Proposés

### 1. Documentation De Cadrage

Fichiers à créer :
- `.trae/documents/antaerus-prd-fondation.md`
- `.trae/documents/antaerus-architecture-technique.md`

Pourquoi :
- le skill `web-dev` impose la présence de documents de cadrage avant le développement
- le cahier des charges existant est très riche mais couvre tout le produit ; il faut le ramener à une première itération exécutable et bornée

Comment :
- produire un `PRD` focalisé sur la fondation monorepo, les rôles techniques, les pages minimales et les parcours de démarrage
- produire un document d’architecture technique décrivant :
  - la structure du monorepo
  - les frontières entre `web`, `gateway_go`, `brain_python`, `engine_rust`
  - les protocoles retenus au stade fondation
  - les routes HTTP minimales
  - les contrats de healthcheck et de métadonnées système

### 2. Structure Racine Du Monorepo

Fichiers et dossiers à créer :
- `README.md`
- `.gitignore`
- `.editorconfig`
- `docker-compose.yml`
- `Makefile` ou équivalent cross-platform documenté
- `scripts/`
- `docs/`
- `contracts/`
- `schemas/`

Pourquoi :
- installer un socle de conventions partagé entre les quatre stacks
- préparer les exécutions locales, la conteneurisation et la documentation projet

Comment :
- `README.md` : vision courte, prérequis, architecture, commandes de démarrage
- `.gitignore` : Node, Python, Rust, Go, fichiers IDE, logs, artefacts de build
- `.editorconfig` : conventions cohérentes de base
- `docker-compose.yml` : démarrage standardisé des quatre services
- `scripts/` : scripts de bootstrap et de démarrage dev
- `contracts/` et `schemas/` : point d’ancrage des schémas transverses dès le départ

Décision d’implémentation :
- privilégier une structure claire et simple, même si certaines couches du cahier des charges resteront provisoirement symboliques dans cette phase

### 3. Frontend `web/`

Fichiers à créer :
- `web/package.json`
- `web/vite.config.ts`
- `web/tsconfig.json`
- `web/src/main.tsx`
- `web/src/App.tsx`
- `web/src/pages/FoundationDashboard.tsx`
- `web/src/components/ServiceStatusCard.tsx`
- `web/src/lib/api.ts`

Pourquoi :
- disposer d’une première interface concrète et exécutable
- matérialiser le produit côté utilisateur sans simuler encore le chat complet

Comment :
- initialiser une application React + Vite + TypeScript
- créer une page unique "Foundation Dashboard" affichant :
  - état des services
  - version
  - environnement
  - disponibilité des endpoints
- connecter le frontend aux endpoints de base du `gateway_go`

Portée volontairement exclue à ce stade :
- pas de chat temps réel
- pas de WebSocket métier
- pas de voice visualizer
- pas de design produit final multi-écrans

### 4. Service `gateway_go/`

Fichiers à créer :
- `gateway_go/go.mod`
- `gateway_go/cmd/gateway/main.go`
- `gateway_go/internal/http/server.go`
- `gateway_go/internal/http/routes.go`
- `gateway_go/internal/config/config.go`
- `gateway_go/internal/system/handlers.go`
- `gateway_go/internal/clients/python_client.go`
- `gateway_go/internal/clients/rust_client.go`

Pourquoi :
- faire du service Go la porte d’entrée du système, conformément au cahier des charges
- poser le squelette de la future orchestration inter-services

Comment :
- exposer au minimum :
  - `GET /health`
  - `GET /api/v1/system/status`
  - `GET /api/v1/system/services`
- agréger l’état du frontend, du brain Python et du moteur Rust
- charger une configuration immuable au démarrage
- prévoir une couche client légère vers Python et Rust

Décisions pour cette phase :
- API HTTP simple d’abord
- pas encore d’authentification
- pas encore de WebSocket applicatif
- format JSON stable pour préparer la suite

### 5. Service `brain_python/`

Fichiers à créer :
- `brain_python/pyproject.toml`
- `brain_python/src/antaerus_brain/__init__.py`
- `brain_python/src/antaerus_brain/app.py`
- `brain_python/src/antaerus_brain/api/health.py`
- `brain_python/src/antaerus_brain/config.py`
- `brain_python/tests/test_health.py`

Pourquoi :
- réserver la place du futur "cerveau" LLM sans lancer immédiatement la logique complexe
- rendre le service exécutable et interrogeable par le gateway

Comment :
- créer une API FastAPI minimale avec :
  - `GET /health`
  - `GET /internal/capabilities`
- retourner des métadonnées de service :
  - nom
  - version
  - mode courant
  - capacités déclarées

Décisions :
- `uv` ou installation standard via `pyproject.toml`
- aucune dépendance LLM externe dans cette phase
- structure interne déjà orientée packages pour éviter les shims racine signalés dans le cahier des charges

### 6. Service `engine_rust/`

Fichiers à créer :
- `engine_rust/Cargo.toml`
- `engine_rust/src/main.rs`
- `engine_rust/src/http.rs`
- `engine_rust/src/config.rs`
- `engine_rust/src/state.rs`
- `engine_rust/tests/health.rs`

Pourquoi :
- ancrer le moteur Rust dès la fondation
- valider tôt la capacité du dépôt à faire cohabiter les quatre stacks

Comment :
- exposer un petit serveur HTTP minimal avec :
  - `GET /health`
  - `GET /capabilities`
- retourner l’état du moteur, les modules compilés et les futures capacités réservées (`audio`, `storage`, `sandbox`)

Décisions :
- HTTP minimal pour la fondation
- gRPC reporté à l’itération suivante, mais structure du code pensée pour accueillir un module `protocol/`

### 7. Contrats Partagés Et Schémas

Fichiers à créer :
- `contracts/system-status.schema.json`
- `contracts/service-health.schema.json`
- `contracts/service-capabilities.schema.json`
- `docs/contracts.md`

Pourquoi :
- éviter des interfaces implicites entre services
- préparer la migration future vers REST enrichi, WebSocket et gRPC

Comment :
- définir un schéma JSON commun pour :
  - healthcheck
  - capacités
  - agrégation d’état système
- faire consommer ces contrats par le frontend et le gateway

Décision :
- dans cette phase, les contrats seront centralisés au format JSON Schema plutôt qu’en Protobuf, car cela réduit le coût de mise en place initiale

### 8. Orchestration Hybride

Fichiers à créer :
- `docker-compose.yml`
- `scripts/dev-web.*`
- `scripts/dev-gateway.*`
- `scripts/dev-brain.*`
- `scripts/dev-engine.*`
- `scripts/dev-all.*`

Pourquoi :
- répondre explicitement au choix utilisateur "Hybride"
- permettre un usage confortable en local et un démarrage standardisé en environnement homogène

Comment :
- scripts natifs pour lancer individuellement chaque service
- `docker-compose` pour lancer les services ensemble
- documenter les prérequis et variantes Windows/Linux/macOS dans le `README`

Décisions :
- les scripts doivent rester simples et lisibles
- la compatibilité cross-platform sera obtenue par double fourniture :
  - scripts adaptés à Windows
  - commandes documentées pour shells Unix

### 9. Qualité, CI Et Vérifications

Fichiers à créer :
- `.github/workflows/ci.yml` ou équivalent si le dépôt cible GitHub
- `web` : scripts lint/build
- `brain_python` : tests unitaires minimaux
- `engine_rust` : test de healthcheck
- `gateway_go` : test de route ou test de handler

Pourquoi :
- rendre la fondation fiable dès la première phase
- éviter de reporter les conventions de qualité

Comment :
- vérifier au minimum :
  - build frontend
  - test Python
  - test Rust
  - test Go
- ajouter un smoke-check documenté pour s’assurer que les quatre services démarrent

Hypothèse :
- si aucune forge CI n’est encore confirmée, commencer par une structure compatible GitHub Actions, facilement portable

## Hypothèses Et Décisions

- périmètre validé : **fondation seule**
- type de livrable validé : **monorepo polyglotte**
- cible prioritaire validée : **cross-platform**
- profondeur attendue validée : **squelettes exécutables**
- orchestration validée : **hybride**

Décisions prises pour éviter un plan trop large :
- reporter le chat métier, la mémoire vivante, le pipeline vocal temps réel, les skills et le moteur proactif à des itérations ultérieures
- ne pas implémenter tout de suite `gRPC`, `WebSocket`, authentification, persistence SQLite métier ni appels LLM
- conserver néanmoins une arborescence compatible avec la vision finale du cahier des charges

Hypothèses raisonnables à appliquer pendant l’exécution :
- le dépôt utilisera Git comme base de travail standard
- une CI de type GitHub Actions est acceptable tant qu’aucune autre forge n’est imposée
- la première interface web sera utilitaire, focalisée sur l’état système, pas encore sur l’expérience complète assistant

## Étapes D’Exécution Recommandées

1. Créer `.trae/documents/antaerus-prd-fondation.md` et `.trae/documents/antaerus-architecture-technique.md` à partir du cahier des charges et des décisions utilisateur.
2. Créer l’ossature racine du monorepo et les fichiers de conventions.
3. Initialiser le frontend `web/` et une page unique de supervision fondation.
4. Initialiser `gateway_go/` avec routes de healthcheck et agrégation simple d’état.
5. Initialiser `brain_python/` avec FastAPI minimal et endpoints internes.
6. Initialiser `engine_rust/` avec serveur HTTP minimal et capacités déclaratives.
7. Ajouter les contrats JSON partagés et brancher le frontend dessus via le gateway.
8. Ajouter scripts natifs + `docker-compose`.
9. Ajouter vérifications minimales, tests de base et documentation de démarrage.

## Vérifications

Critères d’acceptation pour cette phase :
- le dépôt contient une structure monorepo claire et documentée
- `web/`, `gateway_go/`, `brain_python/` et `engine_rust/` démarrent réellement
- le frontend affiche l’état agrégé du système via le gateway
- chaque service expose un endpoint de healthcheck stable
- un lancement local natif est documenté
- un lancement standardisé via `docker-compose` est documenté
- les tests minimaux et vérifications de build s’exécutent sans erreur

Commandes de vérification à prévoir pendant l’exécution :
- frontend : installation des dépendances puis build
- Go : compilation et test des handlers
- Python : installation puis tests unitaires
- Rust : compilation et test du module health
- intégration locale : démarrage des quatre services puis contrôle de `GET /api/v1/system/status`

## Hors Périmètre Immédiat

- chat conversationnel réel
- streaming token par token
- WebSocket métier
- mémoire SQLite métier et facts atomiques
- STT/TTS/VAD
- gRPC Go ↔ Rust
- système d’outils
- missions, proactivité, skill lab, analytics avancées

## Résultat Attendu Après Exécution

À la fin de cette phase, `aNtaerus` ne sera pas encore l’assistant complet décrit dans le cahier des charges, mais disposera d’une **base d’ingénierie propre, exécutable et extensible** sur laquelle les prochaines phases produit pourront s’appuyer sans refonte structurelle.
