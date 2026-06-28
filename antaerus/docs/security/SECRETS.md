# Gestion des secrets

## Principes

- Les secrets sont typés par langage et ne doivent jamais être logués en clair.
- La configuration applicative est lue au boot puis considérée immuable pendant l'exécution.
- La mutation runtime de l'environnement est interdite dans le code métier.
- Les exceptions autorisées concernent uniquement le tooling local, la CI et la génération de code.

## Typage par langage

- Go : `antaerus/kernel/settings/config.go` expose `SecretString` avec `String()`, `GoString()`, `MarshalJSON()` et `MarshalText()` masqués.
- Python : `antaerus/kernel/settings/config.py` et `antaerus/providers/brain_python/src/antaerus_brain/config.py` utilisent `pydantic.SecretStr`.
- Rust : `antaerus/kernel/settings/config.rs` et `antaerus/providers/engine_rust/src/config.rs` utilisent `secrecy::SecretString`.

## Chiffrement au repos Rust

- La fondation fournit une primitive réutilisable AES-256-GCM basée sur `ring` dans `antaerus/providers/engine_rust/src/crypto.rs`.
- Cette primitive chiffre et déchiffre un secret en mémoire avec un nonce aléatoire et une enveloppe sérialisable minimale.
- `M0.4` ne crée pas encore de store persistant complet ; ce branchement est réservé à une phase ultérieure.

## Règle runtime

- Interdit : `os.Setenv`, `os.environ[...] = ...`, `env::set_var(...)` ou équivalent dans le code métier au runtime.
- Autorisé : adaptation de variables d'environnement dans les scripts de lint, codegen ou validation hors runtime applicatif.
- Exceptions connues et documentées :
  - `antaerus/providers/brain_python/run_import_linter.py`
  - `antaerus/providers/engine_rust/tools/proto_codegen/src/main.rs`

## Validation

- Tests Go : `go test ./kernel/settings/...`
- Tests Python : `python -m pytest tests/test_secrets.py tests/test_secrets_no_leak.py`
- Tests Rust : `cargo test`
- Tâche unifiée : `task test:security`
- Scripts :
  - PowerShell : `powershell -ExecutionPolicy Bypass -File .\scripts\validation\test-secrets-no-leak.ps1`
  - Bash : `./scripts/validation/test-secrets-no-leak.sh`

## Détection de fuite

- Le test `test_secrets_no_leak` scanne les fichiers texte du dépôt et cherche des motifs de secrets plausibles.
- La détection privilégie des regex spécifiques pour limiter les faux positifs documentaires.
- Les répertoires de cache, build et artefacts générés sont exclus du scan.
