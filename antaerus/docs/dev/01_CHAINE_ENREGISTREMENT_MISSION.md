# CHAINE COMPLETE D'ENREGISTREMENT D'UNE MISSION
> **Source principale :** Réponse utilisateur 26/08/2026 — "D'où sont enregistrés les missions ?"
> **But :** Documenter CHAQUE ÉTAPE, FICHIER EXACT, NUMÉROS DE LIGNE du parcours "Tu cliques 'Créer mission' → Écriture SQL INSERT sur disque".

---

## 🏁 EMPLACEMENT FINAL (fichier disque) :
```
N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\memory_data\antaerus_memory.db
```
- Format : **SQLite** (moteur fichier, 0 serveur, 1 fichier = toutes données + tables + index).
- Outil recommandé pour lire : `DB Browser for SQLite` | `SQLiteStudio` | extension VS Code "SQLite Viewer".
- Variable d'environnement override possible (fichier [antaerus/.env](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/.env)) :
  ```dotenv
  ANTAERUS_BRAIN_MEMORY_DB_PATH=N:/chemin/custom/ma_base.sqlite3
  ```

---

## 🔗 CHAINE END-TO-END (6 étapes, fichiers + lignes exactes)

### ÉTAPE 1 — CLIQUE BOUTON FORMULAIRE (React)
**Description :** L'utilisateur remplit "Nouvelle Mission" colonne gauche (Requête utilisateur / Niveau autonomie ...) et clique sur bouton violet **🚀 CRÉER MISSION**
- **Fichier UI React (page Missions):** [interfaces/web/src/pages/Missions.tsx](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/pages/Missions.tsx#L77-L84) (handleSubmit `onSubmit`)
- **Fichier Hook (logique create/update missions):** [interfaces/web/src/hooks/useMissions.ts](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/hooks/useMissions.ts#L70-L87) → fonction `async create(request)`

---

### ÉTAPE 2 — ENVOI HTTP POST (lib/api.ts)
**Description :** `fetch()` transmet JSON au Gateway Go
- **Fichier client API HTTP TypeScript:** [interfaces/web/src/lib/api.ts:L218-L231](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/api.ts#L218-L231)
  ```ts
  export async function createMission(request: CreateMissionRequest): Promise<Mission> {
    const response = await fetch(apiURL("/api/v1/missions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    ...
    return response.json() as Promise<Mission>;
  }
  ```
- **Fichier Gateway Go (proxy /api/v1/* vers Brain Python FastAPI):**
  - Routes : [interfaces/gateway_go/internal/http/routes.go](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/routes.go) (montage groupe `/api/v1/missions...`)
  - Handler HTTP missions + client gRPC/HTTP Brain : [interfaces/gateway_go/internal/http/mission_handler.go](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/mission_handler.go)
  - Client Go dédié Brain missions : [interfaces/gateway_go/internal/clients/brain_mission_client.go](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/clients/brain_mission_client.go)

---

### ÉTAPE 3 — BRAIN PYTHON FASTAPI RECOIT + PLANIFIE (MissionPlanner)
**Description :** FastAPI valide le body pydantic, initialise le store, demande à MissionPlanner de découper user_request en `Mission + steps[]`.
- **Fichier API REST (Brain Python FastAPI):** [providers/brain_python/src/antaerus_brain/api/missions.py](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/missions.py)
  - Endpoint `POST /missions` status_code=201 → [api/missions.py:L94-L108](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/missions.py#L94-L108)
  - Factory orchestrateur + planner : [_create_orchestrator()](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/missions.py#L47-L91)
  - Construction du MissionStateStore singleton : [_state_store()](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/missions.py#L42-L45) → `MissionStateStore(settings.memory_db_path)`.

- **MissionPlanner.plan() → génère Mission + steps:**
  - Appelé ligne 102-107.
  - Fichier implémentation : [providers/brain_python/src/antaerus_brain/mission/engine.py](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/engine.py) (MissionPlanner)

---

### ÉTAPE 4 — MISSIONSTATESTORE.CREATE_MISSION → INSERT SQL (1 transaction)
**Description :** CECI EST LA LIGNE QUI ÉCRIT VRAIMENT SUR LE DISQUE.
- **Fichier CORE storage (SQL):** [providers/brain_python/src/antaerus_brain/mission/state.py](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/state.py#L34-L77)
- **Initialize (crée tables SI PAS EXISTENT):** [state.py:L38-L43](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/state.py#L38-L43) (parcourt `MISSION_SCHEMA_STATEMENTS` de schemas.py)
- **INSERT MISSION (SQL) + BOUCLE STEPS:** [state.py:L45-L77](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/state.py#L45-L77)
  ```python
  async def create_mission(self, mission: Mission) -> Mission:
      now = _utcnow()
      row = (mission.id, mission.session_id, mission.title, ..., mission.error)
      async with aiosqlite.connect(self.database_path) as conn:
          await conn.execute(
              """
              INSERT INTO missions (
                  id, session_id, title, user_request, plan, status,
                  autonomy_level, budget_tokens, used_tokens,
                  created_at, updated_at, started_at, completed_at, error
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              """,
              row,
          )
          for step in mission.steps:
              await self._upsert_step(conn, mission.id, step, commit=False)
          await conn.commit()   # <--- ECRITURE SUR DISQUE
      return await self.get_mission(mission.id)
  ```

---

### ÉTAPE 5 — CALCUL DU CHEMIN DU FICHIER DB (config.py)
**Description :** Chemin calculé 1x au démarrage FastAPI.
- **Fichier Config + defaults:** [providers/brain_python/src/antaerus_brain/config.py](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py)
  - Default path : [config.py:L80-L81](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py#L80-L81)
    ```python
    def _default_memory_db_path() -> Path:
        return _project_root() / "memory_data" / "antaerus_memory.db"
    ```
  - Env override : [config.py:L132-L135](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py#L132-L135)
    ```python
    memory_db_path = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(_default_memory_db_path())),
        _default_memory_db_path(),
    )
    ```

---

### ÉTAPE 6 — RAFRAICHISSEMENT PAGE (comment les cartes apparaissent colonne droite)
2 mécanismes pour afficher les cartes après création (0 besoin de F5):
1. **Polling AUTO toutes les 10 s** → [useMissions.ts:L16](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/hooks/useMissions.ts#L16) `POLLING_INTERVAL_MS = 10000`
2. **WebSocket push temps réel** → type message `mission.update` → merge dans Zustand store `mergeMissionUpdate()`
3. **SQL correspondant côté Brain:** [state.py:L89-L114](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/state.py#L89-L114)
   ```python
   SELECT * FROM missions WHERE 1=1 [AND session_id=?] [AND status=?]
   ORDER BY updated_at DESC LIMIT ?;
   ```
   + `_load_steps()` pour chaque mission (étapes associées).

---

## 🚮 HOWTO RESET COMPLET (supprimer missions+chat+mémoire)
```powershell
# Fermer d'abord dev-brain.ps1 (process python Brain)
cd "N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus"
Stop-Process -Name python -Force -ErrorAction SilentlyContinue

# Supprime le fichier SQLite + WAL/SHM (SQLite journaling)
Remove-Item -Force memory_data\antaerus_memory.db -ErrorAction SilentlyContinue
Remove-Item -Force memory_data\antaerus_memory.db-shm -ErrorAction SilentlyContinue
Remove-Item -Force memory_data\antaerus_memory.db-wal -ErrorAction SilentlyContinue

# Relance dev-brain.ps1 / dev-all.ps1 → fichier vide avec tables recréées.
```
