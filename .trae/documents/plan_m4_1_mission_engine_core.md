# Plan M4.1 — Mission Engine Core (Python)

## 1. Conclusion de la recherche repository

### 1.1 Exigences explicites (tasks.md + cahier-des-charges)

**tasks.md §M4.1 (7 items [ ])** :

1. `brain_python/mission/engine.py` — décomposition demande en étapes
2. `brain_python/mission/verifier.py` — vérification structurale (syntaxe plan)
3. `brain_python/mission/semantic_verifier.py` — vérification sémantique (cohérence)
4. `brain_python/mission/orchestrator.py` — exécution étape par étape
5. `brain_python/mission/reflexion.py` — réflexion post-mission
6. `brain_python/mission/state.py` — persistance état mission (SQLite)
7. `brain_python/mission/recovery.py` — reprise après crash (idempotence)

**CDC §3.1.5 (F-501 à F-507)** : Décomposition, vérification structurale, vérification sémantique, exécution étape par étape, reprise après crash, réflexion post-mission, Capability Engine (futur).

### 1.2 Code existant sur lequel s'appuyer

- **LLM + tool calling déjà livrés** :
  - Modèles Pydantic : [llm/__init__.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py) (`ChatMessage`, `GenerationRequest`, `CompletionResult`, `ToolCall`)
  - Factory client : [llm/factory.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/llm/factory.py)
  - Orchestrateur function calling : [tool_calling/orchestrator.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/tool_calling/orchestrator.py)
  - Tool Registry + schémas : [tools/tool_registry.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/tools/tool_registry.py)

- **Mémoire SQLite + schéma** :
  - Tables existantes (events, chat_sessions, chat_messages, facts) : [memory/schemas.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/memory/schemas.py)
  - Kernel avec pattern `initialize()` + `aiosqlite` : [memory/kernel.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py)
  - Settings (port, memory_db_path frozen dataclass) : [config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py)

- **Configuration & qualimétrie** :
  - `pyproject.toml` : ruff (line-length 100), mypy (python 3.11, check_untyped_defs), pytest (markers integration)
  - Qualité à conserver : SecretStr, pas de mutation config, audit des tool calls déjà en place

### 1.3 Ce qui n'existe PAS encore

- Aucun package `antaerus_brain/mission/` (vide)
- Aucune table SQLite `missions`, `mission_steps`, `mission_events`
- Aucun endpoint `/missions` dans l'API FastAPI brain
- Aucun contrat/message de mission dans kernel (sera probablement ajouté en M4.2 côté Go, mais M4.1 ne touche que Python brain)

---

## 2. Fichiers et modules à créer / modifier

### 2.1 Nouveaux fichiers (package mission)

```
antaerus/providers/brain_python/src/antaerus_brain/mission/
  __init__.py             — ré-export API publique
  schemas.py              — modèles Pydantic : Mission, MissionStep, MissionStatus, StepResult + SCHEMA_STATEMENTS SQLite
  state.py                — MissionStateStore : CRUD mission + étapes + idempotence keys dans SQLite
  engine.py               — MissionPlanner : décomposition LLM user_request -> Mission (étapes)
  verifier.py             — StructuralVerifier : règles Pydantic + contraintes syntaxiques
  semantic_verifier.py    — SemanticVerifier : vérification cohérence via LLM léger
  orchestrator.py         — MissionOrchestrator : exécution séquentielle étapes + recovery hooks
  recovery.py             — RecoveryManager : reprise après crash, détections steps interrompus, replay idempotent
  reflexion.py            — ReflexionEngine : bilan post-mission + extraction faits + lessons learned
```

### 2.2 Fichiers existants à modifier (minimal, surgical)

| Fichier | Modification |
|---------|--------------|
| [memory/schemas.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/memory/schemas.py) | Ajouter 4 CREATE TABLE missions / mission_steps / mission_events / mission_step_idempotency dans `SCHEMA_STATEMENTS` (OU, mieux, les déclarer dans `mission/schemas.py` et laisser MemoryKernel les charger — on choisit : schemas dans mission/schemas.py pour couche stricte) |
| [config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py) | Ajouter champs optionnels frozen : `mission_max_steps`, `mission_llm_timeout_seconds`, `mission_recovery_enabled`, `mission_reflexion_enabled` — depuis `.env` avec defaults conservateurs |
| [.env.example](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/.env.example) | Ajouter bloc `# Mission Engine` avec les 4 nouvelles vars (ANTAERUS_BRAIN_MISSION_*) |
| [app.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/app.py) | Inclure router missions APIRouter pour exposer `/missions` (POST create, GET list, GET by id, POST by id/step, POST by id/recover, POST by id/reflect) |
| [api/health.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/health.py) | Ajouter capabilities `mission-engine`, `mission-state-store`, `mission-reflexion` (optionnel : désactivé si `ANTAERUS_BRAIN_MISSION_*` absents) |
| [api/__init__.py si existe ?](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api) | Si besoin créer le package mission API dans `api/missions.py` (on crée `api/missions.py`) |

### 2.3 Nouveaux tests

```
antaerus/providers/brain_python/tests/
  test_mission_schemas.py         — création tables + contraintes SQLite
  test_mission_state.py           — CRUD, idempotence keys, list par status, update atomique
  test_mission_engine.py          — planner LLM renvoie Mission cohérente (mock LLM sans provider réel)
  test_mission_verifier.py        — structural: step dupliqués, steps vides, ordre illégal
  test_mission_semantic_verifier.py — mock semantic ok/ko via LLM stub
  test_mission_orchestrator.py    — execute mission full, step failed gère erreur, stop-early
  test_mission_recovery.py        — crash simulé (raise au step 2), recovery reprend au step 2 avec idempotence
  test_mission_reflexion.py       — produit ReflexionReport + faits suggérés (mock)
  test_mission_api.py             — routes FastAPI via TestClient (pas de LLM réel)
```

---

## 3. Étapes détaillées d'implémentation

**Principe** : livrer par couches de bas en haut (state → engine → verifier → orchestrator → recovery → reflexion → API). Chaque couche peut être testée indépendamment avant de composer.

### Étape 1 — `mission/schemas.py` + `mission/__init__.py` (1er jalon testable)

- Définir modèles Pydantic :
  - `MissionStatus = Literal["draft", "planned", "pending_approval", "running", "paused", "completed", "failed", "cancelled"]`
  - `StepStatus = Literal["pending", "running", "skipped", "completed", "failed", "rolled_back"]`
  - `MissionStep` (id, index:int, title:str, description:str, tool_name:Optional[str], tool_args:Optional[dict], depends_on:list[int], expected_output:Optional[str], status:StepStatus, result:Optional[StepResult])
  - `Mission` (id, session_id, title, user_request:str, plan:str, steps:list[MissionStep], status:MissionStatus, autonomy_level:int=0, budget_tokens:int=0, used_tokens:int=0, created_at, updated_at, started_at:Optional, completed_at:Optional)
  - `StepResult` (step_id, ok:bool, status:StepStatus, output:str, tool_name:Optional, tool_args:Optional, raw:Optional[dict], started_at, finished_at, error:Optional[str])
  - `IdempotencyKey` (mission_id, step_id, payload_hash:str, executed_at)
  - `ReflexionReport` (mission_id, summary:str, successes:list[str], failures:list[str], suggested_fixes:list[str], facts_to_remember:list[str], score_quality:float)
- Définir `MISSION_SCHEMA_STATEMENTS` avec 4 tables :
  - `missions (id PK, session_id, title, user_request TEXT, plan TEXT, status TEXT, autonomy_level INT, budget_tokens INT, used_tokens INT, created_at TEXT, updated_at TEXT, started_at TEXT NULL, completed_at TEXT NULL)`
  - `mission_steps (id PK, mission_id FK, idx INT UNIQUE per mission, title, description TEXT, tool_name TEXT NULL, tool_args TEXT NULL(JSON), depends_on TEXT NULL(JSON array), expected_output TEXT NULL, status TEXT, result_json TEXT NULL, started_at TEXT NULL, finished_at TEXT NULL, error TEXT NULL)`
  - `mission_events (id PK, mission_id FK, step_id NULLABLE, kind TEXT, payload TEXT, created_at TEXT)` — append-only audit
  - `mission_step_idempotency (mission_id TEXT, step_id TEXT, payload_hash TEXT, executed_at TEXT, result_snapshot TEXT, PRIMARY KEY (mission_id, step_id, payload_hash))`
- Ajouter index : `idx_missions_session_status(session_id, status)`, `idx_mission_steps_mission_idx(mission_id, idx)`

### Étape 2 — `mission/state.py` : MissionStateStore

- Dépend de `MemoryKernel.database_path` (ou prend `database_path:Path` en arg) et `MISSION_SCHEMA_STATEMENTS`
- API asynchrone :
  - `initialize()` → crée tables si besoin (appelé depuis MemoryKernel.initialize ? Non : StateStore a son propre initialize, appelé par l'orchestrateur avant usage)
  - `create_mission(mission: Mission) -> Mission`
  - `get_mission(mission_id) -> Mission`
  - `list_missions(session_id? status? limit?) -> list[Mission]`
  - `update_mission_status(mission_id, status, **extra) -> Mission` (atomic, updated_at)
  - `upsert_step(mission_id, step: MissionStep)`
  - `mark_step_started(mission_id, step_id)`
  - `mark_step_finished(mission_id, step_id, result: StepResult)`
  - `mark_step_failed(mission_id, step_id, error: str)`
  - `append_event(mission_id, kind, payload)` — events append-only
  - `record_idempotency(mission_id, step_id, payload_hash, result_snapshot_json)`
  - `get_idempotency(mission_id, step_id, payload_hash) -> Optional(result_snapshot)`
  - `find_interrupted_steps(mission_id) -> list[MissionStep]` (status running + pas finished_at)
- Règle : toutes écritures = `async with aiosqlite.connect(...)` + commit, jamais mutation hors DB.

### Étape 3 — `mission/engine.py` : MissionPlanner (décomposition LLM)

- Entrées : `user_request:str`, `context_messages:list[ChatMessage] optionnel`, `available_tools:list[ToolDescriptor]` (depuis ToolRegistry.describe_tools())
- Construction d'un `GenerationRequest` avec prompt système dédié :
  - Rôle : "Tu es un planner d'équipe. Décompose la demande en étapes concrètes, séquencées, qui utilisent les outils disponibles. Chaque étape = 1 action. N'utilise que des outils listés dans available_tools ; si manque outil, marque étape avec tool_name=null et expected_output=description de l'outil manquant pour Capability Engine futur."
- `max_tokens` augmenté (1024 au lieu de 512), température basse 0.1
- Parser la réponse LLM en `Mission` :
  - Si LLM renvoie JSON : Pydantic parse
  - Si LLM renvoie Markdown : extraire blocs etapes avec heuristique simple (Puis/Ensuite/1. 2.) + fallback verifier structuré
- Retourne `Mission` avec status="planned" + steps cohérentes

### Étape 4 — `mission/verifier.py` : StructuralVerifier

- Prend un `Mission` -> retourne `VerificationResult(ok:bool, errors:list[str], warnings:list[str])`
- Règles hard (structurale, pas LLM) :
  1. Au moins 1 étape si status != draft
  2. Index steps 0..N consécutifs (sans trou, sans doublon)
  3. `depends_on` référencent des index existants ET < index courant (pas cycle direct)
  4. Si `tool_name` non null : doit exister dans `allowed_tool_names` passé en arg
  5. Si expected_output est rempli : pas de texte énorme (> 2000 chars)
  6. title/user_request non vides
  7. Pas de `tool_args` avec types interdits (seulement JSON-encodable : str/int/float/bool/list/dict/null)
- Validation par `pydantic` : modèle strict, forbid_unknown sur MissionStep si désiré.

### Étape 5 — `mission/semantic_verifier.py` : SemanticVerifier

- Prend Mission + contexte -> `VerificationResult`. Logique :
  - Prompt léger LLM (température 0.0) : "Vérifie la cohérence de ce plan étape par étape. Signale seulement les incohérences graves (A -> B impossible car prérequis B non fourni par A). Retourne JSON strict ok/errors/warnings."
  - Fallback : si LLM indisponible -> warning "semantic skipped (provider unreachable)" + ok=True pour ne pas bloquer M4.2 Go proxy.
  - Timeout court, 2 appels max.

### Étape 6 — `mission/orchestrator.py` : MissionOrchestrator (exécution étape par étape)

- Dépendances : StateStore + ToolRegistry + LLMClient + RecoveryManager + StructuralVerifier
- Workflow principal asynchrone `run(mission_id) -> Mission` :
  1. Charge mission depuis StateStore → si status pas "planned" / "paused" → erreur
  2. Validation structurale (échec -> status "failed", event append)
  3. Validation sémantique (échec grave (blocant) -> status "pending_approval" avec warnings dans event)
  4. Status -> "running", started_at = now
  5. Pour chaque étape par index :
     a. Check depends_on toutes terminées ok, sinon mark skipped avec raison
     b. Check idempotence : si hash(step.tool_args) déjà joué → rejoue snapshot, pas ré-exécute
     c. Record idempotency + mark running
     d. Si tool_name est None (outil manquant Capability Engine) → mark skipped + warning event
     e. Sinon : construire tool call via orchestrator.py existant (complete_with_tools ? Non : ici on appelle registry.execute direct car étape = 1 outil)
     f. Capture ToolResult → mark_step_finished ou failed
     g. Si failed → selon stratégie (par défaut : stop mission status failed ; option retry via config future)
     h. used_tokens mis à jour
  6. Fin boucle → status "completed", completed_at, event bilan
  7. Optionnel : déclencher ReflexionEngine si mission successful + config.reflexion_enabled
- Progress events émis en append-only dans mission_events à chaque transition.

### Étape 7 — `mission/recovery.py` : RecoveryManager

- API :
  - `scan() -> list[(mission_id, reason)]` — détecte missions en "running" sans heartbeat (en pratique : running depuis > 2x mission_timeout ou step.status="running" sans finished_at)
  - `recover(mission_id) -> Mission`
    - Reprend en mode resume : pour chaque step "running" interrompu :
      - Si idempotency existante → mark finished avec snapshot
      - Sinon → mark failed avec "recovered_interrupted"
    - Puis reprend l'orchestrateur depuis le premier step pending
  - Garantie : replay d'une étape déjà réussie = no-op (grâce à idempotency payload_hash)
- Hooké par MissionOrchestrator : chaque call `run` tente de recover avant de planifier.

### Étape 8 — `mission/reflexion.py` : ReflexionEngine

- Entrée : Mission complète (avec tous steps, résultats, events)
- Génère `ReflexionReport` via 1 appel LLM :
  - prompt : "Fais le bilan de cette mission étape par étape. Identifie succès, échecs, corrections possibles pour une prochaine mission similaire, et 3 faits concrets à retenir sur l'utilisateur ou le contexte."
- Persiste :
  - `mission_events(kind="reflexion", payload=report.json())`
  - En option, transmet les `facts_to_remember` à `MemoryKernel.ingest_fact(...)` pour mémoire long terme (futur, ici on écrit juste les facts candidates via le schema MemoryKernel existant)

### Étape 9 — API Brain FastAPI : `api/missions.py` + inclusion dans app.py

- Router APIRouter(prefix="/missions", tags=["mission"])
- Routes :
  - `POST /missions` : body={sessionId, userRequest, provider?} → crée Mission via planner → verifier → state → 201 (Mission JSON)
  - `GET /missions?sessionId=&status=&limit=50` → list
  - `GET /missions/{mission_id}` → détail Mission + steps
  - `POST /missions/{mission_id}/run` → orchestrator.run → Mission JSON (peut être long : endpoint synchrone simple ; stream/WS = M4.2 Go)
  - `POST /missions/{mission_id}/recover` → recovery
  - `POST /missions/{mission_id}/reflect` → reflexion (sur mission completed/failed)
  - `GET /missions/{mission_id}/events` → audit trail (mission_events JSONL-lite)
- Toutes routes : dépendances Settings + StateStore singleton + Planner + Orchestrator injectés.
- Erreurs : HTTP 400 (validation structurale), 404 (mission inconnue), 409 (mauvais statut pour run/recover), 500.

### Étape 10 — Modifications dans config.py, .env.example, health.py

- [config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py) : ajouter frozen fields avec defaults conservateurs :
  - `mission_max_steps: int = 20`
  - `mission_llm_timeout_seconds: float = 60.0`
  - `mission_recovery_enabled: bool = True`
  - `mission_reflexion_enabled: bool = True`
- [.env.example](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/.env.example) : bloc "Mission Engine" avec 4 vars `ANTAERUS_BRAIN_MISSION_*`.
- [api/health.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/health.py) : capabilities `mission-engine`, `mission-state-store`, `mission-recovery`, `mission-reflexion` (toutes true puisque code présent ; future feature flag si besoin).

---

## 4. Dépendances et considérations

### 4.1 Dépendances Python existantes utilisées (aucune nouvelle)

- FastAPI / pydantic 2 — déjà là
- aiosqlite — déjà là (patterns MemoryKernel repris exactement)
- litellm — déjà là, utilisé via `create_llm_client(settings, provider)`
- httpx — déjà là
- python-dotenv — déjà là pour `.env`

Aucune `dependencies` nouvelle à ajouter dans `pyproject.toml`.

### 4.2 Contraintes architecturales du monorepo à respecter

1. **Couches strictes (CDC §5.1)** : `mission/` dépend de `memory`, `llm`, `tools`, `approval`, `config`. Rien ne doit remonter depuis mission vers `api` sauf le router (uni-directionnel). Import-linter (configuré dans run_import_linter.py, .importlinter) : on ajoutera 1 règle autorisant `antaerus_brain.api -> antaerus_brain.mission` et `antaerus_brain.mission -> antaerus_brain.memory/llm/tools/config/approval`. On **vérifie** import-linter passe à la fin.
2. **Pas de shim racine, pas d'OS mutation** : toujours utiliser Settings frozen dataclass, jamais `os.environ[...]` assignment.
3. **Secrets** : jamais loger un API key ; tous champs secrets en `SecretStr` (mission ne manipule pas de nouveaux secrets donc rien à ajouter).
4. **Logs/debug sans emojis** (règle user_profile) : tous strings, messages clairs.
5. **Idempotence et reprise** : chaque écriture step a payload_hash, nécessaire pour recovery après crash (M4.1 spec).

### 4.3 Stratégie de test vs providers LLM

- **Règle M4.1 : tous tests utilisent un `FakeLLMClient` injectable** qui retourne une réponse pré-câblée. Aucun test ne dépend d'un provider cloud. Les 1-2 tests "smoke avec vrai LLM" sont marqués `@pytest.mark.integration` et exclus par défaut (même pattern que le M1.2).
- **Mocks ToolRegistry** : outils fantoches ("noop", "succeed", "fail", "slow") pour valider orchestrateur et recovery sans vrai tool.
- SQLite tests : `tmp_path` pytest pour database isolée par test.
- Idempotence test : appel répété avec mêmes args → 1 exécution seule.

### 4.4 Qualité (obligatoire à chaque itération)

- `ruff check src tests`
- `ruff format --check src tests`
- `run_import_linter.py`
- `mypy src`
- `pytest -m "not integration"`

---

## 5. Risques et traitement

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Planner LLM renvoie format non parseable (pas JSON) | Moyenne | Élevée (bloque orchestrateur) | Multi-stratégies de parsing : JSON -> Pydantic ; fallback regex lignes d'étapes ; fallback structural verifier renvoie Mission vide avec erreur ; 3 tentatives avec feedback "ta réponse n'est pas du JSON". |
| Exécution mission = endpoint synchrone long (30s+) | Moyenne | Moyen | M4.1 garde endpoint synchrone simple (suffit pour foundation). M4.2 Go exposera session voix/mission en WS ; l'orchestrateur émet des events que Go consomme. |
| Schema SQLite ajouté dans SCHEMA_STATEMENTS memory = import couche cassée | Faible | Élevé | Solution retenue : MISSION_SCHEMA_STATEMENTS VIVENT DANS mission/schemas.py, pas memory. StateStore.initialize() crée ses tables. Reste compatible, pas d'édition SCHEMA_STATEMENTS global. |
| Règles structurales trop strictes = impossible de planifier | Moyenne | Moyen | StructuralVerifier has warnings + errors séparés. Warnings = n'empêchent pas run, stockés en events. |
| Recovery rejoue un step à effets de bord | Moyenne | Élevé | Idempotency hash(tool_name + tool_args canonique) + snapshot ; documentation dans tool base.py "implémentations tools doivent être idempotentes when possible" |
| Mission infinite loop via depends_on cycle | Faible | Élevé | Structural verifier step 3 (DAG) + max_iter guard orchestrateur (max_steps * 2 itérations). |

---

## 6. Critères d'acceptation M4.1 (cochables à la fin)

- [ ] Package `antaerus_brain.mission` existe avec les 8 modules décrits (state, engine, verifier, semantic_verifier, orchestrator, recovery, reflexion, schemas) + `__init__.py`
- [ ] `python -m pytest tests/test_mission_*.py -m "not integration"` → 0 échec, 80%+ de couverture lignes mission
- [ ] `python -m mypy src` : 0 erreurs nouvelles (vérifier delta vs baseline)
- [ ] `python -m ruff check src tests ../../kernel` : 0 erreur
- [ ] `python run_import_linter.py` : 0 violation
- [ ] `cargo check` (Rust) / `go build ./...` (Go) / `npm run check` (React) : 0 régression (M4.1 ne doit pas les toucher)
- [ ] Endpoints `/missions` FastAPI exposés dans brain, health capabilities renvoient `mission-engine` etc.
- [ ] Scénario demo jouable sans provider LLM (fake) : create → structural ok → semantic ok → run toutes étapes ok → reflexion → récupération state par id
- [ ] Scénario recovery : crash simulé (exception step 2) → recover() reprend au step 2 sans ré-exécuter step 0 et 1 (grâce idempotence)
- [ ] Fichiers modifiés listés ci-dessus : config.py, .env.example, app.py, health.py, api/missions.py nouveaux

---

## 7. Ordre d'exécution opérationnel (étapes concrètes reproductibles)

1. Créer le dossier `mission/` + `__init__.py` vide + `schemas.py` → écrire tables + modèles → écrire `test_mission_schemas.py` → `pytest` (première passe verte)
2. Implémenter `state.py` → `test_mission_state.py` → pytest
3. Implémenter `engine.py` (planner) avec FakeLLMClient → `test_mission_engine.py` → pytest
4. Implémenter `verifier.py` → `test_mission_verifier.py` → pytest
5. Implémenter `semantic_verifier.py` (avec LLM Fake stub + timeout) → `test_mission_semantic_verifier.py` → pytest
6. Implémenter `recovery.py` minimal (utile pour orchestrateur) → commencer par scan/recover basique → `test_mission_recovery.py` étape 1
7. Implémenter `orchestrator.py` (utilise state + verifier + registry) → `test_mission_orchestrator.py` → pytest ; puis enrichir recovery.py full → compléter `test_mission_recovery.py`
8. Implémenter `reflexion.py` (Fake LLM) → `test_mission_reflexion.py` → pytest
9. Créer `api/missions.py` router + intégrer dans `app.py` → `test_mission_api.py` (TestClient)
10. Éditer config.py et .env.example (4 vars) → ré-exécuter pytest + mypy + ruff + import-linter
11. Éditer api/health.py capabilities → lancer le smoke brain local pour vérifier /health renvoie mission
12. Rejouer les suites de non-régression : `task lint:python`, `task typecheck:python`, `task test:python`
13. Mettre à jour tasks.md cases M4.1 en [x] + rédiger un petit "État actuel : M4.1" (1 paragraphe comme M1.4/M2/M3 dans tasks.md)
