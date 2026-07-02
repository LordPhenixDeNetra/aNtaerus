# Plan M3.3 - Finalisation Tools Integration

## Résumé

Objectif: finaliser effectivement `M3.3` en stabilisant la boucle `LLM -> tool -> réponse finale` sur `POST /llm/session-stream`, en validant le pont HTTP interne `brain_python -> engine_rust`, en fermant la régression de test encore ouverte dans `SessionChatService`, puis en mettant à jour la documentation de vérité du lot.

Décisions déjà verrouillées et à respecter:

- intégration Rust: `brain_python` agit comme proxy vers `engine_rust`
- transport inter-services pour les tools Rust: HTTP interne
- surface tool-aware: `POST /llm/session-stream` uniquement
- politique `niveau 3+` pour les tools `rust-sandbox`: auto `allow` avec audit append-only
- `tasks.md` reste la source de vérité finale du statut du lot

Résultat attendu après exécution:

- le flux `session-stream` exécute correctement un tool call puis retourne un événement SSE `complete`
- `filesystem` et `cli` passent bien par les endpoints HTTP internes Rust déjà ajoutés
- le gate composite et l'audit minimal couvrent réellement les tools Rust `autonomy_level >= 3`
- les tests ciblés `browser`, `gmail`, `calendar`, `vision` et l'intégration sessionnelle sont verts
- `tasks.md`, `antaerus/docs/contracts.md` et `antaerus/providers/brain_python/README.md` décrivent l'état réel de `M3.3`

## Analyse De L'etat Actuel

- `tasks.md` laisse encore `M3.3` entièrement ouvert dans `### M3.3 — Intégration Tools`, sans bloc `État actuel`.
- Le précédent plan `plan-m3-3-tools-integration-gate.md` a déjà été largement exécuté; le dépôt contient maintenant l'essentiel du code `M3.3`.
- Côté Python, les éléments suivants existent déjà:
  - `antaerus/providers/brain_python/src/antaerus_brain/tool_calling/orchestrator.py`
  - `antaerus/providers/brain_python/src/antaerus_brain/chat.py`
  - `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
  - `antaerus/providers/brain_python/src/antaerus_brain/llm/api.py`
  - `antaerus/providers/brain_python/src/antaerus_brain/approval/gate.py`
  - `antaerus/providers/brain_python/src/antaerus_brain/approval/audit.py`
  - `antaerus/providers/brain_python/src/antaerus_brain/tools/rust_proxy.py`
  - conversion des tools `filesystem` et `cli` en wrappers vers Rust
- Côté Rust, les endpoints internes existent déjà dans:
  - `antaerus/providers/engine_rust/src/http_tools.rs`
  - `antaerus/providers/engine_rust/src/http.rs`
- Les tests de couverture `browser`, `gmail`, `calendar`, `vision` et plusieurs adaptations `filesystem` / `cli` sont déjà présents.
- Le principal écart fonctionnel identifié par le résumé de session est une régression dans `antaerus/providers/brain_python/tests/test_chat_session.py`, où `SessionChatService.stream_session(...)` renvoie un événement `error` au lieu de `complete` dans le scénario tool-aware.
- Une autre régression de test `tools API` a déjà été corrigée localement dans `antaerus/providers/brain_python/tests/test_tools_api.py` par mock du proxy Rust.
- `antaerus/docs/contracts.md`, `antaerus/providers/brain_python/README.md`, `antaerus/kernel/approval/gate.md` et `tasks.md` ne reflètent pas encore l'état réel de `M3.3`.

## Changements Proposés

### 1. Corriger la régression `SessionChatService` tool-aware

Fichiers:

- `antaerus/providers/brain_python/src/antaerus_brain/chat.py`
- éventuellement `antaerus/providers/brain_python/src/antaerus_brain/tool_calling/orchestrator.py`
- `antaerus/providers/brain_python/tests/test_chat_session.py`
- éventuellement `antaerus/providers/brain_python/tests/test_llm_api.py`

Travail:

- reproduire précisément le chemin qui transforme aujourd'hui le scénario tool-aware en événement SSE `error`
- vérifier l'assemblage `generation_messages -> inject_system_prompt -> complete_with_tools -> StreamingEvent`
- confirmer si l'exception vient:
  - de la forme des messages `toolCalls` / `toolCallId`
  - d'un champ Pydantic aliasé entre `toolCalls` et `tool_calls`
  - de la persistance mémoire/session
  - ou d'un mock incomplet dans le test
- corriger le code minimalement, sans élargir le périmètre au streaming brut `POST /llm/stream`
- verrouiller la non-régression avec un test qui vérifie explicitement:
  - l'événement final `complete`
  - le texte final renvoyé
  - l'absence d'événement `error`

Pourquoi:

- c'est le seul blocage fonctionnel restant clairement identifié pour considérer `M3.3` comme livré
- l'orchestrateur isolé fonctionne déjà selon la reproduction précédente; le bug est donc probablement limité au flux sessionnel

### 2. Revalider la boucle tool-aware Python et les tests de couverture métier

Fichiers:

- `antaerus/providers/brain_python/tests/test_tools_api.py`
- `antaerus/providers/brain_python/tests/test_browser_tool.py`
- `antaerus/providers/brain_python/tests/test_gmail_tool.py`
- `antaerus/providers/brain_python/tests/test_calendar_tool.py`
- `antaerus/providers/brain_python/tests/test_vision_tool.py`
- `antaerus/providers/brain_python/tests/test_cli_tool.py`
- `antaerus/providers/brain_python/tests/test_filesystem_tool.py`
- `antaerus/providers/brain_python/tests/test_tool_registry.py`

Travail:

- rerun ciblé après correction du flux sessionnel pour confirmer que le mock Rust ajouté dans `test_tools_api.py` couvre bien le nouveau comportement
- ajuster uniquement les tests encore couplés à l'ancien mode local si d'autres apparaissent
- conserver des tests ciblés et utiles:
  - `browser`: recherche/fetch ou recherche utilisée dans une orchestration
  - `gmail`: lecture d'emails récents avec mocks OAuth/Gmail
  - `calendar`: création d'événement avec mocks OAuth/Calendar
  - `vision`: détection via mock de backend vision
  - `filesystem` / `cli`: proxy vers Rust via `execute_rust_tool`

Pourquoi:

- `M3.3` exige explicitement une preuve de fonctionnement de ces outils
- les régressions récentes montrent que plusieurs tests dépendaient encore de l'ancien contrat d'exécution

### 3. Revalider le pont HTTP interne Rust et la gouvernance

Fichiers:

- `antaerus/providers/engine_rust/src/http_tools.rs`
- `antaerus/providers/engine_rust/src/http.rs`
- `antaerus/providers/engine_rust/tests/http_tools.rs`
- `antaerus/providers/brain_python/src/antaerus_brain/approval/gate.py`
- `antaerus/providers/brain_python/src/antaerus_brain/approval/audit.py`

Travail:

- confirmer que les endpoints internes Rust restent alignés sur le contrat `ToolResult` attendu par `brain_python`
- vérifier que la politique en code reste conforme à la décision produit:
  - `rust-sandbox` niveau `3` => `allow` + audit
  - niveau `4+` => `review`
- vérifier le chemin d'audit append-only:
  - emplacement du fichier
  - format JSONL
  - déclenchement uniquement quand `requires_audit` vaut `True`
- ne pas ajouter de nouveau bridge Go ni de nouveau RPC gRPC

Pourquoi:

- cela constitue le coeur de l'intégration `M3.3` côté gouvernance
- les docs devront décrire ce comportement exactement tel qu'il est implémenté

### 4. Mettre à jour la documentation et le backlog de vérité

Fichiers:

- `tasks.md`
- `antaerus/docs/contracts.md`
- `antaerus/providers/brain_python/README.md`
- `antaerus/kernel/approval/gate.md`
- éventuellement `.env.example` si une divergence documentaire est constatée pendant validation

Travail:

- cocher les sous-tâches `M3.3` dans `tasks.md`
- ajouter un bloc `État actuel` sous `M3.3` qui décrit:
  - function calling actif sur `POST /llm/session-stream`
  - proxy `brain_python -> engine_rust` pour `filesystem` et `cli`
  - gate composite exécutable et audit minimal pour `rust-sandbox`
  - couverture de tests métier des outils listés
- compléter `antaerus/docs/contracts.md` avec:
  - les endpoints HTTP internes Rust `/internal/tools/filesystem/read` et `/internal/tools/cli/execute`
  - le fait que `session-stream` devient le flux tool-aware du lot
  - la sémantique homogène `ok/tool/status/result/error/meta`
- compléter `antaerus/providers/brain_python/README.md` sur:
  - le comportement de `POST /llm/session-stream`
  - la config `ANTAERUS_BRAIN_ENGINE_BASE_URL`
  - le fait que `filesystem` et `cli` sont désormais délégués à Rust
- densifier `antaerus/kernel/approval/gate.md` pour qu'il reflète la politique réellement codée, au lieu de rester un simple mémo `allow/review/deny`

Pourquoi:

- le lot est déjà majoritairement codé; la source de vérité projet doit maintenant rattraper l'implémentation réelle
- l'utilisateur demande explicitement l'exécution de `M3.3`, ce qui inclut la clôture documentaire

## Ordre D'execution Recommande

1. Corriger et reverdir le test `test_session_chat_service_executes_tool_call_and_returns_final_text`.
2. Rejouer `pytest` côté `brain_python` et corriger uniquement les régressions résiduelles liées à l'ancien comportement.
3. Rejouer les validations statiques Python.
4. Rejouer les validations Rust ciblant les endpoints HTTP tools et le socle existant.
5. Mettre à jour `tasks.md`, `contracts.md`, `README.md` et `gate.md`.
6. Refaire un dernier passage diagnostics/lint sur les fichiers modifiés.

## Hypotheses Et Decisions

- aucune nouvelle décision produit n'est nécessaire: les choix de transport, de surface d'activation et de gate ont déjà été validés
- `POST /llm/chat` et `POST /llm/stream` restent hors périmètre de transformation tool-aware
- `filesystem` et `cli` restent enregistrés comme tools Python, mais leur exécution réelle passe par Rust
- `browser`, `gmail`, `calendar` et `vision` doivent être validés par tests ciblés, pas nécessairement par un scénario E2E multi-outils
- `tasks.md` doit être mis à jour dans la même livraison que le code, pas après coup

## Verification

Vérifications Python:

- `python -m pytest tests`
- `python -m ruff check .`
- `python -m mypy src tests`

Vérifications Rust:

- `cargo check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test`

Vérifications ciblées fonctionnelles:

- le scénario `SessionChatService` avec tool call retourne bien `token` puis `complete`, sans `error`
- un tool `browser` appelé par la boucle LLM produit une réponse finale utilisateur
- `filesystem` et `cli` conservent le contrat homogène `ToolResult` via le proxy Rust
- une décision de gate `rust-sandbox` niveau `3` déclenche bien un audit append-only

Vérifications de périmètre:

- aucun nouveau contrat gRPC n'est introduit
- aucun changement n'est requis dans le gateway Go pour clore `M3.3`
- la documentation du lot correspond exactement aux comportements réellement codés
