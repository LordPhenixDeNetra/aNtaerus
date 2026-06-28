# Plan d'exécution — `M0.4` Sécurité fondamentale

## Résumé

Objectif : terminer `M0.4` en matérialisant une base de sécurité cohérente à l'échelle du monorepo, sans dériver vers un système complet de gestion de secrets ou de coffre-fort non demandé.

Succès attendu :

- `SecretString` Go masque les secrets de façon fiable lors des sérialisations utiles en fondation ;
- `SecretStr` Python est utilisé explicitement au niveau `kernel` et `brain_python`, avec tests dédiés ;
- Rust conserve `secrecy::SecretString` et ajoute une primitive réutilisable de chiffrement au repos basée sur `ring` AES-256-GCM ;
- un test anti-fuite `test_secrets_no_leak` existe et échoue si des motifs de secrets connus apparaissent dans les fichiers suivis ;
- la règle “jamais de mutation runtime de l'environnement” est documentée avec ses exceptions de tooling ;
- `antaerus/docs/security/SECRETS.md` existe ;
- `tasks.md` est mis à jour uniquement après validations réelles.

## Analyse de l'état actuel

### Backlog `M0.4`

Dans `tasks.md`, `M0.4` demande :

- `SecretString` Go avec marshal masqué ;
- `SecretStr` Python ;
- `secrecy::SecretString` Rust ;
- `test_secrets_no_leak` ;
- chiffrement au repos Rust via `ring` AES-256-GCM ;
- documentation “jamais de `os.Setenv` / `os.environ` mutation en runtime” ;
- création de `docs/security/SECRETS.md`.

### État réel déjà présent

Le dépôt contient déjà des briques partielles :

- [config.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/kernel/settings/config.go) définit `type SecretString string`, mais ne masque aujourd'hui que `String()`.
- [config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/kernel/settings/config.py) utilise déjà `pydantic.SecretStr`.
- [brain config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py) utilise déjà `SecretStr`.
- [config.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/kernel/settings/config.rs) et [engine_rust config.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/config.rs) utilisent déjà `secrecy::SecretString`.

### Manques constatés

- aucun masquage JSON / texte structuré n'existe encore côté Go ;
- aucun test dédié aux secrets n'existe côté Go, Python ou Rust ;
- aucun module `ring` n'existe encore côté Rust ;
- aucun test anti-fuite global n'existe ;
- aucun dossier `antaerus/docs/security/` n'existe ;
- seule la doc produit mentionne la règle d'immuabilité runtime, mais pas la doc développeur/sécurité ;
- il existe deux exceptions de tooling détectées :
  - `antaerus/providers/brain_python/run_import_linter.py` copie et ajuste `os.environ` pour lancer un outil ;
  - `antaerus/providers/engine_rust/tools/proto_codegen/src/main.rs` appelle `env::set_var("PROTOC", ...)` pour la génération locale.

### Décision utilisateur verrouillée

Pour le chiffrement au repos Rust, la portée choisie est :

- **primitive réutilisable**, pas encore de store persistant complet.

Conséquence :

- `M0.4` doit livrer un module crypto testable et branchable plus tard sur un vrai stockage ;
- il ne doit pas inventer un fichier de secrets persistant côté `engine_rust` si le dépôt n'en a pas encore besoin.

## Hypothèses et décisions

- Le typage secret déjà existant en Python et Rust compte comme point de départ, mais `M0.4` exige leur consolidation et leur validation par tests.
- Le masquage Go doit couvrir les cas réalistes de la fondation : `String()`, `fmt`, et sérialisation JSON.
- Le test anti-fuite doit viser les fichiers du dépôt et exclure les répertoires de build/cache/générés non suivis pour limiter les faux positifs.
- La règle “pas de mutation runtime de l'environnement” doit documenter explicitement que les scripts/outils de build/lint/codegen ne sont pas visés.
- Le chiffrement Rust livré dans `M0.4` sera une primitive AES-256-GCM réutilisable avec gestion de nonce/salt et tests de round-trip/erreur, sans couche de persistance.

## Changements proposés

### 1. Renforcer `SecretString` côté Go

#### Fichier à modifier

- `antaerus/kernel/settings/config.go`

#### Action

- faire évoluer `SecretString` en vrai type dédié avec :
  - masquage via `String()`
  - masquage via `GoString()` si utile
  - `MarshalJSON()` renvoyant une valeur masquée
  - éventuellement `MarshalText()` pour éviter les fuites dans les sorties textuelles simples
- conserver `LoadFoundationSettings()` comme point d'entrée immuable.

#### Pourquoi

- le backlog demande explicitement un “marshal masqué” ;
- le type actuel ne protège pas encore les sérialisations JSON.

### 2. Ajouter des tests Go dédiés aux secrets

#### Fichier à créer

- `antaerus/kernel/settings/config_test.go`

#### Action

- vérifier que :
  - `String()` ne révèle pas la valeur ;
  - `json.Marshal` masque la valeur ;
  - la valeur réelle reste accessible uniquement par une méthode explicite si un accès brut est conservé ;
  - le chargement de config ne casse pas l'existant.

#### Pourquoi

- verrouiller le comportement de non-fuite dès la fondation.

### 3. Consolider la couche Python de secrets

#### Fichiers à modifier ou créer

- `antaerus/kernel/settings/config.py`
- `antaerus/providers/brain_python/src/antaerus_brain/config.py`
- `antaerus/providers/brain_python/tests/test_secrets.py`

#### Action

- conserver `SecretStr`, déjà présent ;
- expliciter si nécessaire la construction des settings pour garder un modèle immuable et lisible ;
- ajouter des tests vérifiant que `repr`, `str` et `model_dump`/accès usuels n'exposent pas le secret ;
- couvrir à la fois le `kernel` Python et le service `brain_python`.

#### Pourquoi

- le dépôt possède déjà la brique `SecretStr`, mais pas encore la preuve testée que son usage est correct dans ce projet.

### 4. Consolider Rust `secrecy::SecretString`

#### Fichiers à modifier ou créer

- `antaerus/kernel/settings/config.rs`
- `antaerus/providers/engine_rust/src/config.rs`
- `antaerus/providers/engine_rust/tests/secrets.rs`

#### Action

- conserver `secrecy::SecretString` dans les settings ;
- vérifier que les types exposés ne dérivent pas accidentellement une sérialisation ou un debug qui fuite ;
- ajouter des tests Rust vérifiant que les représentations debug/texte ne révèlent pas la valeur brute.

#### Pourquoi

- `secrecy` est déjà utilisé, mais `M0.4` demande une implémentation réellement validée.

### 5. Ajouter une primitive de chiffrement au repos Rust

#### Fichiers à créer

- `antaerus/providers/engine_rust/src/crypto.rs`
- éventuellement `antaerus/providers/engine_rust/src/crypto/mod.rs` selon l'organisation retenue
- `antaerus/providers/engine_rust/tests/crypto.rs`

#### Fichiers à modifier

- `antaerus/providers/engine_rust/Cargo.toml`
- `antaerus/providers/engine_rust/src/lib.rs`

#### Action

- ajouter `ring` comme dépendance ;
- implémenter une primitive réutilisable AES-256-GCM avec :
  - génération/usage d'un nonce aléatoire ;
  - enveloppe sérialisable minimale contenant nonce + ciphertext ;
  - API simple de type `encrypt_secret(plaintext, key)` / `decrypt_secret(blob, key)` ;
- ajouter des tests de round-trip, d'échec avec mauvaise clé et d'échec sur données altérées.

#### Pourquoi

- le cahier des charges demande explicitement `ring` AES-256-GCM ;
- la décision utilisateur verrouille une primitive réutilisable, pas un store complet.

#### Portée explicitement exclue

- pas de persistance durable de configuration chiffrée ;
- pas de rotation de clés ;
- pas de coffre-fort applicatif complet.

### 6. Créer le test anti-fuite `test_secrets_no_leak`

#### Fichiers à créer

- `antaerus/providers/brain_python/tests/test_secrets_no_leak.py`
- éventuellement un helper script, par exemple `antaerus/scripts/validation/test-secrets-no-leak.ps1` et `.sh`, si cela aide la reproductibilité

#### Action

- implémenter un test repo-local qui scanne les fichiers texte pertinents pour détecter des motifs de secrets connus, par exemple :
  - `sk-`
  - `ntn_`
  - autres motifs explicites utiles et peu risqués
- exclure les dossiers de build/cache et, si nécessaire, les fichiers de lock ou exemples documentés clairement approuvés.

#### Décision d'ancrage

- le test sera porté côté Python `pytest`, car :
  - la stack Python est déjà bien outillée pour lire/arbitrer des fichiers ;
  - cela évite d'ajouter un binaire ou une logique shell fragile.

#### Pourquoi

- le backlog le demande explicitement ;
- cette vérification est transversale au dépôt, pas seulement à un service.

### 7. Documenter la règle “pas de mutation runtime de l'environnement”

#### Fichiers à créer ou modifier

- `antaerus/docs/security/SECRETS.md`
- `antaerus/README.md` si un renvoi est utile
- `tasks.md`

#### Action

- créer `SECRETS.md` avec :
  - typage des secrets par langage ;
  - règles de logging / sérialisation ;
  - règle “pas de mutation runtime” ;
  - exceptions autorisées pour tooling local/CI/codegen ;
  - façon de lancer le test anti-fuite ;
  - limites actuelles de `M0.4`.

#### Pourquoi

- la doc actuelle n'existe pas encore à l'emplacement demandé ;
- il faut éviter une règle absolue contredite par les outils de développement déjà présents.

### 8. Mettre à jour l'outillage et le backlog

#### Fichiers à modifier

- `Taskfile.yml`
- `tasks.md`
- éventuellement `antaerus/providers/brain_python/pyproject.toml` si de nouveaux tests doivent être inclus naturellement

#### Action

- ajouter une tâche reproductible de validation sécurité, par exemple :
  - `test:security`
  - ou `validate:secrets`
- ne cocher `M0.4` dans `tasks.md` qu'après validations :
  - Go
  - Python
  - Rust
  - test anti-fuite

#### Pourquoi

- le projet impose `tasks.md` comme source de vérité ;
- `M0.4` doit être rejouable facilement.

## Séquence d'exécution recommandée

1. Renforcer `SecretString` dans `antaerus/kernel/settings/config.go`.
2. Ajouter les tests Go de non-fuite.
3. Ajouter les tests Python autour de `SecretStr`.
4. Consolider les settings Rust avec tests de non-fuite.
5. Ajouter la primitive AES-256-GCM `ring` côté Rust.
6. Écrire le test anti-fuite global `test_secrets_no_leak`.
7. Documenter `SECRETS.md` et la règle d'immuabilité runtime avec exceptions de tooling.
8. Étendre `Taskfile.yml`.
9. Rejouer les validations.
10. Synchroniser `tasks.md`.

## Vérifications

### Go

- `go test ./kernel/settings/...` ou commande équivalente selon la structure exacte
- vérification explicite du masquage JSON et texte

### Python

- `python -m pytest` dans `antaerus/providers/brain_python`
- tests `test_secrets.py` et `test_secrets_no_leak.py` passants

### Rust

- `cargo check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test`
- tests de round-trip crypto et non-fuite passants

### Documentation et backlog

- `antaerus/docs/security/SECRETS.md` existe
- les règles runtime/outillage y sont explicites
- `tasks.md` reflète exactement les validations réalisées

## Risques surveillés

- faux positifs du test anti-fuite si les motifs de scan sont trop larges ;
- sur-portée si le chiffrement Rust dérive vers un store persistant ;
- confusion entre règle runtime et besoins de tooling/codegen ;
- exposition involontaire du secret Go si une méthode d'accès brut est mal nommée ou trop facilement journalisable.

## Résultat attendu

À la fin de `M0.4`, le dépôt doit disposer :

- d'un socle de secrets typés et masqués en Go, Python et Rust ;
- d'une primitive Rust de chiffrement au repos prête pour les étapes futures ;
- d'un test transversal anti-fuite ;
- d'une documentation sécurité explicite ;
- d'un `tasks.md` fidèle à l'état réel du chantier.
