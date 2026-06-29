# Plan d'exécution — Finalisation `M1.2` Python Brain

## Résumé

Objectif : terminer proprement `M1.2 — Python Brain (LLM + mémoire basique)` à partir de l'état déjà implémenté dans le dépôt, en fermant les derniers écarts de qualité, en validant le lot réellement, puis en synchronisant `tasks.md` et la documentation du service.

Succès attendu :

- les modules `llm/`, `memory/`, `api/llm.py` et `api/memory.py` restent cohérents et validés ;
- les validations Python du service passent réellement sur le poste de travail ;
- les éventuels derniers correctifs sont limités aux écarts remontés par `mypy`, `pytest` ou le linter ;
- `tasks.md` reflète la livraison effective de `M1.2` ;
- `README.md` du brain documente au minimum les nouvelles routes et variables d'environnement utiles.

## Analyse de l'état actuel

### État réel constaté dans le dépôt

Le dépôt ne se trouve plus au stade "à concevoir", mais au stade "à finaliser" :

- `antaerus/providers/brain_python/src/antaerus_brain/app.py` monte déjà `health`, `llm` et `memory`.
- `antaerus/providers/brain_python/src/antaerus_brain/config.py` contient déjà la configuration multi-provider et mémoire.
- `antaerus/providers/brain_python/src/antaerus_brain/llm/` existe déjà avec `factory.py`, `api.py`, `local.py`, `streaming.py`.
- `antaerus/providers/brain_python/src/antaerus_brain/memory/` existe déjà avec `kernel.py`, `schemas.py`, `ingest.py`, `mirror.py`, `search.py`.
- `antaerus/providers/brain_python/src/antaerus_brain/api/health.py` expose déjà les capabilities `llm-routing`, `llm-streaming-sse`, `memory-kernel`, `memory-search`, `memory-mirror`.
- la suite de tests Python associée existe déjà sous `antaerus/providers/brain_python/tests/`.

### Écart principal restant

Le backlog [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L116-L130) montre encore `M1.2` entièrement ouvert, alors que l'implémentation est déjà en place dans le code.

Le dernier point d'arrêt connu est un reliquat de validation statique :

- un correctif récent a été appliqué dans `tests/test_llm_streaming.py` ;
- `mypy src tests` doit être relancé ;
- une relance de confirmation de `pytest tests` reste souhaitable après le dernier patch ;
- `README.md` du service est encore minimal ;
- `tasks.md` n'a pas encore été synchronisé avec l'état réel.

### Références de cadrage déjà verrouillées

Les décisions fonctionnelles sont déjà fixées et ne nécessitent plus d'arbitrage :

- providers LLM : `anthropic`, `openai`, `mistral`, `ollama` ;
- mémoire : `SQLite + mirror Markdown minimal` ;
- exposition API : `REST + SSE`.

## Hypothèses et décisions

- La portée de cette exécution reste strictement `M1.2` côté `antaerus/providers/brain_python/`.
- Aucun redesign d'API n'est introduit tant qu'un test ou diagnostic ne l'impose pas.
- Les corrections de fin de lot doivent rester ciblées et conservatrices.
- `tasks.md` ne sera mis à jour qu'après validations réellement passées.
- La documentation à mettre à jour en priorité est `antaerus/providers/brain_python/README.md`; le `README` racine n'est touché que si un écart d'exploitation majeur apparaît.

## Changements proposés

### 1. Rejouer les validations finales du lot

#### Fichiers concernés

- `antaerus/providers/brain_python/tests/test_llm_streaming.py`
- `antaerus/providers/brain_python/tests/`
- `antaerus/providers/brain_python/src/antaerus_brain/`
- `antaerus/providers/brain_python/pyproject.toml`

#### Action

- relancer `mypy src tests` depuis `antaerus/providers/brain_python/` ;
- relancer `pytest tests` pour confirmation après le dernier correctif ;
- relancer `ruff check .` si nécessaire pour s'assurer qu'aucune régression de style n'a été introduite.

#### Pourquoi

- le code existe déjà ;
- le reliquat principal est une fermeture réelle des validations de qualité avant de déclarer `M1.2` terminé.

### 2. Corriger uniquement les écarts restants remontés par les validations

#### Fichiers potentiellement à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/api.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/local.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/streaming.py`
- `antaerus/providers/brain_python/src/antaerus_brain/api/llm.py`
- `antaerus/providers/brain_python/src/antaerus_brain/api/memory.py`
- `antaerus/providers/brain_python/tests/test_llm_streaming.py`
- `antaerus/providers/brain_python/tests/test_llm_api.py`
- `antaerus/providers/brain_python/tests/test_memory_api.py`

#### Action

- traiter uniquement les erreurs réellement observées ;
- privilégier des corrections de contrat de typage, signatures asynchrones, mocks de tests ou normalisation des réponses ;
- éviter toute extension fonctionnelle hors du lot.

#### Pourquoi

- le dernier historique montre que la zone sensible réside surtout dans les contrats async et les doubles de test ;
- cela permet de fermer `M1.2` sans dériver vers `M1.4`.

### 3. Vérifier la cohérence fonctionnelle des endpoints internes

#### Fichiers concernés

- `antaerus/providers/brain_python/src/antaerus_brain/api/llm.py`
- `antaerus/providers/brain_python/src/antaerus_brain/api/memory.py`
- `antaerus/providers/brain_python/src/antaerus_brain/api/health.py`
- `antaerus/providers/brain_python/tests/test_llm_api.py`
- `antaerus/providers/brain_python/tests/test_memory_api.py`
- `antaerus/providers/brain_python/tests/test_health.py`

#### Action

- confirmer que les routes internes couvertes par `M1.2` restent stables :
  - `GET /llm/providers`
  - `POST /llm/chat`
  - `POST /llm/stream`
  - `GET /memory/facts`
  - `POST /memory/facts`
  - `POST /memory/ingest`
  - `POST /memory/mirror`
  - `GET /health`
  - `GET /internal/capabilities`
- en cas d'écart, corriger le code ou les tests selon le contrat déjà choisi, pas l'inverse arbitrairement.

#### Pourquoi

- `M1.2` est défini par ces interfaces ;
- la validation doit prouver qu'elles sont exploitables avant le branchement futur via le gateway.

### 4. Synchroniser le backlog `tasks.md`

#### Fichier à modifier

- `tasks.md`

#### Action

- cocher les sous-tâches `M1.2` effectivement livrées :
  - `llm/factory.py`
  - `llm/api.py`
  - `llm/local.py`
  - `llm/streaming.py`
  - `memory/kernel.py`
  - `memory/schemas.py`
  - `memory/ingest.py`
  - `memory/mirror.py`
  - `memory/search.py`
  - routes `/llm/`, `/memory/`
- enrichir la section `État actuel` de `M1.2` avec un résumé fidèle de l'implémentation et des validations passées.

#### Pourquoi

- `tasks.md` est la source de vérité opérationnelle ;
- l'utilisateur demande explicitement sa mise à jour à chaque avancement validé.

### 5. Mettre à niveau la documentation du service brain

#### Fichier à modifier

- `antaerus/providers/brain_python/README.md`

#### Action

- remplacer la description minimale actuelle par une documentation courte mais exploitable ;
- documenter :
  - le rôle du service ;
  - les variables d'environnement principales ;
  - les providers supportés ;
  - les routes internes `llm` et `memory` ;
  - l'emplacement de `memory_data/antaerus_memory.db` et `memory_data/topics/` ;
  - les commandes de validation locales.

#### Pourquoi

- `M1.2` introduit assez de surface fonctionnelle pour nécessiter une documentation d'exploitation minimale ;
- cela prépare le lot suivant sans devoir relire le code pour comprendre le service.

## Séquence d'exécution

1. Lire le plan puis rejouer `mypy src tests`.
2. Si `mypy` échoue, corriger uniquement les écarts remontés.
3. Rejouer `pytest tests`.
4. Rejouer `ruff check .` si un correctif de code a été appliqué.
5. Vérifier les diagnostics des fichiers modifiés.
6. Mettre à jour `tasks.md` une fois les validations passées.
7. Mettre à jour `antaerus/providers/brain_python/README.md`.
8. Faire une dernière passe de vérification ciblée si la documentation ou le backlog ont entraîné des ajustements connexes.

## Vérifications

### Commandes de validation

- `python -m mypy src tests`
- `python -m pytest tests`
- `python -m ruff check .`

### Contrôles attendus

- `mypy` ne remonte plus d'erreur sur les contrats `LLMClient`, streaming et tests associés ;
- `pytest` valide les routes LLM, mémoire, santé, secrets et persistence SQLite ;
- `ruff` ne remonte pas de régression de lint ;
- `tasks.md` montre `M1.2` terminé ;
- `README.md` du brain décrit correctement le périmètre livré.

## Résultat attendu

À la fin de cette exécution, `M1.2` est formellement clos :

- l'implémentation Python Brain est validée par les outils de qualité ;
- le backlog est synchronisé ;
- la documentation locale du service est suffisante pour la suite des travaux `M1.3` et `M1.4`.
