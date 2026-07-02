# Plan M3.1 - Python Tools

## Résumé

Objectif: implémenter `M3.1` dans `brain_python` avec des outils Python **réels mais minimaux**, une **API interne minimale** pour inspection/exécution contrôlée, un **registry dynamique** et une **génération de schémas LLM**, sans anticiper tout le function calling de `M3.3`.

Décisions figées pendant le cadrage:

- profondeur: **réel + minimal**
- `filesystem.py` et `cli.py`: **wrappers Python** préparant le branchement futur sur le sandbox Rust de `M3.2`
- emplacement config: **`antaerus/config/tools.yaml`**
- exposition: **API interne minimale `tools` dès M3.1**
- `browser.py`: **recherche web simple + fetch/scraping HTML textuel**, sans navigateur interactif

Effet attendu à la fin du lot:

- `brain_python` expose une capacité `tools`
- un catalogue d’outils existe et peut être listé par API interne
- chaque outil M3.1 existe avec une surface minimale utilisable et testable
- les outils peuvent être exécutés de manière contrôlée via un registry et des schémas standardisés
- `filesystem` et `cli` restent gouvernés par config/whitelist et conçus comme façade vers le sandbox Rust futur, sans casser l’architecture stricte actuelle

## Analyse De L’état Actuel

- Le service Python expose seulement `health`, `llm` et `memory` dans `antaerus/providers/brain_python/src/antaerus_brain/app.py`.
- La configuration runtime de `brain_python` ne couvre aujourd’hui que le LLM, l’identité assistant et la mémoire dans `antaerus/providers/brain_python/src/antaerus_brain/config.py`.
- Aucun package `tools/` n’existe actuellement sous `antaerus/providers/brain_python/src/antaerus_brain/`.
- Aucun contrat `tool registry`, `tool schema`, `tool execution` ou `/tools/*` n’existe dans l’API interne.
- Les capabilities publiées par `/internal/capabilities` ne mentionnent aujourd’hui aucun outil.
- `tasks.md` demande `filesystem.py`, `cli.py` et `config/tools.yaml` en `M3.1`, mais l’architecture cible et la structure stricte du dépôt imposent:
  - pas de `config/` racine hors `antaerus/`
  - un futur sandbox Rust en `M3.2` pour `fs` et `cli`
- Les tests existants montrent déjà le style attendu pour:
  - endpoints API internes FastAPI
  - config immuable chargée depuis `antaerus/.env`
  - protection des secrets `SecretStr`
  - suites de tests orientées service (`test_llm_api.py`, `test_memory_api.py`, `test_secrets.py`)

## Changements Proposés

### 1. Créer le socle `tools` côté `brain_python`

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/base.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/tool_registry.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/tool_schema.py`

Plan:

- introduire un contrat commun d’outil Python avec:
  - identité (`name`, `description`, `risk_level`, `enabled`)
  - schéma d’entrée
  - mode d’exécution
  - schéma de sortie standardisé
- créer un `ToolRegistry` dynamique capable de:
  - enregistrer les outils disponibles
  - lister les outils activés
  - récupérer un outil par nom
  - exécuter un outil en entrée JSON typée
- créer `tool_schema.py` pour convertir les outils en schémas compatibles LLM/function calling:
  - nom
  - description
  - JSON schema d’arguments

Pourquoi:

- ce socle est nécessaire pour tous les outils M3.1
- il prépare `M3.3` sans obliger à livrer le bouclage LLM -> tools complet dès maintenant

### 2. Étendre la configuration runtime et la config outillage

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/config.py`
- `antaerus/.env.example`
- `antaerus/config/tools.yaml`

Plan:

- étendre `Settings` avec les options nécessaires à M3.1:
  - chemin du fichier `tools.yaml`
  - racine sandbox Python pour wrappers `filesystem`
  - paramètres météo/Open-Meteo
  - paramètres browser user-agent/timeout
  - paramètres Gmail/Calendar OAuth en mode minimal
  - chemins/flags vision
- garder la règle existante:
  - chargement depuis `antaerus/.env`
  - config immuable au boot
- créer `antaerus/config/tools.yaml` avec:
  - outils activés/désactivés
  - whitelist CLI
  - whitelist filesystem
  - paramètres de sécurité minimaux par outil

Décision:

- la checklist `config/tools.yaml` est interprétée comme `antaerus/config/tools.yaml` pour respecter la structure stricte du monorepo

### 3. Ajouter une API interne minimale `tools`

Fichiers:

- nouveau routeur: `antaerus/providers/brain_python/src/antaerus_brain/api/tools.py`
- `antaerus/providers/brain_python/src/antaerus_brain/app.py`
- éventuellement modèles Pydantic locaux au routeur ou dans `tools/base.py`

Plan:

- exposer des endpoints internes minimaux:
  - `GET /tools` pour lister le catalogue et leur disponibilité
  - `POST /tools/execute` pour exécuter un outil par nom avec payload validé
- garder l’API strictement interne, dans la continuité de `/llm/*` et `/memory/*`
- renvoyer une structure de résultat homogène:
  - `ok`
  - `tool`
  - `result`
  - `error`
  - `meta`

Pourquoi:

- utile pour tests, debug local et observabilité du lot
- évite de dépendre immédiatement du function calling `M3.3`

### 4. Mettre à jour les capabilities du brain

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/api/health.py`

Plan:

- déclarer explicitement les capacités liées aux tools, par exemple:
  - `tools-registry`
  - `tools-execution`
  - `tools-schema-generation`
- garder le format actuel de `/internal/capabilities`

Pourquoi:

- le gateway et le reste du système peuvent découvrir que le brain supporte désormais les tools

### 5. Implémenter `browser.py` en mode réel minimal

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/browser.py`

Plan:

- fournir deux primitives minimales:
  - recherche web simple
  - fetch/scraping textuel d’une page HTML
- rester sur une stratégie légère sans navigateur:
  - requête HTTP vers un endpoint de recherche HTML léger ou page de résultats textuels
  - récupération d’une URL
  - extraction texte/titre/liens principaux
- limiter volontairement la portée:
  - pas d’automatisation JS
  - pas de login
  - pas d’interaction navigateur riche

Résultat attendu:

- recherche par mot-clé -> liste de résultats structurés
- fetch URL -> contenu nettoyé et métadonnées minimales

### 6. Implémenter `weather.py` en mode réel minimal

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/weather.py`

Plan:

- utiliser Open-Meteo sans clé
- exposer au moins:
  - météo actuelle par latitude/longitude
  - météo actuelle via nom de lieu si un géocodage minimal est retenu
- garder un format de sortie stable et testable

Décision d’implémentation:

- si un géocodage est nécessaire, le lot peut utiliser l’API Open-Meteo/Geocoding ou exiger des coordonnées explicites selon le cadrage minimal le plus robuste dans le code

### 7. Implémenter `memory_tool.py` en réutilisant la mémoire existante

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/memory_tool.py`
- éventuelle réutilisation de modules existants dans `antaerus_brain/memory/`

Plan:

- construire un outil d’écriture de note/fait structuré au-dessus de la mémoire existante
- éviter de dupliquer la persistance
- réutiliser le kernel SQLite actuel et les patterns déjà présents dans l’API mémoire

Résultat attendu:

- création d’une note structurée ou d’un fait simple avec sujet/contenu/tags/meta minimale

### 8. Implémenter `filesystem.py` comme wrapper Python gouverné

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/filesystem.py`

Plan:

- livrer une capacité **lecture seule** minimale
- lire uniquement dans des racines whitelistées via `tools.yaml`
- interdire toute écriture/modification dans `M3.1`
- concevoir l’API comme façade remplaçable par le backend Rust de `M3.2`

Décision:

- `filesystem.py` n’est pas un sandbox natif complet ici; c’est un wrapper Python sécurisé minimal préparant la bascule vers le sandbox Rust

### 9. Implémenter `cli.py` comme wrapper Python gouverné

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/cli.py`

Plan:

- autoriser seulement des commandes strictement whitelistées dans `tools.yaml`
- exécuter avec:
  - timeout
  - capture stdout/stderr
  - sans shell libre
- refuser toute commande absente de la whitelist
- concevoir l’API comme façade future vers `engine_rust/cli/sandbox.rs`

Décision:

- pas de shell générique
- pas de concaténation arbitraire
- pas d’écriture destructive ouverte

### 10. Implémenter `gmail.py` et `calendar.py` en mode réel minimal mais dégradable

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/gmail.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/calendar.py`

Plan:

- livrer des outils réellement structurés autour d’OAuth2 Google, mais avec portée minimale
- séparer:
  - config/présence des credentials
  - disponibilité réelle
  - exécution
- supporter un mode dégradé propre:
  - si credentials/tokens manquent, l’outil existe mais répond `not_configured` avec message explicite
- limiter les opérations initiales:
  - Gmail: lister messages récents, éventuellement envoyer un email simple si config complète
  - Calendar: lister événements à venir, éventuellement créer un événement simple si config complète

Pourquoi:

- respecte la décision “réel + minimal”
- évite de bloquer tout M3.1 sur une UX OAuth complète non encore cadrée

### 11. Implémenter `vision.py` en mode réel minimal et local

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/tools/vision.py`

Plan:

- livrer une première version locale et minimale:
  - entrée image ou capture écran si disponible
  - inférence YOLO seulement si dépendances/modèle sont configurés
- sinon répondre proprement `not_configured` / `not_available`
- ne pas essayer de construire tout le pipeline capture native Rust ici

Décision:

- `vision.py` dans `M3.1` agit comme couche Python orientée outil
- la capture native lourde et le sandbox système restent compatibles avec une future évolution Rust

### 12. Préparer l’intégration future au LLM sans livrer `M3.3`

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- éventuellement `antaerus/providers/brain_python/src/antaerus_brain/api/llm.py`

Plan:

- étendre les schémas LLM internes pour pouvoir:
  - publier les schémas tools
  - transporter un appel d’outil ou une demande de catalogue si nécessaire
- ne pas boucler encore l’orchestration complète du function calling
- s’arrêter à la préparation de contrat et à l’exposition du catalogue côté brain

Pourquoi:

- respecte la frontière `M3.1` / `M3.3`
- évite de mélanger registry des outils et orchestration LLM complète

### 13. Ajouter les dépendances et la couverture de tests

Fichiers:

- `antaerus/providers/brain_python/pyproject.toml`
- nouveaux tests sous `antaerus/providers/brain_python/tests/`

Plan:

- ajouter seulement les dépendances nécessaires au lot minimal:
  - YAML
  - scraping HTML
  - clients Google/OAuth si retenus
  - vision si réellement intégrée en mode minimal
- créer des tests ciblés:
  - `test_tool_registry.py`
  - `test_tool_schema.py`
  - `test_tools_api.py`
  - `test_browser_tool.py`
  - `test_weather_tool.py`
  - `test_memory_tool.py`
  - `test_filesystem_tool.py`
  - `test_cli_tool.py`
  - tests dégradés pour `gmail`, `calendar`, `vision`
- garder des tests orientés comportement:
  - validation de whitelist
  - erreurs propres si non configuré
  - formes de sortie stables

### 14. Mettre à jour la documentation et le backlog

Fichiers:

- `tasks.md`
- `antaerus/providers/brain_python/README.md`
- éventuellement `antaerus/docs/contracts.md` si l’API `tools` interne doit y figurer

Plan:

- documenter la nouvelle API interne `tools`
- documenter `antaerus/config/tools.yaml`
- documenter les prérequis optionnels pour Gmail/Calendar/Vision
- mettre à jour `tasks.md` à la fin de l’implémentation

## Hypothèses Et Décisions

- `M3.1` livre un **socle exécutable d’outils Python**, pas encore le function calling complet `M3.3`.
- Les outils exposés par API interne sont destinés au debug et à la validation technique, pas au frontend direct.
- `filesystem.py` et `cli.py` sont des **wrappers Python strictement gouvernés**, conçus pour être remplacés ou raccordés au sandbox Rust en `M3.2`.
- `antaerus/config/tools.yaml` remplace toute idée de `config/` racine pour rester conforme aux règles structurelles du dépôt.
- `gmail.py`, `calendar.py` et `vision.py` existent réellement dans le code, mais peuvent répondre proprement `not_configured` si l’environnement local n’est pas prêt.
- Le lot ne doit pas introduire de mutation runtime de l’environnement; toute config reste chargée au boot depuis `antaerus/.env` et `antaerus/config/tools.yaml`.

## Vérifications

Vérifications Python:

- `python -m ruff check .`
- `python -m mypy src tests`
- `python -m pytest tests`

Vérifications fonctionnelles:

- `GET /tools` liste le catalogue, l’état `enabled` et la disponibilité réelle
- `POST /tools/execute` exécute un outil autorisé et renvoie une structure stable
- `browser` renvoie des résultats de recherche et du texte extrait
- `weather` renvoie une météo actuelle minimale
- `memory_tool` écrit dans le backend mémoire existant
- `filesystem` refuse toute lecture hors whitelist
- `cli` refuse toute commande non whitelistée
- `gmail`, `calendar`, `vision` renvoient un état explicite si non configurés

Vérifications d’architecture:

- aucun fichier créé hors `antaerus/`
- `tools.yaml` sous `antaerus/config/`
- config immuable et secrets sous `SecretStr`
- capabilities du brain mises à jour

Vérifications de documentation:

- `tasks.md` mis à jour
- README `brain_python` aligné
- documentation de l’API interne `tools` alignée avec le comportement réel
