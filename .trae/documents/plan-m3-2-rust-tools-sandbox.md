# Plan M3.2 - Rust Tools Sandbox

## Résumé

Objectif: implémenter `M3.2` côté `engine_rust` en livrant un socle natif de sandbox Rust pour le filesystem, la CLI whitelistée et un runtime WASM minimal réel, sans encore exposer ces capacités via un nouveau RPC gRPC ni migrer les wrappers Python vers Rust dans ce lot.

Décisions verrouillées pendant le cadrage:

- portée d'exposition: **socle Rust local uniquement**
- profondeur WASM: **runtime minimal réel**
- intégration inter-services: **pas de nouveau pont gRPC/Go/Python dans M3.2**

Effet attendu à la fin du lot:

- `engine_rust` contient les modules `fs/`, `cli/` et `sandbox/`
- le sandbox filesystem applique une whitelist de chemins
- la sandbox CLI exécute uniquement des commandes explicitement autorisées, sans shell libre
- le runtime WASM charge et exécute un module simple sous `wasmtime` avec limites minimales
- les capabilities HTTP du moteur Rust reflètent ces nouvelles capacités
- les validations Rust ciblées sont vertes

## Analyse De L'état Actuel

- `tasks.md` définit `M3.2` comme quatre sous-tâches Rust: `fs/sandbox.rs`, `fs/reader.rs`, `cli/sandbox.rs` et `sandbox/wasm.rs` dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L267-L271).
- Le provider Rust actuel n'expose encore aucun module `fs`, `cli` ou `sandbox`; [lib.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/lib.rs#L1-L9) ne publie que `bootstrap`, `audio`, `config`, `crypto`, `grpc`, `grpc_service`, `http`, `protocol` et `state`.
- Les dépendances Rust nécessaires au sandbox ne sont pas encore déclarées; [Cargo.toml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/Cargo.toml#L1-L31) ne contient ni `cap-std`, ni `wasmtime`, ni lecteur YAML de config.
- Les capabilities actuelles du moteur Rust restent centrées sur l'audio dans [state.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/state.rs#L36-L52), sans signaler `fs`, `cli` ou `wasm`.
- Le contrat gRPC réel reste minimal dans [engine.proto](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/kernel/proto/engine.proto#L7-L10), avec seulement `Ping`, `GetHealth` et `GetCapabilities`.
- Le CDC cible bien `filesystem` et `cli` en Rust sandboxé, ainsi que `code` via `wasmtime`, dans [cahier-des-charges.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/cahier-des-charges.md#L150-L153) et [cahier-des-charges.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/cahier-des-charges.md#L404-L414).
- Le lot `M3.1` a déjà figé les wrappers Python `filesystem` et `cli` comme façade temporaire en attendant ce sandbox Rust, avec une config versionnée partagée dans [tools.yaml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/config/tools.yaml).

## Changements Proposés

### 1. Étendre la configuration Rust pour le sandbox tools

Fichiers:

- `antaerus/providers/engine_rust/src/config.rs`
- `antaerus/.env.example`

Plan:

- ajouter à `Settings` les chemins nécessaires au sandbox tools, avec valeurs par défaut ancrées dans `antaerus/`:
  - `tools_config_path`
  - `tools_sandbox_root`
- introduire deux variables d'environnement dédiées au moteur Rust:
  - `ANTAERUS_ENGINE_TOOLS_CONFIG_PATH`
  - `ANTAERUS_ENGINE_TOOLS_SANDBOX_ROOT`
- garder la logique de configuration immuable au boot, cohérente avec le reste du dépôt

Pourquoi:

- le moteur Rust doit pouvoir lire la même source de vérité versionnée que les wrappers Python
- il faut éviter une duplication de configuration entre Python et Rust

### 2. Introduire un loader Rust de la config partagée `tools.yaml`

Fichiers:

- nouveau `antaerus/providers/engine_rust/src/tools_config.rs`
- `antaerus/providers/engine_rust/Cargo.toml`
- `antaerus/providers/engine_rust/src/lib.rs`

Plan:

- créer un module Rust dédié au chargement de `antaerus/config/tools.yaml`
- y définir des structures sérialisables minimales pour:
  - `filesystem.allowed_roots`
  - `filesystem.max_bytes`
  - `cli.allowed_commands`
  - `cli.timeout_seconds`
- charger proprement la config avec fallback sûr si le fichier est absent ou invalide
- ajouter les dépendances nécessaires, notamment un lecteur YAML léger compatible avec `serde`

Pourquoi:

- `tools.yaml` est déjà la source de vérité versionnée issue de `M3.1`
- un module dédié évite d'éparpiller la logique de parsing entre `fs` et `cli`

### 3. Implémenter le sandbox filesystem Rust

Fichiers:

- nouveau `antaerus/providers/engine_rust/src/fs/mod.rs`
- nouveau `antaerus/providers/engine_rust/src/fs/sandbox.rs`
- nouveau `antaerus/providers/engine_rust/src/fs/reader.rs`
- `antaerus/providers/engine_rust/Cargo.toml`
- `antaerus/providers/engine_rust/src/lib.rs`

Plan:

- créer un module `fs` exporté par la crate
- utiliser `cap-std` comme base du sandbox filesystem, conformément au CDC
- dans `sandbox.rs`, implémenter la résolution des racines autorisées et la validation qu'un chemin demandé reste contenu dans une whitelist
- dans `reader.rs`, implémenter une lecture fichier texte sécurisée, bornée par un `max_bytes`
- garder le périmètre volontairement minimal:
  - lecture seule
  - pas d'écriture
  - pas de recherche récursive avancée
  - pas de patterns/globbing dans ce lot sauf si une petite primitive de listage est indispensable aux tests

Pourquoi:

- cela matérialise le déplacement du garde-fou `filesystem` depuis Python vers un socle Rust natif
- `fs/sandbox.rs` et `fs/reader.rs` correspondent exactement aux attentes du backlog

Comment:

- s'aligner fonctionnellement sur les invariants déjà visibles dans `brain_python/tools/filesystem.py`
- refuser explicitement:
  - whitelist vide
  - chemin hors sandbox
  - cible inexistante
  - taille excessive si dépassement non autorisé

### 4. Implémenter la sandbox CLI Rust

Fichiers:

- nouveau `antaerus/providers/engine_rust/src/cli/mod.rs`
- nouveau `antaerus/providers/engine_rust/src/cli/sandbox.rs`
- `antaerus/providers/engine_rust/src/lib.rs`

Plan:

- créer un module `cli` exporté par la crate
- implémenter une exécution de commande whitelistée sans shell libre
- normaliser le nom de commande pour comparer contre `allowed_commands`
- exécuter dans `tools_sandbox_root`
- capturer `stdout`, `stderr` et `exit_code`
- appliquer un timeout explicite issu de `tools.yaml`, avec fallback sûr

Pourquoi:

- cela remplace le garde-fou Python par un socle Rust local plus robuste
- la checklist `M3.2` demande explicitement `engine_rust/cli/sandbox.rs`

Comment:

- répliquer les invariants de sécurité déjà posés dans `brain_python/tools/cli.py`
- refuser explicitement:
  - whitelist vide
  - commande non autorisée
  - usage implicite d'un shell
  - timeout dépassé

### 5. Implémenter un runtime WASM minimal réel

Fichiers:

- nouveau `antaerus/providers/engine_rust/src/sandbox/mod.rs`
- nouveau `antaerus/providers/engine_rust/src/sandbox/wasm.rs`
- `antaerus/providers/engine_rust/Cargo.toml`
- `antaerus/providers/engine_rust/src/lib.rs`

Plan:

- ajouter `wasmtime`
- créer un runtime WASM minimal capable de:
  - charger un module depuis un chemin local autorisé
  - instancier le module
  - exécuter une fonction exportée simple, par exemple sans paramètres et retour `i32`, ou avec une signature minimale fixe
- poser des garde-fous de base:
  - validation du chemin du module
  - limites mémoire/ressources disponibles dans `wasmtime`
  - timeouts ou interruption minimale si une primitive sûre et simple est accessible dans le lot
- rester volontairement hors scope sur:
  - host functions riches
  - I/O complexe
  - protocole skill complet
  - sandbox skill marketplace de `M7`

Pourquoi:

- le CDC cible explicitement un runtime WASM via `wasmtime`
- la décision produit verrouillée est un runtime **minimal mais réel**, pas un simple squelette

### 6. Exposer les nouvelles capacités du moteur Rust

Fichiers:

- `antaerus/providers/engine_rust/src/state.rs`
- éventuellement `antaerus/providers/engine_rust/src/http.rs`
- tests associés dans `antaerus/providers/engine_rust/tests/health.rs`

Plan:

- enrichir `build_capabilities()` pour refléter le socle `M3.2`, par exemple avec:
  - `fs-sandbox`
  - `fs-readonly-reader`
  - `cli-sandbox`
  - `wasm-runtime`
- conserver le contrat HTTP actuel `/capabilities` inchangé en forme

Pourquoi:

- même sans intégration gRPC, le moteur doit déclarer qu'il supporte désormais ces briques
- cela prépare la découverte inter-services des étapes futures

### 7. Ajouter une couverture de tests Rust ciblée

Fichiers:

- nouveau `antaerus/providers/engine_rust/tests/fs_sandbox.rs`
- nouveau `antaerus/providers/engine_rust/tests/cli_sandbox.rs`
- nouveau `antaerus/providers/engine_rust/tests/wasm_runtime.rs`
- mise à jour potentielle de `antaerus/providers/engine_rust/tests/health.rs`

Plan:

- ajouter des tests comportementaux, avec `tempdir` ou équivalent si nécessaire
- pour `fs`:
  - lecture autorisée dans une racine whitelistée
  - refus d'un chemin hors whitelist
  - refus si la whitelist est vide
- pour `cli`:
  - exécution d'une commande autorisée
  - refus d'une commande non whitelistée
  - gestion du timeout
- pour `wasm`:
  - chargement et exécution d'un module minimal de test
  - refus d'un chemin non autorisé ou d'un module invalide
- pour `health`:
  - vérifier que les nouvelles capabilities apparaissent

Pourquoi:

- `M3.2` est un lot de sûreté et d'encapsulation; la couverture de régression est essentielle
- la suite de tests actuelle du moteur Rust donne déjà un pattern d'intégration simple à suivre

### 8. Documenter la clôture du lot

Fichiers:

- `tasks.md`
- `antaerus/docs/contracts.md`
- éventuellement `antaerus/providers/brain_python/README.md`

Plan:

- mettre à jour `tasks.md` pour marquer `M3.2` comme livré et ajouter un bloc `État actuel`
- documenter dans `contracts.md` que `M3.2` introduit des capacités Rust locales de sandbox, sans nouveau RPC dans ce lot
- si nécessaire, ajuster le README Python pour rappeler que les wrappers `filesystem` et `cli` restent préparatoires tant que le pont d'intégration n'est pas fait

Pourquoi:

- `tasks.md` reste la source de vérité opérationnelle
- il faut éviter toute confusion entre “socle Rust livré” et “intégration complète M3.3 non encore faite”

## Hypothèses Et Décisions

- `M3.2` ne modifie pas `engine.proto` et n'ajoute aucun nouveau RPC.
- `M3.2` ne rebranche pas encore `brain_python/tools/filesystem.py` ni `brain_python/tools/cli.py` sur Rust.
- `antaerus/config/tools.yaml` reste la source de vérité partagée pour la whitelist `filesystem` et `cli`.
- Le sandbox filesystem reste **lecture seule** dans ce lot.
- La sandbox CLI reste **sans shell libre** et bornée par timeout.
- Le runtime WASM livré est minimal mais exécutable, et ne vise pas encore le système de skills complet.
- Les nouvelles capacités Rust sont visibles via `/capabilities`, mais pas encore consommées par un orchestrateur métier.

## Vérifications

Vérifications Rust:

- `cargo check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test`

Vérifications fonctionnelles:

- le sandbox FS lit un fichier autorisé et refuse un chemin hors whitelist
- le sandbox CLI exécute une commande autorisée et refuse une commande non autorisée
- le runtime WASM charge un module de test et exécute une fonction exportée simple
- `/capabilities` du moteur Rust inclut les nouvelles entrées `M3.2`

Vérifications d'architecture:

- aucun fichier créé hors `antaerus/`
- la whitelist Rust lit `antaerus/config/tools.yaml`
- aucun nouveau contrat gRPC n'est introduit dans `M3.2`
- les wrappers Python restent en place jusqu'au lot d'intégration suivant
