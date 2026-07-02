# Plan M3.1 - Python Tools Finalisation

## Résumé

Objectif: finaliser `M3.1` en s'appuyant sur l'état réel du dépôt, où le socle technique des tools Python est déjà implémenté, mais où la clôture documentaire et le backlog projet ne sont pas encore alignés.

Résultat attendu après exécution:

- `M3.1` est reflété correctement dans `tasks.md`
- `antaerus/docs/contracts.md` documente l'API interne `tools`
- la documentation existante reste cohérente avec le code livré
- une vérification Python finale confirme que `brain_python` reste au vert

## Analyse De L'état Actuel

- Le package `antaerus/providers/brain_python/src/antaerus_brain/tools/` existe déjà et contient `browser.py`, `gmail.py`, `calendar.py`, `weather.py`, `vision.py`, `filesystem.py`, `memory_tool.py`, `cli.py`, `tool_registry.py`, `tool_schema.py` et `base.py`.
- L'API interne `tools` est déjà montée dans [app.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/app.py#L12-L23) via [tools.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/tools.py#L9-L25).
- Les capabilities `tools-registry`, `tools-execution` et `tools-schema-generation` sont déjà publiées dans [health.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/health.py#L26-L45).
- La configuration versionnée existe déjà dans [tools.yaml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/config/tools.yaml) et la configuration runtime est déjà exposée dans [config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py#L10-L51) et [`.env.example`](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/.env.example#L42-L73).
- Le README du service est déjà aligné sur `M3.1` dans [README.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/README.md#L76-L127).
- La couverture minimale existe déjà via [test_tool_registry.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/tests/test_tool_registry.py#L7-L52) et [test_tools_api.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/tests/test_tools_api.py#L9-L65).
- `tasks.md` laisse encore toutes les cases `M3.1` ouvertes dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L243-L257).
- `antaerus/docs/contracts.md` ne décrit pas encore l'API HTTP interne `tools` ni les capabilities associées.

## Changements Proposés

### 1. Revalider le périmètre code avant clôture

Fichiers à contrôler pendant l'exécution:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/base.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/tool_registry.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/tool_schema.py`
- `antaerus/providers/brain_python/src/antaerus_brain/api/tools.py`
- `antaerus/providers/brain_python/src/antaerus_brain/api/health.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- `antaerus/config/tools.yaml`
- `antaerus/.env.example`

Action:

- faire une passe de cohérence rapide sur ces fichiers avant modification documentaire
- ne corriger le code que si une divergence réelle avec le backlog `M3.1` est constatée pendant l'exécution

Pourquoi:

- le dépôt montre que l'essentiel de `M3.1` est déjà livré
- cette passe évite de rouvrir inutilement un chantier déjà stabilisé

### 2. Documenter l'API interne `tools` dans `antaerus/docs/contracts.md`

Fichier:

- `antaerus/docs/contracts.md`

Action:

- ajouter une section dédiée au contrat HTTP interne du `brain_python` pour `M3.1`
- documenter les routes:
  - `GET /tools`
  - `POST /tools/execute`
- documenter la sémantique de disponibilité:
  - `enabled`
  - `available`
  - `reason`
  - résultat homogène `ok/tool/status/result/error/meta`
- rappeler que cette API reste interne au système et ne constitue pas encore l'orchestration LLM de `M3.3`

Pourquoi:

- `contracts.md` est actuellement centré sur les contrats fondation, WebSocket et gRPC
- sans ce complément, le dépôt ne reflète pas correctement les surfaces HTTP internes désormais livrées par le brain

Comment:

- insérer une section après la partie services/capabilities ou après les contrats WebSocket, selon l'emplacement le plus cohérent avec la structure réelle du document
- garder un niveau de détail contractuel, pas un guide d'usage exhaustif

### 3. Clôturer `M3.1` dans `tasks.md`

Fichier:

- `tasks.md`

Action:

- cocher toutes les cases de `M3.1`
- ajouter un bloc `État actuel` sous `M3.1` sur le modèle des phases précédentes

Le bloc `État actuel` devra expliciter:

- la présence du package `tools/` et du registry dynamique
- l'existence de `antaerus/config/tools.yaml`
- l'exposition de `GET /tools` et `POST /tools/execute`
- la préparation des schémas LLM sans boucler encore le function calling
- la gouvernance `filesystem`/`cli` par whitelist
- le mode dégradé explicite de `gmail`, `calendar` et `vision`
- les validations Python rejouées avec succès

Pourquoi:

- `tasks.md` est la source de vérité opérationnelle du projet
- tant que ce fichier reste non aligné, `M3.1` apparaît à tort comme non réalisé

### 4. Conserver le README `brain_python` comme référence détaillée, sans duplication excessive

Fichier à vérifier:

- `antaerus/providers/brain_python/README.md`

Action:

- relire le README après les mises à jour de `contracts.md` et `tasks.md`
- n'éditer le README que si un écart documentaire net apparaît

Pourquoi:

- le README semble déjà aligné sur `M3.1`
- l'objectif est d'éviter les doubles descriptions contradictoires entre README, contrats et backlog

### 5. Rejouer la vérification finale ciblée `brain_python`

Répertoire:

- `antaerus/providers/brain_python/`

Commandes à exécuter après les edits:

- `python -m ruff check .`
- `python -m pytest tests`
- `python -m mypy src tests`

Pourquoi:

- les modifications prévues sont principalement documentaires, mais la règle projet impose une validation après finalisation
- cette passe fournit une preuve de clôture propre du lot `M3.1`

## Hypothèses Et Décisions

- Le périmètre demandé est `M3.1`, pas `M3.3`; l'intégration complète LLM -> function calling reste hors scope.
- Le code `M3.1` est considéré comme déjà implémenté sauf divergence constatée pendant la revalidation initiale.
- `tasks.md` doit être mis à jour explicitement à la fin, même si les changements sont majoritairement documentaires.
- `antaerus/docs/contracts.md` doit décrire l'API interne `tools`, mais sans transformer ce document en manuel utilisateur.
- `gmail`, `calendar` et `vision` restent conformes à `M3.1` si leur disponibilité est gérée proprement en mode `not_configured` ou `not_available`.

## Vérifications

Vérifications documentaires:

- `tasks.md` reflète `M3.1` comme livré
- `antaerus/docs/contracts.md` documente l'API `tools` et sa portée interne
- aucun nouveau décalage n'existe entre `tasks.md`, `contracts.md` et `providers/brain_python/README.md`

Vérifications fonctionnelles:

- `GET /tools` reste documenté comme catalogue des outils disponibles
- `POST /tools/execute` reste documenté comme exécution contrôlée par registry
- la distinction `enabled` / `available` / `not_configured` reste cohérente avec le comportement réel du code

Vérifications qualité:

- `python -m ruff check .` passe dans `antaerus/providers/brain_python/`
- `python -m pytest tests` passe dans `antaerus/providers/brain_python/`
- `python -m mypy src tests` passe dans `antaerus/providers/brain_python/`
