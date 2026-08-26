# CHAINE COMPLETE D'ENREGISTREMENT D'UNE MISSION
> **Source principale :** Réponse utilisateur 26/08/2026 — "D'où sont enregistrés les missions ?"
> **But :** Documenter CHAQUE ÉTAPE, FICHIER EXACT, NUMÉROS DE LIGNE du parcours "Tu cliques 'Créer mission' → Écriture SQL INSERT sur disque".
> **Convention chemins PORTABLES (multi-utilisateurs / Linux / macOS):**
> - `$ANTAERUS_MONOREPO` = la racine WORKSPACE Git (le dossier parent qui contient le dossier `antaerus/`)
>   - Exemple Windows: `N:\Utilisateurs\toi\Projets\aNtaerus`
>   - Exemple macOS/Linux: `/home/toi/Projets/aNtaerus`
> - Tous les chemins listés ci-dessous sont **relatifs à `$ANTAERUS_MONOREPO`** (commencent par `antaerus/...`)
> - **Lien markdown cliquable** : remplace `antaerus/chemin/fichier.ext` par
>   `file:///CHEMIN_ABSOLU_VERS_$ANTAERUS_MONOREPO/antaerus/chemin/fichier.ext`
>   (plus de chemin hardcodé OneDrive / utilisateur spécifique).

---

## 🏁 EMPLACEMENT FINAL (fichier disque) :
```
$ANTAERUS_MONOREPO/antaerus/memory_data/antaerus_memory.db
```
- Format : **SQLite** (moteur fichier, 0 serveur, 1 fichier = toutes données + tables + index).
- Outil recommandé pour lire : `DB Browser for SQLite` | `SQLiteStudio` | extension VS Code "SQLite Viewer".
- Variable d'environnement override possible (fichier `antaerus/.env`) :
  ```dotenv
  ANTAERUS_BRAIN_MEMORY_DB_PATH=/chemin/absolu/custom/ma_base.sqlite3
  ```

---

## 🔗 CHAINE END-TO-END (6 étapes, fichiers + lignes exactes)

### ÉTAPE 1 — CLIQUE BOUTON FORMULAIRE (React)
**Description :** L'utilisateur remplit "Nouvelle Mission" colonne gauche (Requête utilisateur / Niveau autonomie ...) et clique sur bouton violet **🚀 CRÉER MISSION**
- **Fichier UI React (page Missions):** `antaerus/interfaces/web/src/pages/Missions.tsx` (handleSubmit `onSubmit`, lignes ~77-84)
- **Fichier Hook (logique create/update missions):** `antaerus/interfaces/web/src/hooks/useMissions.ts` → fonction `async create(request)` (lignes ~70-87)

---

### ÉTAPE 2 — ENVOI HTTP POST (lib/api.ts)
**Description :** `fetch()` transmet JSON au Gateway Go
- **Fichier client API HTTP TypeScript:** `antaerus/interfaces/web/src/lib/api.ts` (lignes ~218-231)
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
  - Routes : `antaerus/interfaces/gateway_go/internal/http/routes.go` (montage groupe `/api/v1/missions...`)
  - Handler HTTP missions + client gRPC/HTTP Brain : `antaerus/interfaces/gateway_go/internal/http/mission_handler.go`
  - Client Go dédié Brain missions : `antaerus/interfaces/gateway_go/internal/clients/brain_mission_client.go`

---

### ÉTAPE 3 — BRAIN PYTHON FASTAPI RECOIT + PLANIFIE (MissionPlanner)
**Description :** FastAPI valide le body pydantic, initialise le store, demande à MissionPlanner de découper user_request en `Mission + steps[]`.
- **Fichier API REST (Brain Python FastAPI):** `antaerus/providers/brain_python/src/antaerus_brain/api/missions.py`
  - Endpoint `POST /missions` status_code=201 → (lignes ~94-108)
  - Factory orchestrateur + planner : `_create_orchestrator()` (lignes ~47-91)
  - Construction du MissionStateStore singleton : `_state_store()` (lignes ~42-45) → `MissionStateStore(settings.memory_db_path)`.

- **MissionPlanner.plan() → génère Mission + steps:**
  - Appelé dans les lignes ~102-107.
  - Fichier implémentation : `antaerus/providers/brain_python/src/antaerus_brain/mission/engine.py` (MissionPlanner)

---

### ÉTAPE 4 — MISSIONSTATESTORE.CREATE_MISSION → INSERT SQL (1 transaction)
**Description :** CECI EST LA LIGNE QUI ÉCRIT VRAIMENT SUR LE DISQUE.
- **Fichier CORE storage (SQL):** `antaerus/providers/brain_python/src/antaerus_brain/mission/state.py` (lignes ~34-77)
- **Initialize (crée tables SI PAS EXISTENT):** `state.py` (lignes ~38-43) (parcourt `MISSION_SCHEMA_STATEMENTS` de schemas.py)
- **INSERT MISSION (SQL) + BOUCLE STEPS:** `state.py` (lignes ~45-77)
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
- **Fichier Config + defaults:** `antaerus/providers/brain_python/src/antaerus_brain/config.py`
  - Default path (lignes ~80-81):
    ```python
    def _default_memory_db_path() -> Path:
        return _project_root() / "memory_data" / "antaerus_memory.db"
    ```
    > ℹ️ `_project_root()` = la fonction qui calcule `$ANTAERUS_MONOREPO/antaerus` (remonte `parents[4]` à partir du `config.py` lui-même). Fonctionne **quel que soit l'utilisateur** car pas de chemin hardcodé !
  - Env override (lignes ~132-135):
    ```python
    memory_db_path = _resolve_project_path(
        getenv("ANTAERUS_BRAIN_MEMORY_DB_PATH", str(_default_memory_db_path())),
        _default_memory_db_path(),
    )
    ```

---

### ÉTAPE 6 — RAFRAICHISSEMENT PAGE (comment les cartes apparaissent colonne droite)
2 mécanismes pour afficher les cartes après création (0 besoin de F5):
1. **Polling AUTO toutes les 10 s** → `antaerus/interfaces/web/src/hooks/useMissions.ts` ligne ~16 `POLLING_INTERVAL_MS = 10000`
2. **WebSocket push temps réel** → type message `mission.update` → merge dans Zustand store `mergeMissionUpdate()`
3. **SQL correspondant côté Brain:** `antaerus/providers/brain_python/src/antaerus_brain/mission/state.py` (lignes ~89-114)
   ```python
   SELECT * FROM missions WHERE 1=1 [AND session_id=?] [AND status=?]
   ORDER BY updated_at DESC LIMIT ?;
   ```
   + `_load_steps()` pour chaque mission (étapes associées).

---

## 🚮 HOWTO RESET COMPLET (supprimer missions+chat+mémoire)
```powershell
# === PowerShell / Windows ===
# 1. Fermer d'abord dev-brain.ps1 (process python Brain)
Set-Location "$ANTAERUS_MONOREPO\antaerus"   # <--- Remplace $ANTAERUS_MONOREPO
Stop-Process -Name python -Force -ErrorAction SilentlyContinue

# 2. Supprime le fichier SQLite + WAL/SHM (SQLite journaling)
Remove-Item -Force memory_data\antaerus_memory.db -ErrorAction SilentlyContinue
Remove-Item -Force memory_data\antaerus_memory.db-shm -ErrorAction SilentlyContinue
Remove-Item -Force memory_data\antaerus_memory.db-wal -ErrorAction SilentlyContinue

# 3. Relance dev-brain.ps1 / dev-all.ps1 → fichier vide avec tables recréées.
```
```bash
# === Bash / macOS / Linux ===
cd "$ANTAERUS_MONOREPO/antaerus"
pkill -f "antaerus_brain" -9 2>/dev/null || true
rm -f memory_data/antaerus_memory.db memory_data/antaerus_memory.db-shm memory_data/antaerus_memory.db-wal
# Relancer ./scripts/dev-brain.sh / ./scripts/dev-all.sh
```

