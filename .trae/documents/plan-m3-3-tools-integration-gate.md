# Plan M3.3 - Tools Integration And Gate

## Résumé

Objectif: finaliser `M3.3` en branchant réellement les tools sur le flux conversationnel principal du `brain_python`, en transformant `filesystem` et `cli` en proxys Python vers `engine_rust` via HTTP interne, et en rendant le gate composite exécutable pour les actions tool de niveau `3+`.

Décisions verrouillées pendant le cadrage:

- intégration Rust: **proxy Python -> Rust**
- transport inter-services pour les tools Rust: **HTTP interne**
- activation du function calling: **`POST /llm/session-stream` uniquement**
- politique de gate pour les tools Rust `niveau 3+`: **auto `allow` avec audit minimal**, pas de `review` pour `filesystem` lecture seule ni `cli` whitelistée dans ce lot

Résultat attendu après exécution:

- le `SessionChatService` sait fournir les schémas tools au LLM, interpréter un tool call, exécuter l’outil ciblé puis reformuler une réponse finale
- `filesystem` et `cli` côté Python délèguent vers `engine_rust` via endpoints HTTP internes dédiés
- un gate composite minimal mais réel décide `allow` / `review` / `deny` à partir du risque, de la catégorie et du niveau d’autonomie
- les exécutions Rust passent par ce gate et laissent une trace d’audit append-only
- les tests `browser`, `gmail`, `calendar` et `vision` existent au bon niveau
- `tasks.md` et `docs/contracts.md` reflètent `M3.3`

## Analyse De L'état Actuel

- `M3.3` ne contient aujourd’hui que quatre lignes backlog dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L282-L288), sans design dédié déjà committé.
- Le socle Python existe: tools, registry dynamique, schémas LLM, API `GET /tools` et `POST /tools/execute`, documentés dans [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L258-L265) et [contracts.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/docs/contracts.md#L35-L69).
- Le `SessionChatService` actuel streame simplement la sortie du provider LLM sans boucle tool-aware dans [chat.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/chat.py#L21-L122).
- Le client LiteLLM accepte déjà `tools` et `tool_choice` dans le modèle Pydantic, mais ne les transmet ni ne parse les `tool_calls` dans [llm/__init__.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py#L22-L31) et [llm/api.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/llm/api.py#L34-L133).
- Les tools Rust existent localement depuis `M3.2`, mais `engine_rust` n’expose encore que `/health` et `/capabilities` dans [http.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/http.rs#L1-L28).
- Aucun code de gate composite n’existe encore; seul le principe minimal `risque × catégorie × budget -> allow/review/deny` est décrit dans [gate.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/kernel/approval/gate.md#L1-L10).
- La config partagée `antaerus/config/tools.yaml` existe déjà et reste la source de vérité pour les whitelists et flags métier, mais le `brain_python` n’a encore aucune config `engine_base_url`.
- Les tests outils sont incomplets: `browser` est couvert, mais pas `gmail`, `calendar`, `vision`, ni la boucle `LLM -> tool -> réponse finale`.

## Changements Proposés

### 1. Ajouter la connectivité Python -> Rust pour les tools sandboxés

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/config.py`
- `antaerus/.env.example`
- nouveau `antaerus/providers/brain_python/src/antaerus_brain/tools/rust_proxy.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/filesystem.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/cli.py`

Plan:

- ajouter au `Settings` du brain une URL interne vers `engine_rust`, par exemple `engine_base_url`
- documenter sa variable d’environnement dans `antaerus/.env.example`
- créer un petit client `httpx` dédié aux tools Rust côté brain, avec timeout borné et sérialisation claire des erreurs réseau
- faire évoluer `filesystem.py` et `cli.py` pour qu’ils restent des outils Python du point de vue du registry, mais qu’ils délèguent l’exécution réelle à `engine_rust`
- conserver le même contrat `ToolResult` vu par le reste du brain

Pourquoi:

- l’utilisateur a choisi un **proxy Python**
- `M3.2` a livré les briques Rust, `M3.3` doit maintenant les rendre consommables

### 2. Exposer des endpoints HTTP internes tools dans `engine_rust`

Fichiers:

- `antaerus/providers/engine_rust/src/http.rs`
- `antaerus/providers/engine_rust/src/config.rs`
- nouveaux DTO ou module dédié, par exemple `antaerus/providers/engine_rust/src/http_tools.rs`
- `antaerus/providers/engine_rust/src/fs/reader.rs`
- `antaerus/providers/engine_rust/src/cli/sandbox.rs`
- `antaerus/providers/engine_rust/src/sandbox/wasm.rs`

Plan:

- ajouter dans `engine_rust` des endpoints HTTP internes minimaux pour:
  - lecture `filesystem`
  - exécution `cli`
  - éventuellement exécution `wasm` si on décide d’exposer aussi cette capacité dans le même contrat interne
- utiliser les modules `M3.2` existants comme backend d’exécution
- définir des payloads JSON minimaux et stables, proches du contrat `ToolResult`
- borner les erreurs Rust de façon lisible pour le brain

Pourquoi:

- l’utilisateur a choisi **HTTP interne**
- `engine_rust` a déjà un serveur HTTP, donc l’extension est plus cohérente que l’introduction d’un nouveau transport dans ce lot

Comment:

- garder ces routes strictement internes
- ne pas modifier `engine.proto` ni le bridge Go dans `M3.3`
- exposer `filesystem` et `cli` de façon certaine; `wasm` peut être inclus au contrat HTTP s’il sert le gate/audit, mais il n’est pas nécessaire de le brancher au function calling dans ce lot

### 3. Rendre le gate composite exécutable côté brain

Fichiers:

- nouveau `antaerus/providers/brain_python/src/antaerus_brain/approval/gate.py`
- nouveau `antaerus/providers/brain_python/src/antaerus_brain/approval/audit.py`
- éventuellement `antaerus/providers/brain_python/src/antaerus_brain/approval/models.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/base.py`
- `antaerus/providers/brain_python/src/antaerus_brain/tools/__init__.py`

Plan:

- matérialiser le gate composite comme code Python, avec:
  - entrée: nom du tool, risque, catégorie, niveau d’autonomie, budget éventuel, contexte d’exécution
  - sortie: `allow`, `review`, `deny`, avec motif explicite
- enrichir les descriptors tools pour transporter la catégorie et le niveau d’autonomie si ces métadonnées ne sont pas encore présentes
- créer un audit append-only minimal côté brain pour enregistrer les exécutions `niveau 3+` validées
- appliquer la politique décidée:
  - `filesystem` lecture seule Rust: `allow` automatique + audit
  - `cli` whitelistée Rust: `allow` automatique + audit
  - `wasm` peut être classé `review` ou rester non exposé au LLM tant que son usage conversationnel n’est pas explicitement demandé dans ce lot

Pourquoi:

- `M3.3` demande de connecter les tools Rust au gate composite
- le dépôt ne contient actuellement qu’une note Markdown, sans implémentation exécutable

### 4. Brancher le function calling sur `POST /llm/session-stream`

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/chat.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/api.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- éventuellement nouveau `antaerus/providers/brain_python/src/antaerus_brain/tool_calling/orchestrator.py`

Plan:

- faire du flux `session-stream` le seul flux tool-aware de `M3.3`
- injecter `registry.llm_schemas()` dans la requête du premier tour LLM
- transmettre réellement `tools` et `tool_choice` au provider LiteLLM
- parser la réponse du provider:
  - réponse textuelle simple
  - réponse `tool_calls`
- si un tool est demandé:
  - valider le tool dans le registry
  - passer par le gate composite
  - exécuter le tool
  - réinjecter le résultat dans l’historique du tour courant
  - lancer un second appel LLM pour synthétiser la réponse finale utilisateur
- définir une limite de boucles raisonnable, par exemple `max_tool_round_trips = 1` ou `2`, pour éviter les boucles infinies

Pourquoi:

- c’est la sous-tâche principale explicite de `M3.3`
- le flux sessionnel est le bon point d’intégration produit selon la décision utilisateur

Comment:

- garder `POST /llm/chat` et `POST /llm/stream` inchangés dans ce lot
- éviter une refonte générale du client streaming si un premier passage non-streaming pour l’appel tool-aware simplifie la robustesse
- si besoin, le flux SSE `session-stream` peut continuer à ne streamer que la réponse finale, tout en effectuant les appels tools en interne

### 5. Définir le modèle de messages tools pour la boucle LLM

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/chat.py`
- éventuellement `antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py`

Plan:

- introduire des structures explicites pour représenter:
  - un assistant qui propose un tool call
  - un message de résultat tool vers le LLM
- choisir une représentation compatible LiteLLM/OpenAI-style pour la requête de second tour
- décider ce qui est persisté en mémoire de session:
  - persister au minimum `user` et `assistant`
  - persister aussi les tool calls/résultats si cela aide la continuité et reste compatible avec le schéma mémoire existant

Pourquoi:

- sans ce modèle, la boucle de function calling reste implicite et fragile
- il faut un format stable pour les tests d’intégration

### 6. Couvrir `browser`, `gmail`, `calendar` et `vision`

Fichiers:

- nouveaux `antaerus/providers/brain_python/tests/test_gmail_tool.py`
- nouveaux `antaerus/providers/brain_python/tests/test_calendar_tool.py`
- nouveaux `antaerus/providers/brain_python/tests/test_vision_tool.py`
- mise à jour de `antaerus/providers/brain_python/tests/test_browser_tool.py`
- mise à jour de `antaerus/providers/brain_python/tests/test_llm_api.py`
- mise à jour ou ajout autour de `antaerus/providers/brain_python/tests/test_chat_session.py`

Plan:

- `browser`: compléter les tests pour couvrir l’usage “recherche puis synthèse” au niveau orchestrateur, pas seulement `search/fetch`
- `gmail`: ajouter un test d’exécution `list_recent` avec mocks HTTP OAuth/Gmail
- `calendar`: ajouter un test `create_event` avec configuration explicite `allow_create=true` dans le contexte de test
- `vision`: ajouter un test avec mock de modèle YOLO ou shim local pour vérifier la transformation du résultat
- ajouter un vrai test d’intégration sessionnelle `LLM -> tool call -> tool result -> réponse finale`

Pourquoi:

- ces scénarios sont explicitement listés comme objectifs de `M3.3` dans `tasks.md`
- la couverture actuelle ne suffit pas à prouver l’intégration

### 7. Documenter la clôture `M3.3`

Fichiers:

- `tasks.md`
- `antaerus/docs/contracts.md`
- `antaerus/providers/brain_python/README.md`
- éventuellement `antaerus/kernel/approval/gate.md`

Plan:

- cocher les tâches `M3.3` dans `tasks.md`
- ajouter un bloc `État actuel` expliquant:
  - function calling actif sur `session-stream`
  - proxy Python -> Rust via HTTP interne
  - gate composite opérationnel pour les tools Rust `niveau 3+`
  - portée inchangée des autres endpoints LLM
- compléter `contracts.md` avec:
  - les nouveaux endpoints HTTP internes de `engine_rust`
  - le fait que `session-stream` devient tool-aware
  - la politique de gate de ce lot
- actualiser le README du brain si nécessaire pour décrire le nouveau comportement conversationnel des tools

Pourquoi:

- `tasks.md` reste la source de vérité du projet
- `contracts.md` doit refléter le nouveau pont Python -> Rust et la boucle LLM outillée

## Hypothèses Et Décisions

- `M3.3` n’étend pas `engine.proto` et n’ajoute pas de bridge Go.
- Le function calling n’est activé que sur `POST /llm/session-stream` dans ce lot.
- `filesystem` et `cli` restent des tools enregistrés côté Python, mais leur exécution réelle passe par `engine_rust`.
- La source de vérité des whitelists et flags reste `antaerus/config/tools.yaml`.
- `filesystem` lecture seule et `cli` whitelistée sont classés `niveau 3` avec décision automatique `allow` et audit append-only minimal.
- `gmail.send` reste désactivé par défaut, et `calendar.create_event` peut être testé avec un override de config ciblé sans changer la valeur par défaut du dépôt si cela évite d’ouvrir trop largement les permissions.
- `wasm` n’a pas besoin d’être exposé au LLM conversationnel pour considérer `M3.3` comme terminé, tant que le gate composite Rust est réellement branché sur les exécutions Rust du lot.

## Vérifications

Vérifications Python:

- `python -m ruff check .`
- `python -m pytest tests`
- `python -m mypy src tests`

Vérifications Rust:

- `cargo check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test`

Vérifications fonctionnelles:

- un `session-stream` peut déclencher un tool Python non-Rust, récupérer son résultat et produire une réponse finale
- un `session-stream` peut déclencher `filesystem` ou `cli`, lesquels passent par le proxy HTTP vers `engine_rust`
- une exécution tool Rust `niveau 3` est auditée et `allow`
- `browser`, `gmail list_recent`, `calendar create_event` et `vision detect` ont chacun un test ciblé

Vérifications de périmètre:

- `POST /llm/chat` et `POST /llm/stream` restent inchangés
- aucun nouveau contrat gRPC n’est introduit dans ce lot
- les nouveaux endpoints tools de `engine_rust` restent internes et documentés comme tels
