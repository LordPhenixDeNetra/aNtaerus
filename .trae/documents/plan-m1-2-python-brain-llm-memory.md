# Plan d'exécution — `M1.2` Python Brain (`LLM + mémoire basique`)

## Résumé

Objectif : livrer `M1.2` du service `brain_python` en transformant le FastAPI minimal actuel en un brain interne capable de :

- sélectionner et appeler un LLM parmi `Anthropic`, `OpenAI`, `Mistral`, `Ollama` ;
- exposer un flux texte synchrone et un flux `SSE` vers le gateway Go ;
- créer un noyau mémoire SQLite minimal avec schéma de facts ;
- ingérer des facts simples par regex/heuristiques ;
- générer un mirror Markdown unidirectionnel ;
- exposer des routes internes `/llm/*` et `/memory/*` prêtes à être consommées ensuite par le gateway.

Succès attendu :

- `brain_python/llm/factory.py`, `api.py`, `local.py`, `streaming.py` sont matérialisés ;
- `brain_python/memory/kernel.py`, `schemas.py`, `ingest.py`, `mirror.py`, `search.py` sont matérialisés ;
- `brain_python` expose une API interne `REST + SSE` ;
- la persistance mémoire utilise `SQLite` sous `memory_data/antaerus_memory.db` ;
- le mirror Markdown écrit sous `memory_data/topics/` ;
- les 4 providers sont réellement pris en charge, avec configuration et erreurs propres ;
- les tests Python couvrent la config, les routes LLM, le SSE, la mémoire et l’ingestion basique ;
- `tasks.md` n’est mis à jour qu’après validation réelle.

## Analyse de l'état actuel

### Backlog cible

Dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L116-L130), `M1.2` demande :

- `brain_python/llm/factory.py`
- `brain_python/llm/api.py`
- `brain_python/llm/local.py`
- `brain_python/llm/streaming.py`
- `brain_python/memory/kernel.py`
- `brain_python/memory/schemas.py`
- `brain_python/memory/ingest.py`
- `brain_python/memory/mirror.py`
- `brain_python/memory/search.py`
- exposition FastAPI interne : routes `/llm/`, `/memory/`

### État réel observé dans le dépôt

Le service Python actuel reste très réduit :

- [app.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/app.py) expose uniquement le bootstrap FastAPI et monte le routeur santé.
- [config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py) ne contient qu’une configuration minimale (`version`, `port`, `environment`, `api_secret`).
- [health.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/health.py) expose seulement `/health` et `/internal/capabilities`.
- [pyproject.toml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/pyproject.toml) n’inclut actuellement ni `aiosqlite`, ni `litellm`, ni `httpx` en dépendance runtime.
- Les tests présents ([test_health.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/tests/test_health.py), `test_secrets*.py`) couvrent uniquement la santé et les secrets.

### Référence CDC utile

Le CDC fixe les points suivants :

- le brain Python orchestre le `LLM` et la mémoire ;
- `llm/` doit couvrir orchestration + streaming ;
- `memory/` doit couvrir kernel mémoire + extraction ;
- la stack cible inclut `aiosqlite`, `httpx` et `litellm` ;
- le système vise du `REST + SSE` côté chat texte ;
- les artefacts mémoire vivent sous `memory_data/`, avec :
  - `memory_data/antaerus_memory.db`
  - `memory_data/topics/`

### Décisions utilisateur déjà verrouillées

- couverture LLM : **4 providers réels**
- mémoire : **SQLite + mirror minimal**
- forme d’API : **REST + SSE**

## Hypothèses et décisions

- Le lot `M1.2` reste centré sur le service `brain_python` ; il ne modifie pas encore le gateway Go pour consommer ces nouvelles routes.
- Les 4 providers réels seront supportés à travers une factory commune :
  - `Anthropic`
  - `OpenAI`
  - `Mistral`
  - `Ollama`
- Les providers cloud passeront par une couche `litellm` dans `llm/api.py` afin d’éviter de dupliquer les clients réseau.
- `Ollama` sera traité à part dans `llm/local.py` via `httpx`, conformément au backlog qui distingue cloud et local.
- L’API interne du brain exposera des routes brain-internal, pas encore les routes externes `/api/v1/*` du gateway.
- Les routes internes retenues pour `M1.2` sont :
  - `POST /llm/chat`
  - `POST /llm/stream`
  - `GET /llm/providers`
  - `GET /memory/facts`
  - `POST /memory/facts`
  - `POST /memory/ingest`
  - `POST /memory/mirror`
- Le schéma mémoire reste minimal mais exploitable :
  - `events`
  - `facts`
  - `fact_observations`
  - `fact_relations`
- L’ingestion de facts restera heuristique et déterministe, sans `spaCy` dans ce lot, car le backlog mentionne explicitement `regex + heuristiques`.
- Le mirror Markdown sera unidirectionnel depuis SQLite vers des fichiers Markdown, sans édition bidirectionnelle.
- Le chemin de stockage sera configurable, avec défaut aligné sur le CDC :
  - DB : `antaerus/memory_data/antaerus_memory.db`
  - mirror : `antaerus/memory_data/topics/`

## Changements proposés

### 1. Refondre la configuration du brain Python

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/config.py`
- `antaerus/providers/brain_python/tests/test_secrets.py`
- `antaerus/providers/brain_python/tests/test_secrets_no_leak.py`

#### Action

- étendre `Settings` pour couvrir :
  - sélection provider par défaut ;
  - secrets cloud (`Anthropic`, `OpenAI`, `Mistral`) ;
  - URL/base model pour `Ollama` ;
  - timeouts LLM ;
  - chemin SQLite ;
  - répertoire mirror Markdown ;
  - limites simples de pagination/recherche ;
- conserver l’usage de `SecretStr` pour tous les secrets LLM ;
- valider les chemins et les paramètres critiques au chargement.

#### Pourquoi

- `M1.2` introduit des providers multiples et du stockage local ;
- la configuration actuelle est insuffisante pour piloter proprement le lot.

### 2. Ajouter les dépendances runtime Python

#### Fichiers à modifier

- `antaerus/providers/brain_python/pyproject.toml`

#### Action

- ajouter en dépendances runtime :
  - `aiosqlite`
  - `httpx`
  - `litellm`
- garder `FastAPI`, `pydantic`, `uvicorn` ;
- ne pas ajouter de dépendances NLP lourdes non nécessaires à cette tranche.

#### Pourquoi

- `M1.2` doit réellement appeler des LLM et gérer SQLite ;
- ces bibliothèques sont explicitement alignées avec le CDC.

### 3. Introduire le package `llm/`

#### Fichiers à créer

- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/factory.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/api.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/local.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/streaming.py`
- `antaerus/providers/brain_python/tests/test_llm_factory.py`
- `antaerus/providers/brain_python/tests/test_llm_streaming.py`

#### Action

- définir un contrat commun de génération de texte :
  - entrée `prompt/messages/provider/model`
  - sortie texte complet ou flux d’événements
- `factory.py` :
  - résoudre le provider et construire le client adapté ;
  - supporter explicitement `anthropic`, `openai`, `mistral`, `ollama` ;
- `api.py` :
  - appeler les providers cloud via `litellm` ;
  - gérer erreurs d’auth, timeouts et providers inconnus ;
- `local.py` :
  - appeler Ollama via HTTP local ;
  - supporter réponse complète et réponse streamée ;
- `streaming.py` :
  - transformer une génération en flux `SSE` vers Go ;
  - normaliser les événements (`token`, `complete`, `error`) ;
- prévoir une structure de réponse qui permette ensuite au gateway Go de proxifier sans retraitement lourd.

#### Pourquoi

- le backlog sépare explicitement `factory`, `api`, `local` et `streaming` ;
- il faut poser un socle clair avant toute connexion React/Go au brain.

### 4. Introduire le package `memory/`

#### Fichiers à créer

- `antaerus/providers/brain_python/src/antaerus_brain/memory/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py`
- `antaerus/providers/brain_python/src/antaerus_brain/memory/schemas.py`
- `antaerus/providers/brain_python/src/antaerus_brain/memory/ingest.py`
- `antaerus/providers/brain_python/src/antaerus_brain/memory/mirror.py`
- `antaerus/providers/brain_python/src/antaerus_brain/memory/search.py`
- `antaerus/providers/brain_python/tests/test_memory_kernel.py`
- `antaerus/providers/brain_python/tests/test_memory_ingest.py`
- `antaerus/providers/brain_python/tests/test_memory_search.py`

#### Action

- `schemas.py` :
  - définir les `CREATE TABLE` et index pour :
    - `events`
    - `facts`
    - `fact_observations`
    - `fact_relations`
- `kernel.py` :
  - ouvrir/initialiser SQLite ;
  - exposer les opérations de base :
    - init DB
    - insert event
    - create fact
    - list/search facts
    - attach observation/relation
- `ingest.py` :
  - extraire des facts simples depuis du texte libre via regex/heuristiques ;
  - classifier au minimum quelques catégories fermées utiles (`preferences`, `projects`, `goals`, `relations`, `health`) ;
- `search.py` :
  - fournir une recherche textuelle basique SQLite (`LIKE`/FTS si simple à ajouter sans surcoût) ;
- `mirror.py` :
  - générer des fichiers Markdown depuis les facts enregistrés ;
  - organiser le mirror dans `memory_data/topics/` ;
  - garder une génération unidirectionnelle seulement.

#### Pourquoi

- cela couvre intégralement les fichiers demandés par `M1.2` ;
- le schéma reste simple mais immédiatement exploitable.

### 5. Exposer les nouvelles routes FastAPI internes

#### Fichiers à créer

- `antaerus/providers/brain_python/src/antaerus_brain/api/llm.py`
- `antaerus/providers/brain_python/src/antaerus_brain/api/memory.py`
- `antaerus/providers/brain_python/tests/test_llm_api.py`
- `antaerus/providers/brain_python/tests/test_memory_api.py`

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/app.py`

#### Action

- monter deux nouveaux routeurs FastAPI :
  - `/llm/*`
  - `/memory/*`
- exposer au minimum :
  - `GET /llm/providers` : lister providers disponibles et provider par défaut
  - `POST /llm/chat` : génération texte synchrone
  - `POST /llm/stream` : génération `SSE`
  - `GET /memory/facts` : recherche/listing
  - `POST /memory/facts` : création/correction manuelle d’un fact
  - `POST /memory/ingest` : ingestion heuristique depuis un texte
  - `POST /memory/mirror` : déclenchement d’une génération Markdown
- garder `/health` et `/internal/capabilities` stables.

#### Pourquoi

- le backlog demande explicitement l’exposition interne `/llm/` et `/memory/` ;
- cela prépare le futur proxy du gateway sans devoir redessiner l’API du brain.

### 6. Étendre les capacités du service

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/api/health.py`
- éventuellement `antaerus/providers/brain_python/tests/test_health.py`

#### Action

- enrichir `/internal/capabilities` pour refléter le nouveau périmètre :
  - `llm-routing`
  - `llm-streaming-sse`
  - `memory-kernel`
  - `memory-search`
  - `memory-mirror`
- conserver le format déjà consommé par le gateway.

#### Pourquoi

- le gateway agrège déjà les capabilities du brain ;
- `M1.2` doit donc se refléter dans cette sortie.

### 7. Préparer les données et chemins de runtime

#### Fichiers à créer si nécessaire en exécution

- `antaerus/memory_data/`
- `antaerus/memory_data/topics/`

#### Action

- faire en sorte que le brain crée les répertoires manquants à l’initialisation ou à la première opération mémoire ;
- aligner les chemins par défaut sur le CDC ;
- rester strictement sous `antaerus/`.

#### Pourquoi

- la persistance mémoire a besoin d’un emplacement stable ;
- le projet impose une structure active exclusivement sous `antaerus/`.

### 8. Mettre à niveau la stratégie de tests Python

#### Fichiers à créer ou modifier

- `antaerus/providers/brain_python/tests/test_llm_factory.py`
- `antaerus/providers/brain_python/tests/test_llm_api.py`
- `antaerus/providers/brain_python/tests/test_llm_streaming.py`
- `antaerus/providers/brain_python/tests/test_memory_kernel.py`
- `antaerus/providers/brain_python/tests/test_memory_ingest.py`
- `antaerus/providers/brain_python/tests/test_memory_search.py`
- `antaerus/providers/brain_python/tests/test_memory_api.py`
- `antaerus/providers/brain_python/tests/test_health.py`

#### Action

- tester sans dépendance réelle aux providers cloud par doubles/mocks HTTP ;
- couvrir :
  - résolution provider dans la factory ;
  - appel provider cloud ;
  - appel Ollama local ;
  - émission `SSE` ;
  - création du schéma SQLite ;
  - insertion/recherche de facts ;
  - extraction heuristique ;
  - génération du mirror Markdown ;
  - stabilité des endpoints santé/capabilities.

#### Pourquoi

- `M1.2` introduit plusieurs briques nouvelles et IO-bound ;
- des tests ciblés éviteront une régression sur le service brain avant l’intégration gateway.

### 9. Synchroniser la documentation et le backlog

#### Fichiers à modifier en exécution

- `tasks.md`
- `antaerus/providers/brain_python/README.md`
- éventuellement `antaerus/README.md` si le lancement local ou les variables d’environnement du brain changent substantiellement

#### Action

- mettre à jour `tasks.md` uniquement après validations réelles ;
- documenter :
  - variables d’environnement LLM ;
  - emplacements mémoire ;
  - nouvelles routes internes ;
  - prérequis Ollama local.

#### Pourquoi

- l’utilisateur exige une synchronisation continue de `tasks.md` ;
- `M1.2` ajoute des prérequis d’exploitation qu’il faut expliciter.

## Interfaces et comportements décidés

### Providers LLM supportés

- `anthropic`
- `openai`
- `mistral`
- `ollama`

### Routes internes retenues

- `GET /llm/providers`
- `POST /llm/chat`
- `POST /llm/stream`
- `GET /memory/facts`
- `POST /memory/facts`
- `POST /memory/ingest`
- `POST /memory/mirror`

### Format de streaming SSE

- événement `token` : fragment texte
- événement `complete` : fin de génération
- événement `error` : échec provider/stream

### Stockage mémoire

- SQLite : `antaerus/memory_data/antaerus_memory.db`
- mirror Markdown : `antaerus/memory_data/topics/`

### Schéma mémoire minimal

- `events`
- `facts`
- `fact_observations`
- `fact_relations`

### Portée volontairement hors lot

- pas encore de `spaCy`/NLP lourd ;
- pas encore de vector search / HNSW ;
- pas encore de détection avancée de contradictions ;
- pas encore de branchement Go -> Python sur le chat texte final ;
- pas encore de mission/proactive/skills.

## Séquence d'exécution recommandée

1. Étendre `config.py` et `pyproject.toml`.
2. Créer le package `llm/` et ses contrats.
3. Créer le package `memory/` et le schéma SQLite.
4. Ajouter les routeurs FastAPI `api/llm.py` et `api/memory.py`.
5. Brancher les nouvelles routes dans `app.py`.
6. Étendre `/internal/capabilities`.
7. Écrire les tests Python ciblés.
8. Valider le service (`pytest`, éventuellement `ruff`/`mypy` si déjà utilisés pour ce service).
9. Mettre à jour `tasks.md` puis la documentation.

## Vérifications

### Tests ciblés

- `pytest antaerus/providers/brain_python/tests`

### Vérifications complémentaires

- `ruff check antaerus/providers/brain_python`
- `mypy antaerus/providers/brain_python/src antaerus/providers/brain_python/tests`

### Contrôles attendus

- le brain démarre toujours avec `/health` et `/internal/capabilities` ;
- `GET /llm/providers` liste bien les 4 providers ;
- `POST /llm/chat` retourne une réponse texte complète ;
- `POST /llm/stream` produit un flux `SSE` exploitable ;
- `POST /memory/ingest` extrait au moins des facts basiques cohérents ;
- `GET /memory/facts` retrouve les facts persistés ;
- `POST /memory/mirror` écrit les fichiers Markdown dans `memory_data/topics/`.

### Synchronisation backlog

- `tasks.md` reflète exactement l’avancement réel des sous-tâches `M1.2` ;
- les éléments non livrés au-delà de `M1.2` restent explicitement ouverts.

## Risques surveillés

- surdimensionner la couche LLM en essayant de couvrir trop tôt des cas multi-turn complexes ;
- coupler trop fortement l’API interne du brain au futur gateway ;
- introduire des appels réseau réels aux providers dans les tests ;
- durcir trop tôt la mémoire avec un schéma trop riche par rapport à `M1.2`.

## Résultat attendu

À la fin de `M1.2`, le service `brain_python` doit disposer :

- d’une orchestration LLM réellement multi-provider ;
- d’un endpoint texte synchrone et d’un endpoint `SSE` streamé ;
- d’un noyau mémoire SQLite minimal mais fonctionnel ;
- d’une ingestion de facts basique ;
- d’un mirror Markdown exploitable ;
- d’une API interne prête pour le branchement du gateway Go au lot suivant.
