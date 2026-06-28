# Plan d'exécution — `M0.3` Finalisation communication inter-services

## Résumé

Objectif : terminer `M0.3` sur la base de l'état réel du dépôt, sans élargir le périmètre vers la stack voix complète de `M2`.

Succès attendu :

- contrat Protobuf fondation Go ↔ Rust stabilisé sous `antaerus/kernel/proto/engine.proto` ;
- stubs Go générés dans le bon emplacement sous `antaerus/interfaces/gateway_go/internal/gen/enginepb/` ;
- génération Rust intégrée proprement au crate `antaerus/providers/engine_rust/` via `tonic-build` ;
- schémas WebSocket et types Go/TypeScript conservés et, si nécessaire, alignés finement ;
- bus d'événements interne Go implémenté avec tests ;
- benchmarks locaux documentés pour Go ↔ Rust et Go ↔ Python ;
- `tasks.md` synchronisé uniquement après validations réelles.

## Analyse de l'état actuel

### Fichiers déjà présents

Le dépôt contient déjà les briques suivantes :

- `antaerus/kernel/proto/engine.proto`
- `antaerus/kernel/schemas/websocket-client-message.schema.json`
- `antaerus/kernel/schemas/websocket-server-message.schema.json`
- `antaerus/interfaces/web/src/lib/ws.ts`
- `antaerus/interfaces/gateway_go/internal/contracts/websocket.go`
- `antaerus/docs/contracts.md`

Ces artefacts couvrent déjà une partie importante de `M0.3`, mais ils ne sont pas encore reflétés dans `tasks.md`.

### Problème concret déjà observé

Les stubs Go ont été générés au mauvais endroit :

- chemin actuel erroné : `antaerus/antaerus/interfaces/gateway_go/internal/gen/enginepb/`
- chemin cible : `antaerus/interfaces/gateway_go/internal/gen/enginepb/`

Cause : le `go_package` du proto et la commande `protoc --go_out=antaerus --go-grpc_out=antaerus ...` ont produit une duplication du préfixe `antaerus/`.

### Ce qui manque encore réellement

- aucun mécanisme Rust de génération/consommation du proto n'est encore présent ;
- `antaerus/providers/engine_rust/Cargo.toml` ne contient pas `tonic`, `prost` ni build-dependencies liées au proto ;
- aucun bus d'événements Go n'existe dans `antaerus/engine/` ou `antaerus/interfaces/gateway_go/` ;
- aucun benchmark de latence n'existe ;
- aucune tâche `Taskfile.yml` dédiée à la génération proto ou aux benchmarks n'existe.

### Contraintes de portée

`M0.3` reste fondationnel :

- pas de pipeline audio complet ;
- pas de hub WebSocket métier complet ;
- pas de client voix Go final ;
- pas de serveur audio Rust `M2`.

En revanche, un serveur gRPC Rust minimal de fondation est acceptable si c'est le moyen le plus direct de rendre le benchmark Go ↔ Rust réel et de valider les stubs.

## Décisions verrouillées

- Le proto partagé reste `antaerus/kernel/proto/engine.proto`.
- Le service proto reste `EngineRuntime` avec `Ping`, `GetHealth`, `GetCapabilities`.
- Les stubs Go seront **commités** dans `antaerus/interfaces/gateway_go/internal/gen/enginepb/`.
- La génération Rust utilisera `build.rs` + `tonic-build`, avec inclusion via `tonic::include_proto!`.
- Le bus d'événements Go sera placé dans `antaerus/engine/events/` pour rester transversal et non spécifique au gateway.
- Les benchmarks resteront hors CI rapide et seront déclenchés via scripts de validation et tâches `Taskfile`.
- `tasks.md` ne sera mis à jour qu'après preuves de compilation/test/bench.

## Changements proposés

### 1. Corriger et stabiliser la génération Go

#### Fichiers concernés

- `antaerus/interfaces/gateway_go/internal/gen/enginepb/engine.pb.go`
- `antaerus/interfaces/gateway_go/internal/gen/enginepb/engine_grpc.pb.go`
- suppression du dossier erroné `antaerus/antaerus/interfaces/gateway_go/internal/gen/enginepb/`
- `Taskfile.yml`
- éventuellement `antaerus/docs/contracts.md`

#### Action

- régénérer les stubs Go directement dans le dossier cible avec `paths=source_relative` pour éviter toute redondance de chemin ;
- supprimer ensuite l'arborescence imbriquée erronée ;
- ajouter une commande reproductible dans `Taskfile.yml`.

#### Commande cible

La génération visée doit être de la forme :

```bash
protoc \
  --proto_path=antaerus/kernel/proto \
  --go_out=paths=source_relative:antaerus/interfaces/gateway_go/internal/gen/enginepb \
  --go-grpc_out=paths=source_relative:antaerus/interfaces/gateway_go/internal/gen/enginepb \
  antaerus/kernel/proto/engine.proto
```

#### Pourquoi

- corrige le défaut actuel sans déplacer manuellement des fichiers générés ;
- rend la génération idempotente ;
- garde les stubs Go dans un emplacement stable et idiomatique pour le module `antaerus`.

### 2. Intégrer la génération Rust à partir du proto partagé

#### Fichiers à créer ou modifier

- `antaerus/providers/engine_rust/build.rs`
- `antaerus/providers/engine_rust/Cargo.toml`
- `antaerus/providers/engine_rust/src/grpc.rs`
- `antaerus/providers/engine_rust/src/lib.rs`

#### Action

- ajouter les dépendances runtime minimales : `tonic`, `prost` ;
- ajouter les build-dependencies : `tonic-build` et `protoc-bin-vendored` ;
- écrire `build.rs` pour compiler `../../kernel/proto/engine.proto` ;
- exposer le module généré via `src/grpc.rs` et `tonic::include_proto!("antaerus.kernel.engine.v1")`.

#### Détail d'implantation

- `build.rs` utilisera `protoc_bin_vendored::protoc_bin_path()` puis positionnera `PROTOC` avant l'appel à `tonic_build::configure().compile_protos(...)` ;
- `src/grpc.rs` contiendra un module unique, par exemple :

```rust
pub mod enginepb {
    tonic::include_proto!("antaerus.kernel.engine.v1");
}
```

- `src/lib.rs` exportera `pub mod grpc;`.

#### Pourquoi

- évite une dépendance système fragile à `protoc` dans la CI et sur Windows ;
- garde Rust aligné sur le proto unique du `kernel`.

### 3. Ajouter un service gRPC Rust minimal de fondation

#### Fichiers à créer ou modifier

- `antaerus/providers/engine_rust/src/grpc_service.rs`
- `antaerus/providers/engine_rust/src/bootstrap.rs`
- `antaerus/providers/engine_rust/src/config.rs`
- `antaerus/providers/engine_rust/src/main.rs`
- éventuellement `antaerus/providers/engine_rust/tests/grpc_health.rs`

#### Action

- implémenter un service `EngineRuntime` minimal servant `Ping`, `GetHealth` et `GetCapabilities` ;
- lancer ce serveur sur un port gRPC dédié configurable, en parallèle du serveur HTTP existant ;
- limiter ce service à la fondation, sans flux audio ni streaming complexe.

#### Décision d'interface

- ajouter un port gRPC de fondation, par exemple via `ANTAERUS_ENGINE_GRPC_PORT`, avec une valeur par défaut dédiée ;
- `Ping` renvoie le `request_id`, l'horodatage reçu et un horodatage de réception ;
- `GetHealth` et `GetCapabilities` réutilisent les données déjà exposées par le provider Rust.

#### Pourquoi

- rend possible un benchmark Go ↔ Rust réellement inter-langage ;
- valide de bout en bout les stubs et le contrat, sans attendre `M2`.

### 4. Consommer les stubs côté Go

#### Fichiers à créer ou modifier

- `antaerus/interfaces/gateway_go/internal/clients/engine_grpc_client.go`
- éventuellement `antaerus/interfaces/gateway_go/internal/clients/rust_client.go`
- éventuellement `antaerus/interfaces/gateway_go/internal/config/`

#### Action

- ajouter un client gRPC minimal pour `Ping`, `GetHealth` et `GetCapabilities` ;
- conserver le client HTTP existant pour ne pas casser l'état actuel du gateway ;
- utiliser ce client essentiellement pour benchmark et validation M0.3.

#### Décision de compatibilité

- le client HTTP existant n'est pas supprimé ;
- le client gRPC est additionnel, de manière à ne pas empiéter sur l'intégration complète prévue plus tard.

#### Pourquoi

- permet de compiler réellement les stubs Go dans un usage concret ;
- fournit la base nécessaire au benchmark de latence.

### 5. Consolider le protocole WebSocket partagé

#### Fichiers à vérifier et potentiellement ajuster

- `antaerus/kernel/schemas/websocket-client-message.schema.json`
- `antaerus/kernel/schemas/websocket-server-message.schema.json`
- `antaerus/interfaces/web/src/lib/ws.ts`
- `antaerus/interfaces/gateway_go/internal/contracts/websocket.go`
- `antaerus/docs/contracts.md`

#### Action

- vérifier que les schémas JSON, les types TypeScript et les types Go décrivent exactement le même envelope contract ;
- si besoin, compléter les payloads minimaux manquants pour que les trois représentations soient cohérentes.

#### Règle à respecter

- enveloppe commune : `type`, `timestamp`, `payload` ;
- pas d'implémentation de hub WebSocket ;
- seulement la définition contractuelle et typée.

#### Pourquoi

- le dépôt a déjà avancé sur ce point, mais le plan doit prévoir une étape d'alignement, pas une recréation aveugle ;
- cela garantit que `tasks.md` pourra cocher le format WebSocket sur une preuve cohérente.

### 6. Implémenter le bus d'événements interne Go

#### Fichiers à créer

- `antaerus/engine/events/bus.go`
- `antaerus/engine/events/bus_test.go`

#### Action

- créer un bus pub/sub minimal fondé sur `channels` + `goroutines` ;
- réutiliser `antaerus/kernel/contracts/protocols.go` et son `SystemEvent` comme type d'événement de base ;
- proposer une API simple de type `Subscribe`, `Publish`, `Close`.

#### Comportement attendu

- plusieurs abonnés reçoivent le même événement ;
- fermeture propre des abonnements ;
- tests sur fan-out, fermeture et non-régression concurrente de base.

#### Pourquoi

- c'est une sous-tâche directe de `M0.3` ;
- `engine/` est l'endroit le plus neutre pour un bus interne transversal.

### 7. Ajouter les benchmarks locaux Go ↔ Rust et Go ↔ Python

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/bench/grpc_latency_test.go`
- `antaerus/interfaces/gateway_go/internal/bench/http_latency_test.go`
- `antaerus/scripts/validation/bench-go-rust-latency.ps1`
- `antaerus/scripts/validation/bench-go-rust-latency.sh`
- `antaerus/scripts/validation/bench-go-python-latency.ps1`
- `antaerus/scripts/validation/bench-go-python-latency.sh`

#### Action

- benchmark Go ↔ Rust :
  - démarrer le provider Rust fondation ;
  - appeler `Ping` sur loopback ;
  - mesurer une latence moyenne/p95 ;
  - vérifier la cible `< 10ms` en local contrôlé.
- benchmark Go ↔ Python :
  - démarrer le provider Python existant ;
  - appeler l'endpoint HTTP santé/capacités ;
  - mesurer la latence moyenne/p95 ;
  - vérifier la cible `< 50ms`.

#### Décision d'exécution

- les scripts PowerShell/Bash gèrent le démarrage, l'attente active, l'exécution du benchmark et l'arrêt des processus ;
- les benchmarks ne sont pas ajoutés aux lanes rapides de CI.

#### Pourquoi

- le user a explicitement choisi un bench local contrôlé ;
- les scripts de validation existants offrent déjà un patron adapté.

### 8. Étendre l'orchestration développeur

#### Fichiers à modifier

- `Taskfile.yml`
- `antaerus/README.md`
- `antaerus/docs/contracts.md`
- éventuellement `tasks.md`

#### Action

- ajouter des tâches de génération proto, par exemple :
  - `generate:proto:go`
  - `generate:proto`
  - `bench:latency:rust`
  - `bench:latency:python`
- documenter :
  - où se trouve le proto partagé ;
  - où résident les stubs Go ;
  - comment la génération Rust fonctionne ;
  - comment lancer les benchmarks locaux.

#### Décision CI

- ne pas modifier `.github/workflows/ci.yml` sauf si une lacune réelle apparaît pendant l'implémentation ;
- privilégier l'absence de churn CI tant que `go test`, `cargo test`, `cargo check` et `npm run check` couvrent déjà la compilation des nouveaux artefacts ;
- les benchmarks restent hors CI.

#### Pourquoi

- le besoin prioritaire est la reproductibilité locale ;
- la CI actuelle est déjà structurée et ne doit évoluer que si c'est techniquement nécessaire.

### 9. Synchroniser `tasks.md` après preuve

#### Fichier à modifier

- `tasks.md`

#### Action

- cocher :
  - schéma Protobuf Go ↔ Rust ;
  - stubs Go ;
  - stubs Rust ;
  - format WebSocket Go ↔ React ;
  - bus d'événements interne Go ;
  - latence Go ↔ Rust ;
  - latence Go ↔ Python ;
- enrichir le bloc `État actuel` de `M0.3` avec les chemins réels et les validations exécutées.

#### Pourquoi

- respecter la règle projet : `tasks.md` comme source de vérité opérationnelle.

## Séquence d'implémentation

1. Régénérer les stubs Go dans le bon dossier et supprimer l'arborescence imbriquée erronée.
2. Ajouter la génération Rust (`Cargo.toml`, `build.rs`, `src/grpc.rs`, `src/lib.rs`).
3. Implémenter le service gRPC Rust minimal de fondation.
4. Ajouter le client gRPC Go minimal.
5. Aligner et vérifier les artefacts WebSocket déjà présents.
6. Créer le bus d'événements Go et ses tests.
7. Ajouter les benchmarks Go ↔ Rust et Go ↔ Python avec scripts de validation.
8. Étendre `Taskfile.yml` et la documentation.
9. Exécuter les validations Go, Rust, Web et les benchmarks locaux.
10. Mettre à jour `tasks.md` selon les preuves.

## Vérifications

### Go

- `go test ./interfaces/gateway_go/...`
- tests du bus d'événements passants
- compilation du package `internal/gen/enginepb`
- benchmark gRPC local exploitable

### Rust

- `cargo fmt --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo check`
- `cargo test`
- compilation effective des artefacts générés depuis `engine.proto`

### Web

- `npm run check`
- cohérence des types `ws.ts`

### Contrats

- cohérence entre :
  - `antaerus/kernel/proto/engine.proto`
  - stubs Go
  - modules Rust générés
  - schémas JSON WebSocket
  - types Go/TypeScript

### Benchmarks

- Go ↔ Rust : cible locale `< 10ms`
- Go ↔ Python : cible locale `< 50ms`
- scripts PowerShell et Bash exécutables

### Backlog

- `tasks.md` mis à jour uniquement après validations réelles ;
- état `M0.3` aligné sur les fichiers livrés.

## Risques surveillés

- disponibilité de `protoc` côté Go en environnement local ;
- interaction entre `tonic-build` et Windows/OneDrive ;
- nécessité éventuelle d'ajouter un port gRPC au provider Rust sans casser les smoke tests HTTP existants ;
- dérive de portée vers `M2` si le service gRPC Rust devient trop ambitieux.

## Résultat attendu

À la fin de l'exécution, `M0.3` doit livrer une fondation inter-services réellement compilable et mesurable :

- un contrat gRPC partagé unique ;
- des stubs Go et Rust reproductibles ;
- un protocole WebSocket partagé et aligné ;
- un bus d'événements Go testé ;
- des benchmarks locaux de latence ;
- un `tasks.md` fidèle à l'état réel du monorepo.
