# Plan d'exécution — `M0.3` Communication inter-services

## Résumé

Objectif : implémenter `M0.3` en préparant les contrats et mécanismes de communication inter-services de la fondation, sans empiéter sur les implémentations voix complètes prévues en `M2`.

Portée verrouillée :

- Go ↔ Rust : **contrats Protobuf + génération des stubs Go/Rust**, sans serveur gRPC voix complet ni client voix complet ;
- Go ↔ React : **schémas JSON WebSocket + types associés**, sans hub WebSocket complet ;
- Go : **bus d'événements interne** matérialisé dès `M0.3` ;
- latence : **benchmarks locaux contrôlés** pour Go ↔ Rust et Go ↔ Python, hors CI rapide.

Résultat attendu :

- un contrat Protobuf versionné et générable sous `antaerus/` ;
- des stubs générés côté Go et Rust, intégrés à la structure stricte ;
- un format JSON WebSocket explicite, partagé entre Go et React ;
- un bus interne Go prêt à être réutilisé plus tard par le gateway et les missions ;
- des tests ou benchmarks locaux documentés pour vérifier les cibles `< 10ms` et `< 50ms` ;
- `tasks.md` mis à jour uniquement selon les preuves obtenues.

## Analyse de l'état actuel

### Backlog `M0.3`

Dans `tasks.md`, `M0.3` contient :

- schéma Protobuf gRPC Go ↔ Rust ;
- génération des stubs Go ;
- génération des stubs Rust ;
- format JSON HTTP Go ↔ Python déjà coché ;
- format JSON WebSocket Go ↔ React ;
- bus d'événements interne Go ;
- test latence Go ↔ Rust ;
- test latence Go ↔ Python.

### État réel du dépôt

Le dépôt contient déjà :

- des contrats JSON HTTP dans `antaerus/kernel/schemas/` ;
- un gateway Go HTTP minimal dans `antaerus/interfaces/gateway_go/` ;
- un provider Rust HTTP minimal dans `antaerus/providers/engine_rust/src/` ;
- un frontend React avec types HTTP dans `antaerus/interfaces/web/src/lib/api.ts` ;
- des docs de contrats dans `antaerus/docs/contracts.md`.

En revanche, il manque encore :

- tout dossier `proto/` ou `protocol/` partagé pour `M0.3` ;
- toute génération de stubs Go/Rust ;
- tout schéma WebSocket JSON versionné ;
- tout bus d'événements Go ;
- toute mesure de latence explicitement matérialisée.

### Chevauchement avec les phases ultérieures

Le backlog `M2` prévoit explicitement :

- `engine_rust/protocol/audio.proto`
- `engine_rust/protocol/server.rs`
- `gateway/grpc_client.go`
- le handler WebSocket voix et le proxy audio

Conclusion : `M0.3` doit rester au niveau **fondation contractuelle et mesurable**, sans démarrer l'implémentation fonctionnelle voix complète.

## Changements proposés

### 1. Introduire un espace de contrats de communication partagés

#### Dossiers et fichiers à créer

- `antaerus/kernel/proto/`
- `antaerus/kernel/proto/engine.proto`
- `antaerus/kernel/schemas/websocket-client-message.schema.json`
- `antaerus/kernel/schemas/websocket-server-message.schema.json`
- éventuellement `antaerus/docs/contracts-websocket.md` si la doc doit être séparée

#### Action

- centraliser les contrats `M0.3` dans `kernel/`, conformément à la logique L0 déjà en place ;
- ne pas créer les contrats sous `engine_rust/` à ce stade, car le backlog `M2` prévoit ses propres artefacts d'implémentation détaillée ensuite.

#### Pourquoi

- `M0.3` porte sur les formats inter-services, donc sur des contrats transverses ;
- `kernel/` est déjà l'emplacement de vérité pour les schémas et protocoles communs.

### 2. Définir le Protobuf gRPC fondation Go ↔ Rust

#### Fichier concerné

- `antaerus/kernel/proto/engine.proto`

#### Action

- définir un contrat Protobuf minimal orienté fondation et compatible avec l'évolution future vers `M2`.

#### Contenu recommandé

- service racine de fondation, par exemple `EngineRuntime` ou équivalent ;
- RPC simples et non encore audio-streaming complet, par exemple :
  - `GetHealth`
  - `GetCapabilities`
  - `Ping`
- messages de benchmark de latence très simples, réutilisables pour le test `< 10ms`.

#### Pourquoi

- éviter de préfigurer trop tôt le pipeline audio détaillé de `M2.1` ;
- fournir une base stable pour la génération des stubs et les benchmarks.

#### Comment

- le contrat doit être versionnable, lisible et strictement minimal ;
- prévoir des noms compatibles avec une extension future sans rupture majeure.

### 3. Générer les stubs Go

#### Fichiers/dossiers concernés

- `antaerus/interfaces/gateway_go/internal/gen/enginepb/` ou équivalent
- éventuellement mise à jour de `Taskfile.yml`
- éventuellement mise à jour de `.github/workflows/ci.yml` si une vérification de génération est ajoutée

#### Action

- générer les stubs Go à partir du Protobuf avec `protoc-gen-go` et `protoc-gen-go-grpc`.

#### Pourquoi

- satisfaire explicitement les sous-tâches `M0.3` côté Go ;
- préparer l'intégration ultérieure sans coder encore le client voix de `M2`.

#### Comment

- stocker les fichiers générés dans un emplacement stable sous `interfaces/gateway_go/internal/gen/` ;
- ajouter une commande reproductible dans `Taskfile.yml`, par exemple `generate:proto`.

### 4. Générer les stubs Rust

#### Fichiers/dossiers concernés

- `antaerus/providers/engine_rust/build.rs`
- `antaerus/providers/engine_rust/src/gen/` ou équivalent
- `antaerus/providers/engine_rust/Cargo.toml`

#### Action

- ajouter `tonic-build` ou `tonic-prost-build` en build dependency ;
- configurer la génération Rust à partir du même fichier `.proto`.

#### Pourquoi

- satisfaire la sous-tâche `tonic-build` ;
- garantir l'unicité du contrat entre Go et Rust.

#### Comment

- utiliser le fichier `antaerus/kernel/proto/engine.proto` comme source ;
- garder les artefacts générés Rust dans un emplacement cohérent avec le crate.

### 5. Définir le format JSON WebSocket Go ↔ React

#### Fichiers à créer ou modifier

- `antaerus/kernel/schemas/websocket-client-message.schema.json`
- `antaerus/kernel/schemas/websocket-server-message.schema.json`
- `antaerus/interfaces/web/src/lib/ws.ts` ou équivalent
- `antaerus/interfaces/gateway_go/internal/contracts/websocket.go` ou équivalent
- `antaerus/docs/contracts.md` à compléter

#### Action

- formaliser les événements client → serveur et serveur → client déjà décrits dans le cahier des charges.

#### Formats à matérialiser

- client → serveur :
  - `chat.message`
  - `voice.start`
  - `voice.stop`
  - `voice.barge_in`
  - `mission.cancel`
- serveur → client :
  - `chat.token`
  - `chat.complete`
  - `voice.transcript`
  - `voice.audio`
  - `voice.vad_state`
  - `mission.update`
  - `system.alert`
  - `proactive.notification`
  - `health.heartbeat`

#### Pourquoi

- `M0.3` demande explicitement le format JSON WebSocket ;
- ces événements existent déjà dans le cahier des charges, ce qui évite d'inventer un protocole parallèle.

#### Comment

- utiliser un enveloppe commune du type :
  - `type`
  - `timestamp`
  - `payload`
- créer les JSON Schemas dans `kernel/schemas/` ;
- créer des types TypeScript dans le frontend ;
- créer des structs Go dédiées, sans encore brancher un vrai hub WebSocket.

### 6. Implémenter le bus d'événements interne Go

#### Fichiers à créer

- `antaerus/engine/bus/event_bus.go` ou `antaerus/engine/events/bus.go`
- éventuellement tests associés :
  - `antaerus/engine/bus/event_bus_test.go`

#### Action

- créer un bus interne fondation basé sur `channels` + `goroutines`.

#### Capacités minimales recommandées

- publication d'événements ;
- abonnement ;
- fan-out vers plusieurs consommateurs ;
- fermeture propre ;
- non-blocage minimal ou buffer configurable.

#### Pourquoi

- sous-tâche explicite de `M0.3` ;
- le cahier des charges désigne déjà `bus/` comme brique du L2 Go.

#### Comment

- garder l'API simple et réutilisable ;
- réutiliser, si possible, les concepts de `SystemEvent` déjà définis dans `kernel/contracts/protocols.go`.

### 7. Préparer des benchmarks locaux Go ↔ Rust

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/bench/grpc_latency_test.go` ou équivalent
- éventuellement script de lancement :
  - `antaerus/scripts/validation/bench-grpc-latency.ps1`
  - `antaerus/scripts/validation/bench-grpc-latency.sh`

#### Action

- mesurer localement la latence d'un appel minimal Go → Rust basé sur les stubs gRPC générés.

#### Pourquoi

- `M0.3` demande explicitement le test `< 10ms` ;
- ce benchmark doit être local et contrôlé, conformément à la décision utilisateur.

#### Comment

- démarrer un serveur Rust minimal fondation pour le contrat `Ping` si nécessaire, ou un mock/stub compatible ;
- mesurer en boucle sur loopback avec seuil explicite ;
- ne pas intégrer cette mesure dans la CI rapide.

### 8. Préparer des benchmarks locaux Go ↔ Python

#### Fichiers à créer

- `antaerus/interfaces/gateway_go/internal/bench/http_latency_test.go` ou équivalent
- éventuellement script de lancement :
  - `antaerus/scripts/validation/bench-http-latency.ps1`
  - `antaerus/scripts/validation/bench-http-latency.sh`

#### Action

- mesurer localement la latence Go → Python via l'endpoint HTTP minimal existant.

#### Pourquoi

- sous-tâche explicite `< 50ms` ;
- l'HTTP Go ↔ Python existe déjà, donc la mesure est directement ancrée dans le dépôt actuel.

#### Comment

- cibler `/health` ou un endpoint minimal équivalent ;
- mesurer sur loopback, en environnement local, avec seuil clair.

### 9. Étendre l'orchestration et la validation

#### Fichiers concernés

- `Taskfile.yml`
- `.github/workflows/ci.yml`
- `antaerus/README.md`
- `antaerus/docs/contracts.md`

#### Action

- ajouter les commandes de génération et de validation des contrats ;
- documenter où se trouvent les schémas Protobuf et WebSocket ;
- décider si la CI vérifie seulement la présence/cohérence, ou si la génération doit être rejouée.

#### Approche recommandée

- CI rapide :
  - validation légère des schémas/artefacts générés si faisable ;
- hors CI rapide :
  - benchmarks de latence et génération lourde si nécessaire.

#### Pourquoi

- `M0.3` doit être reproductible et maintenable, pas seulement livré manuellement.

### 10. Mettre `tasks.md` à jour selon les preuves finales

#### Fichier concerné

- `tasks.md`

#### Action

- cocher les sous-tâches `M0.3` réellement closes ;
- laisser ouvertes celles qui ne seraient que partiellement matérialisées ;
- compléter le bloc `État actuel` avec les chemins exacts créés et les benchmarks disponibles.

## Hypothèses et décisions

- `M0.3` prépare l'intégration inter-services sans réaliser encore le pipeline voix complet de `M2` ;
- le contrat Protobuf de fondation doit rester minimal et extensible ;
- le format WebSocket doit être matérialisé en schémas JSON et types partagés, sans hub réel à ce stade ;
- les benchmarks de latence sont locaux et contrôlés, non bloquants pour la CI rapide ;
- `tasks.md` doit rester la source opérationnelle fidèle à l'état réellement implémenté.

## Séquence d'exécution recommandée

1. Créer l'espace de contrats partagé pour `M0.3`.
2. Définir `antaerus/kernel/proto/engine.proto`.
3. Générer et intégrer les stubs Go.
4. Générer et intégrer les stubs Rust.
5. Définir les schémas JSON WebSocket et les types Go/TypeScript.
6. Implémenter le bus d'événements interne Go.
7. Ajouter les benchmarks locaux Go ↔ Rust et Go ↔ Python.
8. Étendre `Taskfile.yml`, la documentation et éventuellement la CI.
9. Exécuter les validations et benchmarks locaux.
10. Mettre à jour `tasks.md` avec les preuves finales.

## Vérifications

### Vérifications contrats

- `antaerus/kernel/proto/engine.proto` existe et compile pour Go/Rust ;
- les schémas WebSocket existent dans `antaerus/kernel/schemas/` ;
- la documentation des contrats reflète ces nouveaux artefacts.

### Vérifications génération

- les stubs Go sont générés dans l'arborescence cible ;
- les stubs Rust sont générés via `tonic-build` ;
- la génération est reproductible via une commande documentée.

### Vérifications Go

- le bus d'événements Go compile et passe ses tests ;
- les structs/types WebSocket Go compilent avec le gateway existant ;
- les tests/benchmarks Go continuent de passer.

### Vérifications Web

- les types TypeScript WebSocket compilent avec `npm run check` ;
- aucun conflit avec les types HTTP déjà présents.

### Vérifications latence

- un benchmark local Go ↔ Rust existe et mesure la cible `< 10ms` ;
- un benchmark local Go ↔ Python existe et mesure la cible `< 50ms` ;
- les résultats sont documentés de façon minimale dans `tasks.md` ou la documentation associée.

### Vérifications backlog

- les éléments `M0.3` effectivement terminés sont cochés dans `tasks.md` ;
- les éléments restant partiels gardent un état intermédiaire explicite.

## Résultat attendu

À l'issue de `M0.3`, le dépôt doit disposer :

- d'une fondation contractuelle claire pour Go ↔ Rust et Go ↔ React ;
- d'un bus interne Go prêt à supporter les flux futurs ;
- de stubs gRPC réellement générés des deux côtés ;
- de benchmarks locaux prouvant la faisabilité des cibles de latence ;
- d'un `tasks.md` fidèle à l'état réel des communications inter-services.
