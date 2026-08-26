# CONTENU DE antaerus_memory.db (TABLES SQL + SCHEMA)
> **Source principale :** Fichier [providers/brain_python/src/antaerus_brain/mission/schemas.py](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L134-L197) — constante `MISSION_SCHEMA_STATEMENTS: list[str]` exécutée par `await state.initialize()` (MissionStateStore).
> **But :** Documenter CHAQUE table SQL, CHAQUE colonne, type SQLite, index + contraintes (PK / FK / UNIQUE).
> **Fichier physique concerné :** `N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\memory_data\antaerus_memory.db`

---

## 🧭 TABLEAU RECAPITULATIF 8 TABLES DANS .DB

| # | Nom de la table SQL | Objet | Clé Primaire | Clé Étrangère |
|---|---|---|---|---|
| 1 | `missions` | 1 ligne = **1 carte Mission** dans `/missions` | `id TEXT` | — |
| 2 | `mission_steps` | 1 ligne = **1 SOUS-ÉTAPE** d'une mission (Étape 1: mail... Étape 2: ...) | `id TEXT` | `mission_id → missions.id` (ON DELETE CASCADE implicite) + `UNIQUE (mission_id, idx)` (pas 2 étapes même index) |
| 3 | `mission_events` | Journal / timeline événements mission (changement statut / étape terminée) | `id TEXT` | `mission_id → missions.id` |
| 4 | `mission_step_idempotency` | Déduplication : EMPÊCHE exécuter 2x LA MÊME étape avec même payload (hash SHA256) | `PRIMARY KEY (mission_id, payload_hash)` | — |
| 5 | `chat_sessions` | Historique session de chat page `/chat` (id session, provider...) | `session_id TEXT` | — |
| 6 | `chat_messages` | 1 ligne = **1 bulle chat** (role user / assistant + content) | `id TEXT` | `session_id → chat_sessions.session_id` |
| 7 | `events` | Kernel mémoire : timeline mémoire (connaissances) | `id TEXT` | — |
| 8 | `facts` + `fact_observations` | Graph mémoire sémantique aNtaerus (sujet/prédicat/objet=FAIT+observations) | `id TEXT` | `source_event_id → events.id` |
| 9 | `initiative_store` | Missions proactives curateur nocturne | `id TEXT` | — |

---

## 🔍 DÉTAIL TABLE PAR TABLE (MISSIONS SCHEMA)

> ℹ️ Types SQLite utilisés : `TEXT` (tous UUIDs + JSON + dates ISO8601) · `INTEGER` (niveaux autonomie, tokens, index étape). **Pas de BOOLEAN SQLite** : stocké INTEGER 0/1 ou TEXT "draft"/"planned"/"completed".

### 1) TABLE `missions` → LES CARTES MISSION (tu vois ça sur la page `/missions`)
**Source SQL :** [schemas.py:L134-L152](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L134-L152)
```sql
CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    title TEXT NOT NULL,
    user_request TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    autonomy_level INTEGER NOT NULL DEFAULT 0,
    budget_tokens INTEGER NOT NULL DEFAULT 0,
    used_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    error TEXT
);
```
| Colonne | Type | Valeurs possibles / Description |
|---|---|---|
| `id` | TEXT | UUID v4 complet (ex: `0099D08F-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Page missions affiche `mission.id.slice(0, 8)` dans le tooltip ℹ️. |
| `session_id` | TEXT NULL | UUID session WebSocket liée (peut être NULL si mission hors chat). |
| `title` | TEXT | Titre affiché sur la carte Mission (souvent placeholder `M` buggé, fallback sur `user_request` 72 chars). |
| `user_request` | TEXT | TA REQUETE UTILISATEUR VERBATIM ("Donne moi mon dernier mail") |
| `plan` | TEXT | Description Markdown/texte plan générée par `MissionPlanner.plan()` (étapes en langage humain) |
| `status` | TEXT | **Valeurs enum `MissionStatus`** schemas.py:L9-L18 → `draft / planned / pending_approval / running / paused / completed / failed / cancelled` (8 statuts). Badge sur carte MissionCard. |
| `autonomy_level` | INTEGER 0..5 | `0=Humain dans la boucle` → `5=Autonome complet`. Dropdown page formulaire. |
| `budget_tokens` | INTEGER ≥0 | Limite tokens LLM allouée pour cette mission (0 = pas de limite). |
| `used_tokens` | INTEGER ≥0 | Tokens consommés (MAJ après chaque appel LLM). |
| `created_at` | TEXT ISO8601 UTC | Date création `2026-08-26T14:30:00+00:00` |
| `updated_at` | TEXT ISO8601 UTC | Dernière modification (utilisé pour `ORDER BY updated_at DESC LIMIT 50`) |
| `started_at` | TEXT ISO8601 NULL | Date du bouton ▶️ Démarrer (mission.status → `running`) |
| `completed_at` | TEXT ISO8601 NULL | Date du statut `completed` / `failed` / `cancelled`. |
| `error` | TEXT NULL | Chaîne erreur affichée dans bandeau ROSE si `mission.status=failed` (MissionCard.tsx bandeau "Erreur ...") |

---

### 2) TABLE `mission_steps` → LES SOUS-ÉTAPES (bouton "Étapes >" sur la carte)
**Source SQL :** [schemas.py:L153-L172](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L153-L172)
```sql
CREATE TABLE IF NOT EXISTS mission_steps (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tool_name TEXT,
    tool_args TEXT,
    depends_on TEXT,
    expected_output TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    result_json TEXT,
    started_at TEXT,
    finished_at TEXT,
    error TEXT,
    UNIQUE (mission_id, idx),
    FOREIGN KEY(mission_id) REFERENCES missions(id)
);
```
| Colonne | Type | Description |
|---|---|---|
| `id` | TEXT | UUID étape unique |
| `mission_id` | TEXT | FK vers `missions.id` |
| `idx` | INTEGER | Position (1ère étape = idx 0). `UNIQUE(mission_id, idx)` = garantit pas 2 étapes même ordre |
| `title` | TEXT | "Lire mon dernier mail Gmail" |
| `description` | TEXT | Détail long (affiché dans le tooltip MissionStepRow) |
| `tool_name` | TEXT NULL | Nom de l'outil à appeler ("gmail", "calendar", "browser"). Vient de `MissionStep.tool_name: Optional[str]` schemas.py:L49. |
| `tool_args` | TEXT JSON NULL | Arguments outil `{message_id: "...", operation:"get_message"}` → **JSON encodé string** dans SQLite (pas colonne JSON SQLite3 car aiosqlite garde simple TEXT serialisé). |
| `depends_on` | TEXT NULL | Liste entiers séparée virgule `1,3` = doit attendre que `mission_steps.idx=1` et `idx=3` soient finis avant lancer. Schemas.py `MissionStep.depends_on: list[int]` |
| `expected_output` | TEXT NULL | Description LLM résultat attendu. |
| `status` | TEXT | Enum `StepStatus` schemas.py:L21-L28 → `pending / running / skipped / completed / failed / rolled_back` (6 statuts). |
| `result_json` | TEXT JSON NULL | Sérialisation `StepResult` schemas.py:L31-L41 → contient `outputSummary`, `outputDetail`, `toolCalls` utilisés dans le **Bloc RÉSULTAT vert de MissionCard**. |
| `started_at` / `finished_at` | TEXT ISO8601 | Timing 1 étape (pour % progression + performance). |
| `error` | TEXT NULL | Erreur exécution étape (affichée row MissionStep). |

---

### 3) TABLE `mission_events` → JOURNAL TIMELINE DE LA MISSION
**Source SQL :** [schemas.py:L173-L183](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L173-L183)
```sql
CREATE TABLE IF NOT EXISTS mission_events (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    step_id TEXT,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(mission_id) REFERENCES missions(id)
);
```
- `kind`: Valeurs courantes → `"status_changed"`, `"step_started"`, `"step_completed"`, `"tool_call"`, `"llm_request"`, `"error_added"`.
- `payload`: JSON encodé TEXT → ex `{"old_status": "planned", "new_status": "running"}`
- Appelé API via `GET /api/v1/missions/{id}/events` → [lib/api.ts listMissionEvents](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/api.ts#L307-L315).

---

### 4) TABLE `mission_step_idempotency` → DÉDUPLICATION (EMPÊCHE EXÉCUTER 2x LA MÊME ÉTAPE)
**Source SQL :** [schemas.py:L184-L193](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L184-L193)
```sql
CREATE TABLE IF NOT EXISTS mission_step_idempotency (
    mission_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    result_snapshot TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (mission_id, payload_hash)
);
```
- `payload_hash = SHA256(canonical JSON {"tool_name": ..., "tool_args": ...})` → implémenté `state.py:L23-L31 _payload_hash()`.
- But : SI mission crash / retry bouton Récupérer → **on ne ré-exécute PAS 2x un envoi de mail Gmail ou d'un paiement (opérations avec side-effects)**. On renvoie `result_snapshot` sauvegardé.

---

### 5) INDEX SQL (PERFORMANCES) → [schemas.py:L194-L196](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L194-L196)
```sql
CREATE INDEX IF NOT EXISTS idx_missions_session_status ON missions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_mission_steps_mission_idx ON mission_steps(mission_id, idx);
CREATE INDEX IF NOT EXISTS idx_mission_events_mission_kind ON mission_events(mission_id, kind);
```
- `idx_missions_session_status` → Filtres page missions "Filtrer par Session ID + Statut" (boutons "Planifiée/En cours/Terminée")
- `idx_mission_steps_mission_idx` → Chargement rapide `ORDER BY idx` quand on clique "Étapes >"
- `idx_mission_events_mission_kind` → Timeline events, filtre `kind="tool_call"` rapide.

---

## 🔎 TABLES ADDITIONNELLES DANS LE MEME FICHIER (PAS mission/schemas.py MAIS memory/kernel.py)
Ces tables sont aussi DANS `antaerus_memory.db` mais créées par `SCHEMA_STATEMENTS` du fichier : [providers/brain_python/src/antaerus_brain/memory/kernel.py](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py)

| Table | Colonne principale | But |
|---|---|---|
| `chat_sessions` | `session_id TEXT PK` | 1 row = 1 session WebSocket (bouton "Nouvelle session") → `created_at / updated_at / provider`. Appel `GET /api/v1/memory/chat/sessions/{session_id}` pour historique. |
| `chat_messages` | `id TEXT PK, session_id TEXT` | 1 bulle chat. Colonnes `role IN ("user","assistant","system")` + `content TEXT` + `provider TEXT` + `created_at`. Tableau bulle React page `/chat`. |
| `events` (kernel mémoire) | `id TEXT PK` | Timeline kernel mémoire aNtaerus. `session_id TEXT` + `content TEXT` JSON brut événement. |
| `facts` (graph mémoire) | `id TEXT PK` | FAIT sémantique (triplet RDF) : `subject TEXT` + `predicate TEXT` + `object TEXT` + `category TEXT` + `confidence REAL 0..1` + `status TEXT` + `source_event_id FK events.id`. Curateur nocturne → transforme `events` en `facts` structurés. |
| `fact_observations` | `id TEXT PK, fact_id FK` | Observations d'un fait (plusieurs sources). `observation TEXT` + `confidence REAL` + `observed_at TEXT`. |
| `initiative_store` | `id PK` | Missions proactives curateur ("J'ai détecté tu as un rendez-vous demain à 9h, veux tu que je prévienne le contact ?"). |

---

## 📂 MODELES PYTHON (Pydantic) ASSOCIES A CHAQUE TABLE
Synchronisés 1:1 avec les colonnes SQLite. → Fichier : [providers/brain_python/src/antaerus_brain/mission/schemas.py](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py)
- `class Mission (BaseModel)` → [schemas.py:L73-L102](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L73-L102) → 1:1 table `missions`
- `class MissionStep (BaseModel)` → [schemas.py:L44-L71](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L44-L71) → 1:1 table `mission_steps`
- `class StepResult (BaseModel)` → [schemas.py:L31-L41](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L31-L41) → stocké JSON dans colonne `mission_steps.result_json`
- `class ReflexionReport (BaseModel)` → [schemas.py:L118-L127](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L118-L127) → objet bouton 💭 Réfléchir
- `class IdempotencyKey (BaseModel)` → [schemas.py:L111-L115](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/schemas.py#L111-L115) → correspond table `mission_step_idempotency`

---

## 🧪 HOWTO LIRE DIRECTEMENT LA BASE AVEC PYTHON 1 LIGNE
Pour debug rapide (VSC terminal):
```powershell
cd antaerus
python -c "import sqlite3; conn = sqlite3.connect('memory_data/antaerus_memory.db'); print('TABLES='); [print(' - '+r[0]) for r in conn.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;\")]; print(); print('MISSIONS COUNT:', conn.execute('SELECT COUNT(*) FROM missions;').fetchone()[0]); print('STEPS COUNT   :', conn.execute('SELECT COUNT(*) FROM mission_steps;').fetchone()[0]); print(); [print(f'{r[0][:8]}... | {r[1]:12} | {r[2]}') for r in conn.execute('SELECT id,status,title FROM missions ORDER BY created_at DESC LIMIT 5;')]"
```
→ Affiche la liste des tables + 5 dernières missions ID / statut / titre.
