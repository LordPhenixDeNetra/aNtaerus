# Plan d'exécution — `M0.2` CI/CD & Tooling

## Résumé

Objectif : implémenter l'ensemble de `M0.2` dans le dépôt actuel, en gardant `tasks.md` comme backlog principal et `cahier-des-charges.md` comme référence d'architecture.

Le périmètre couvre :

- durcir l'hygiène dépôt avec un `.gitignore` plus robuste ;
- transformer la CI actuelle en deux lanes distinctes ;
- intégrer les outils de lint, format, typecheck et validation pour Python, Go, Rust et Web ;
- introduire un `Taskfile` cross-platform ;
- configurer `pre-commit` ;
- créer des scripts de smoke tests de démarrage ;
- mettre `tasks.md` à jour sous-tâche par sous-tâche une fois les validations réellement passées.

Décisions verrouillées :

- orchestrateur : `Taskfile`
- CI : lane rapide sur `push` / `pull_request`, lane lourde sur `main` + hebdo
- Python kernel : packaging minimal du `kernel/` pour rendre `mypy` et `import-linter` exploitables

## Analyse de l'état actuel

### Backlog `M0.2`

Dans `tasks.md`, les sous-tâches `M0.2` encore ouvertes sont :

- `.gitignore` robuste
- GitHub Actions rapide + lourde
- `ruff`
- `import-linter`
- `mypy`
- `golangci-lint`
- `clippy` + `cargo fmt` + `cargo check`
- `eslint` + `prettier`
- configuration `pytest` unitaire + complète
- `Taskfile`
- `pre-commit`
- `scripts/validation/`

### État de la CI

Le fichier [ci.yml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.github/workflows/ci.yml) contient déjà une CI fondation unique :

- `push` et `pull_request` sans séparation de lanes ;
- jobs `web`, `gateway`, `brain`, `engine` ;
- exécution des tests de base, mais sans lint/typecheck structurés ni smoke tests.

### État des outils existants

#### Web

Le fichier [package.json](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/package.json) expose déjà :

- `lint` via `eslint`
- `check` via `tsc -b --noEmit`
- `build`
- `test`

Mais il manque :

- `prettier`
- scripts dédiés au format/check format
- intégration `pre-commit`

#### Python

Le fichier [pyproject.toml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/pyproject.toml) contient :

- les dépendances runtime minimales ;
- `pytest` en dépendance dev ;
- un bloc `tool.pytest.ini_options` très léger.

Il manque :

- `ruff`
- `mypy`
- `import-linter`
- séparation marquée des suites `pytest`
- éventuels marqueurs de tests

#### Rust

Le fichier [Cargo.toml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/Cargo.toml) est minimal et ne porte pas de configuration qualité particulière.

Il manque :

- commandes standardisées dans la CI et le `Taskfile` pour :
  - `cargo fmt --check`
  - `cargo clippy`
  - `cargo check`
  - `cargo test`

#### Go

Le module racine [go.mod](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/go.mod) existe et la base `go test` passe, mais il manque :

- configuration `golangci-lint`
- exécution dédiée de lint en CI et dans l'orchestrateur

### État du dépôt

Le fichier [.gitignore](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.gitignore) couvre déjà quelques artefacts locaux, mais reste insuffisant pour `M0.2` :

- pas d'entrée explicite pour `memory_data/`
- pas d'entrée explicite pour `bundle/`
- couverture partielle des caches/outils modernes

### Packaging Python du `kernel`

Le dossier `antaerus/kernel/` contient des fichiers Python comme :

- `kernel/contracts/contracts.py`
- `kernel/contracts/protocols.py`
- `kernel/settings/config.py`

Mais il n'existe actuellement aucun `__init__.py` sous `kernel/`, ce qui bloque une intégration propre avec `mypy` et surtout avec `import-linter` si l'on veut vérifier des frontières de couches en Python.

### Scripts de validation

Le dossier `antaerus/scripts/` contient uniquement les scripts de développement :

- `dev-all.*`
- `dev-brain.*`
- `dev-engine.*`
- `dev-gateway.*`
- `dev-web.*`

Il n'existe pas encore de dossier `antaerus/scripts/validation/`.

## Changements proposés

### 1. Renforcer le `.gitignore` racine

#### Fichier concerné

- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\.gitignore`

#### Action

- compléter la couverture des artefacts locaux, build et secrets ;
- ajouter explicitement les chemins demandés par `M0.2` :
  - `memory_data/`
  - `bundle/`
- compléter avec les caches d'outillage attendus après intégration :
  - `.mypy_cache/`
  - `.ruff_cache/`
  - `.coverage`
  - `htmlcov/`
  - `.pytest_cache/` si besoin de normalisation
  - caches `npm` / `vite` si pertinents

#### Pourquoi

- satisfaire la première sous-tâche de `M0.2` ;
- éviter que les nouveaux outils ajoutent des artefacts suivis par Git.

#### Comment

- conserver les règles déjà utiles ;
- compléter sans élargir au point d'ignorer des sources du projet.

### 2. Séparer la CI en lane rapide et lane lourde

#### Fichier concerné

- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\.github\workflows\ci.yml`

#### Action

- remplacer le workflow unique actuel par une structure en deux lanes cohérentes.

#### Lane rapide

- déclenchement : `push` + `pull_request`
- contenu recommandé :
  - Web : `npm ci`, `eslint`, `prettier --check`, `tsc --noEmit`, `vitest`
  - Go : `golangci-lint` + `go test`
  - Python : `ruff check`, `ruff format --check`, `mypy` scopé, `lint-imports`, `pytest -m "not integration"`
  - Rust : `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo check`, `cargo test`

#### Lane lourde

- déclenchement : `push` sur `main` + `schedule` hebdomadaire
- contenu recommandé :
  - relancer les validations de la lane rapide ;
  - lancer les builds complets :
    - `npm run build`
    - smoke tests de démarrage via `scripts/validation/`

#### Pourquoi

- alignement direct avec `tasks.md` ;
- préserve une boucle rapide sur contributions courantes et une validation plus coûteuse sur la branche principale.

### 3. Intégrer le tooling Python dans `brain_python`

#### Fichiers concernés

- `antaerus/providers/brain_python/pyproject.toml`
- fichiers Python du package `brain_python`
- éventuellement un fichier de configuration dédié si nécessaire, mais priorité au `pyproject.toml`

#### Action

- ajouter les dépendances dev :
  - `ruff`
  - `mypy`
  - `import-linter`
- étendre la configuration `pytest` pour distinguer :
  - suite unitaire par défaut
  - suite complète
- ajouter configuration `ruff` et `mypy` dans `pyproject.toml` si possible

#### Pourquoi

- satisfaire les sous-tâches Python sans multiplier les fichiers de configuration ;
- centraliser la configuration de l'écosystème Python.

#### Comment

- utiliser le `pyproject.toml` comme point de vérité pour :
  - dépendances dev
  - `pytest`
  - `ruff`
  - `mypy`
- définir des marqueurs `integration` pour permettre :
  - `pytest -m "not integration"`
  - `pytest`

### 4. Packager minimalement `kernel/` pour Python

#### Fichiers à créer

- `antaerus/kernel/__init__.py`
- `antaerus/kernel/contracts/__init__.py`
- `antaerus/kernel/settings/__init__.py`

#### Fichiers à vérifier

- `antaerus/kernel/contracts/contracts.py`
- `antaerus/kernel/contracts/protocols.py`
- `antaerus/kernel/settings/config.py`

#### Action

- rendre les modules Python du `kernel` importables ;
- introduire seulement le minimum nécessaire pour l'analyse statique.

#### Pourquoi

- permettre à `mypy` et `import-linter` de raisonner sur des modules Python réels ;
- rester fidèle à la décision utilisateur de packaging minimal.

#### Comment

- ne pas refondre toute l'arborescence Python ;
- ajouter seulement les `__init__.py` et, si nécessaire, de petites ré-exportations claires.

### 5. Introduire `import-linter` avec un contrat réaliste

#### Fichiers concernés

- `antaerus/providers/brain_python/pyproject.toml` ou fichier dédié si la configuration y est trop lourde
- éventuellement nouveaux fichiers d'appui pour le packaging `kernel`

#### Action

- définir un contrat minimal et exécutable pour cette phase.

#### Contrat recommandé

- les modules Python de `brain_python` peuvent dépendre du `kernel`
- le `kernel` ne doit dépendre d'aucun module `brain_python`

#### Pourquoi

- c'est compatible avec l'état actuel du dépôt ;
- cela matérialise une première frontière de couches sans forcer une refonte plus large.

#### Comment

- configurer `root_package` de façon compatible avec la structure réellement présente ;
- si nécessaire, ajouter une petite couche d'installation ou de chemin Python dans l'environnement de validation.

### 6. Introduire `mypy` scopé

#### Fichiers concernés

- `antaerus/providers/brain_python/pyproject.toml`
- éventuellement `antaerus/kernel` si de petites adaptations de typage sont nécessaires

#### Action

- activer `mypy` sur un périmètre volontairement limité mais pertinent :
  - `antaerus/kernel/contracts/*.py`
  - `antaerus/kernel/settings/config.py`
  - `antaerus/providers/brain_python/src/antaerus_brain/...` sur les points déjà typables

#### Pourquoi

- satisfaire la sous-tâche "kernel + conformité Protocols" sans rendre la phase instable.

#### Comment

- partir avec un scope explicite ;
- n'activer les règles strictes que là où le code actuel les supporte proprement.

### 7. Intégrer `golangci-lint`

#### Fichiers concernés

- nouveau fichier : `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\.golangci.yml`
- `.github/workflows/ci.yml`
- `Taskfile.yml`

#### Action

- ajouter une configuration `golangci-lint` modérée et stable ;
- l'exécuter depuis le module `antaerus/`.

#### Pourquoi

- répondre à `M0.2` côté Go ;
- éviter que la lane rapide se limite à `go test`.

#### Comment

- privilégier une configuration raisonnable pour la fondation :
  - linters de base
  - temps d'exécution contrôlé
  - pas de sur-strict initial.

### 8. Intégrer `clippy`, `cargo fmt` et `cargo check`

#### Fichiers concernés

- `.github/workflows/ci.yml`
- `Taskfile.yml`
- éventuellement `antaerus/providers/engine_rust/Cargo.toml` si une configuration minimale est utile

#### Action

- standardiser les commandes Rust :
  - `cargo fmt --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo check`
  - `cargo test`

#### Pourquoi

- fermer la sous-tâche Rust de `M0.2`.

### 9. Ajouter `prettier` côté Web

#### Fichiers concernés

- `antaerus/interfaces/web/package.json`
- nouveau fichier recommandé : `antaerus/interfaces/web/.prettierrc.json`
- éventuellement `.prettierignore` si nécessaire

#### Action

- ajouter `prettier` aux dépendances dev ;
- ajouter des scripts du type :
  - `format`
  - `format:check`
- intégrer ces scripts à la CI et au `Taskfile`.

#### Pourquoi

- `eslint` est déjà présent, mais `tasks.md` exige explicitement `eslint` + `prettier`.

### 10. Créer un `Taskfile.yml` racine

#### Fichier à créer

- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\Taskfile.yml`

#### Action

- fournir les commandes transverses attendues :
  - `test`
  - `lint`
  - `typecheck`
  - `build`

#### Pourquoi

- décision utilisateur explicite ;
- meilleur support cross-platform pour ce projet et pour Windows.

#### Comment

- tâches racine appelant les sous-commandes par runtime ;
- possibilité d'ajouter des sous-tâches nommées :
  - `lint:web`
  - `lint:python`
  - `lint:go`
  - `lint:rust`
  - `test:smoke`

### 11. Configurer `pre-commit`

#### Fichier à créer

- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\.pre-commit-config.yaml`

#### Action

- brancher des hooks utiles et rapides :
  - `end-of-file-fixer`
  - `trailing-whitespace`
  - `check-yaml`
  - `check-json`
  - `ruff-check`
  - `ruff-format`
  - `prettier` sur fichiers Web

#### Pourquoi

- fermer la sous-tâche `pre-commit` sans alourdir exagérément le commit local.

#### Comment

- garder les hooks locaux rapides ;
- laisser les validations coûteuses complètes à la CI et au `Taskfile`.

### 12. Créer `scripts/validation/` pour les smoke tests

#### Dossiers et fichiers à créer

- `antaerus/scripts/validation/`
- scripts recommandés :
  - `smoke-brain.ps1`
  - `smoke-gateway.ps1`
  - `smoke-engine.ps1`
  - `smoke-web.ps1`
  - équivalents `.sh` si le chantier reste cohérent avec l'existant

#### Action

- vérifier un démarrage froid minimal par service, sans serveur persistant bloquant.

#### Pourquoi

- sous-tâche explicite de `M0.2`
- utile pour la lane lourde

#### Comment

- approche recommandée :
  - lancer le service ;
  - attendre brièvement ;
  - interroger un endpoint de santé ou vérifier le build/lancement ;
  - arrêter le processus ;
- pour le Web, préférer au minimum un smoke de build/preview ou une vérification de sortie de build.

### 13. Mettre `tasks.md` à jour après validation réelle

#### Fichier concerné

- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\tasks.md`

#### Action

- cocher les sous-tâches `M0.2` uniquement après validation effective ;
- actualiser aussi les chemins mentionnés dans les états intermédiaires si nécessaire ;
- ajouter un bloc `État actuel` plus précis si certaines sous-tâches restent partielles.

## Hypothèses et décisions

- le périmètre demandé couvre toutes les sous-tâches de `M0.2`, pas seulement un sous-ensemble ;
- `Taskfile.yml` devient l'orchestrateur standard du projet ;
- la CI rapide doit rester assez complète pour éviter les régressions évidentes ;
- la CI lourde ajoute les builds complets et smoke tests, sans dupliquer inutilement plus que nécessaire ;
- le packaging Python du `kernel` reste minimal, limité à ce qui est nécessaire pour l'analyse statique ;
- `tasks.md` doit être mis à jour au fil de l'exécution, conformément à la mémoire projet et aux règles déjà inscrites.

## Séquence d'exécution recommandée

1. Renforcer `.gitignore`.
2. Packager minimalement `antaerus/kernel/` pour Python.
3. Étendre `pyproject.toml` de `brain_python` avec `ruff`, `mypy`, `import-linter`, `pytest`.
4. Ajouter `prettier` et ses scripts côté Web.
5. Créer `.golangci.yml`.
6. Créer `Taskfile.yml`.
7. Créer `.pre-commit-config.yaml`.
8. Créer `antaerus/scripts/validation/`.
9. Refondre `.github/workflows/ci.yml` en lane rapide + lourde.
10. Exécuter les validations locales par runtime et via le `Taskfile`.
11. Mettre `tasks.md` à jour selon les résultats réels.
12. Contrôler les diagnostics des fichiers modifiés.

## Vérifications

### Vérifications dépôt

- `.gitignore` ignore bien `memory_data/`, `bundle/` et les caches d'outillage.
- `Taskfile.yml` existe et expose `test`, `lint`, `typecheck`, `build`.
- `.pre-commit-config.yaml` existe et s'exécute sans erreur de syntaxe.

### Vérifications Python

- installation dev de `brain_python` réussie ;
- `ruff check` passe ;
- `ruff format --check` passe ;
- `mypy` sur le périmètre défini passe ;
- `lint-imports` passe ;
- `pytest -m "not integration"` passe ;
- `pytest` passe.

### Vérifications Go

- `golangci-lint run` passe depuis `antaerus/` ;
- `go test ./interfaces/gateway_go/...` passe.

### Vérifications Rust

- `cargo fmt --check` passe ;
- `cargo clippy --all-targets --all-features -- -D warnings` passe ;
- `cargo check` passe ;
- `cargo test` passe.

### Vérifications Web

- `npm run lint` passe ;
- `npm run format:check` passe ;
- `npm run check` passe ;
- `npm run build` passe ;
- `npm run test` passe.

### Vérifications CI

- le workflow sépare bien lane rapide et lane lourde ;
- la lane lourde se déclenche sur `main` et sur planification hebdomadaire.

### Vérifications backlog

- les sous-tâches `M0.2` réellement terminées sont cochées dans `tasks.md` ;
- les éléments partiels restent ouverts avec un état intermédiaire explicite.

## Résultat attendu

À la fin de `M0.2`, le dépôt doit disposer d'une base de qualité outillée et reproductible :

- CI en deux niveaux ;
- lint, format, typecheck et tests standardisés pour les quatre runtimes concernés ;
- packaging Python minimal du `kernel` pour supporter les contrôles d'architecture ;
- orchestration centralisée via `Taskfile` ;
- smoke tests prêts pour la validation de démarrage ;
- `tasks.md` synchronisé avec l'avancement réel.
