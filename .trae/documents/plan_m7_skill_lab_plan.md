# Plan M7 — Skill Lab (CDC §5.1 4 couches strictes, 0 dépendance nouvelle)

## A. Audit repo pré-M7 (conclusions vérifiées)

### A.1. Contraintes permanentes (invariants)
1. **Architecture CDC §5.1 4 couches ONE-WAY strict** : React Web → Go Gateway `/api/v1/*` → Brain Python → Engine Rust. ZÈRE appel direct React→Brain, ZÈRE Brain→Go inversé.
2. **0 nouvelle dépendance** (stdlib seulement là où c'est possible ; utiliser ce qui existe DÉJÀ dans les manifests) :
   - `web/package.json` → **PAS DE CodeMirror, PAS DE Monaco editor, PAS DE @codemirror/view** (SkillEditor = `<textarea>` custom avec compteurs de lignes + font-mono)
   - `brain_python/pyproject.toml` → **PAS DE docker SDK** (docker_sandbox.py = `subprocess.run(["docker", "run", ...])` stdlib uniquement)
   - `gateway_go/go.mod` → 0 ajout (http stdlib)
   - `engine_rust/Cargo.toml` → **wasmtime DÉJÀ présent** (feature `wasm-runtime`, version 17) ; **wat DÉJÀ en dev-dependency** (version 1). Rien à ajouter.
3. **Dark glassmorphism pixel-perfect** identique M4/M5/M6 : Tailwind classes `rounded-2xl/3xl border border-white/10 bg-slate-950/40`, badges `font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400`, accents cyan/violet/rose/amber.
4. **FR UI strings**, EN code identifiers.

### A.2. Pré-existant M7 (déjà présent dans le repo)
- **Engine Rust** : `engine_rust/src/sandbox/mod.rs` + `sandbox/wasm.rs` (struct `WasmRuntime` avec `execute_i32_export(module_path, export_name)` + fuel limites 10_000). Feature wasm-runtime facultatif déjà défini. Tests `wasm_runtime.rs` existants.
- **Brain Python `approval/`** : `gate.py` + `audit.py` (patterns validation humaine déjà existants pour curator/M5.3 — à réutiliser approve/reject).
- **Brain Python `tools/tool_registry.py`** : registre outils existants (à lier au Skill Registry quand un skill enregistre un tool).
- **Go Gateway `routes.go`** : pattern `NewServeMux` → `apiMux` sub-routers + handlers `ServeHTTP` avec `strings.TrimPrefix` / `switch len(segments)` (pas gorilla/mux). Pattern clients `NewBrain*Client(httpClient, BrainBaseURL, Timeout)` avec `Request(ctx, method, path, in)` exporté.
- **Frontend Zustand slices** : `useAppStore.ts` pattern `setX/setXLoading/setXError` + `persist` (`localStorage`).
- **Frontend api.ts** : patterns `export type Xxx` + `export async function fetchXxx(..) { r=await apiGet(..); return r.json() as Promise<Xxx> }`.
- **4 cartes M6 déjà dans Home.tsx** → ajouter une 5e carte "Skill Lab" → route `/skill-lab`.

### A.3. Mapping 15 cases tasks.md M7 vs modules
- **M7.1 Skill Registry (3)** : `skills/registry.py` + `skills/lifecycle.py` (brain) ; `brain_skills_client.go` + `skills_handler.go` (go gateway) ; `api/skills.py` (brain FastAPI router)
- **M7.2 Skill Lab UI (4)** : `pages/SkillLab.tsx` (onglets Marketplace/Editor/Tester) + `components/SkillEditor.tsx` (textarea custom, 0 dep) + `components/SkillTester.tsx` (bouton Test + sandbox run + JSON output) + `components/SkillMarketplace.tsx` (cards list)
- **M7.3 Sandbox (5)** : `engine_rust/sandbox/wasm.rs` (étendre compile_text_bytes → precompile) + `engine_rust/sandbox/executor.rs` (NEW: orchestrateur timeouts/caps/stdout) + `brain_python/skills/docker_sandbox.py` (subprocess `docker run`) + `brain_python/skills/synthesizer.py` (LLM prompt → code skill) + Workflow React validation humaine approve/reject (extends `approval/gate.py` pattern M5.3)

---

## B. Fichiers & modules à modifier (26 fichiers, 0 nouveau package)

### B.1. Brain Python — M7.1 Registry + M7.3 Synthesizer/Docker (skills/ + api/ + approval/)
```
providers/brain_python/src/antaerus_brain/skills/
  __init__.py                      ← NOUVEAU : types Pydantic SkillRecord/SkillInstallSpec/SkillRunSpec/SkillApprovalRequest
  registry.py                      ← NOUVEAU M7.1 : SQLite skills(id,name,version,description,runtime,installed_at,checksum,status) + list/get/install_status/persist
  lifecycle.py                     ← NOUVEAU M7.1 : install_from_tarball_bytes / install_from_path / update / uninstall (stdlib shutil+tarfile+hashlib, SHA256 checksums)
  synthesizer.py                   ← NOUVEAU M7.3 : generate_skill_from_usage(usage_description, runtime="python"|"wasm") → prompt via litellm existant → code+deps string
  docker_sandbox.py                ← NOUVEAU M7.3 : run_python_in_docker(code:str, timeout_s=30) → subprocess docker run python:3.11-slim -c, network=none, read-only, tmpfs /tmp, cap-drop ALL, capture stdout/stderr + exitcode
providers/brain_python/src/antaerus_brain/api/
  skills.py                        ← NOUVEAU M7.1 : FastAPI router prefix="/skills" 7 endpoints : list GET, detail GET/{id}, install POST, update PUT/{id}, uninstall DELETE/{id}, run POST/{id}/run, approvals POST/{id}/approve POST/{id}/reject
providers/brain_python/src/antaerus_brain/
  app.py                           ← MODIF : 1 ligne `include_router(skills_router)`
providers/brain_python/tests/
  test_skills_registry.py          ← NOUVEAU : install/status/list/uninstall 6 tests
  test_skills_docker_sandbox.py    ← NOUVEAU : skip ci si docker absent, exitcode=42 test, network disabled test
  test_skills_synthesizer.py       ← NOUVEAU : mock litellm, vérifie prompt template
```

### B.2. Go Gateway — M7.1 proxy skills (clients + handlers + routes)
```
interfaces/gateway_go/internal/clients/
  brain_skills_client.go           ← NOUVEAU M7.1 : `NewBrainSkillsClient` + types `SkillRecord/SkillInstallRequest/SkillRunRequest/SkillApproval` + `Request` 7 méthodes
interfaces/gateway_go/internal/http/
  skills_handler.go                ← NOUVEAU M7.1 : `NewSkillsHandlers(cfg, *SkillsClient)` + `ServeHTTP` switch `segments len` 7 routes `/api/v1/skills*`
  routes.go                        ← MODIF M7.1 : 4 lignes (skillsHTTPClient + skillsHandlers + `apiMux.HandleFunc("/api/v1/skills" & "/api/v1/skills/")`)
interfaces/gateway_go/internal/
  clients/brain_skills_client_test.go  ← NOUVEAU : wire test 1 cas + handlers test dans http/skills_handler_test.go
```

### B.3. Engine Rust — M7.3 sandbox WASM (wasm.rs étendu + executor.rs NEW)
```
providers/engine_rust/src/sandbox/
  wasm.rs                          ← MODIF M7.3 : +2 méthodes pub `compile_wat_to_wasm_bytes(wat: &str) -> Result<Vec<u8>, E>` (utilise wat crate dev exist via std wasm32 if need OR runtime feature-gate) ; `run_module_with_args(module_bytes, export_name, args_json) -> Result<RunOutcome, E>` (fuel configurable, 250_000 par défaut)
  mod.rs                           ← MODIF M7.3 : pub use executor::WasmExecutor;
  executor.rs                      ← NOUVEAU M7.3 : orchestrateur `WasmExecutor` → timeout tokio 30s, carburant max, isolation store par invocation, capture stdout via wasmtime `bindgen` ou writes `ansi_term` strings vers `Vec<u8>` (host exports stdout/stderr minimal), `RunOutcome { exit_code, stdout, stderr, fuel_used }`
providers/engine_rust/tests/
  wasm_executor.rs                 ← NOUVEAU : test wat minimal (add 2+3) → RunOutcome fuel_used>0
```

### B.4. React Web — M7.2 Skill Lab UI + M7.3 workflow validation (pages + components + store + api + routes)
```
interfaces/web/src/lib/
  api.ts                           ← MODIF M7 : ~15 types (SkillRecord/SkillInstallSpec/SkillRunRequest/SkillRunResult/SkillApprovalDecision/..) + ~8 fns `listSkills/getSkill/installSkill/updateSkill/uninstallSkill/runSkillInSandbox/approveSkill/rejectSkill`
interfaces/web/src/store/
  useAppStore.ts                   ← MODIF M7 : +slice `skills: SkillRecord[]` / `skillsLoading` / `skillRunOutput` / `pendingApprovals` + setters
interfaces/web/src/pages/
  SkillLab.tsx                     ← NOUVEAU M7.2 : onglets <3> ("Marketplace" | "Editor" | "Tester"), carte identité, boutons refresh, section "Approbations en attente" 2 boutons Approuver/Rejeter
  Home.tsx                         ← MODIF M7 : +5e carte SkillLab /skill-lab (icone BookOpen·emerald)
  App.tsx                          ← MODIF M7 : +route `/skill-lab` + import
interfaces/web/src/components/
  SkillEditor.tsx                  ← NOUVEAU M7.2 : <textarea> monospace 12px, numéros de lignes via colonne gauche fixe div scroll synchro, coloration tokens simple par regex via CSS data-lines (ZÈRE CodeMirror), 2 toggles runtime Python/WASM, bouton "Enregistrer brouillon" → local storage
  SkillTester.tsx                  ← NOUVEAU M7.2 : input JSON args, bouton TEST → runSkillInSandbox, affichage pre stdout/stderr + badges exit_code / duration_ms / fuel_used
  SkillMarketplace.tsx             ← NOUVEAU M7.2 : grille 3 col cards, search input, filtre runtime, bouton Installer/Mettre à jour/Désinstaller
```

---

## C. Étapes d'implémentation (séquentielles 8 sous-étapes)

### Étape 1 — Brain Python `skills/` + types (M7.1 + pré M7.3)
1. Créer dossier `skills/` + `__init__.py` avec types Pydantic alignés à Go/TS :
   - `SkillRuntime = "python" | "wasm"`
   - `SkillRecord { id: str, name: str, version: str, description: str, runtime: SkillRuntime, category: str, installedAt: str, checksum: str, status: "installed" | "pending_approval" | "disabled" }`
   - `SkillInstallRequest { name, version, sourceTarballB64?, sourcePath? }`
   - `SkillRunRequest { skillId, argsJson: str, timeoutMs? }`
   - `SkillRunResult { exitCode, stdout, stderr, durationMs, fuelUsed? }`
2. `registry.py` : SQLite table `skills` (id PRIMARY KEY, columns comme ci-dessus) + méthodes aiosqlite async `list/query/get/status/persist/delete`.
3. `lifecycle.py` : install vérifie SHA256 via `hashlib.sha256(bytes).hexdigest()` ; tarball via `tarfile.open(bytes, mode="r:gz") stdlib` ; update = delete+reinstall ; uninstall = SQL DELETE.

### Étape 2 — Brain Python API skills router + app wire (M7.1)
4. `api/skills.py` : FastAPI `APIRouter(prefix="/skills", tags=["skills"])` :
   - `GET /skills?category=&runtime=` → list
   - `GET /skills/{id}` → detail
   - `POST /skills` → install → status pending_approval par défaut (sauf trusted = skip approval config)
   - `PUT /skills/{id}` → update (pending)
   - `DELETE /skills/{id}` → uninstall
   - `POST /skills/{id}/run` (**via docker_sandbox pour python, ou brain appelle engine via engine_rust client existant pour wasm**) → `SkillRunResult`
   - `POST /skills/{id}/approve` + `POST /skills/{id}/reject` (extends approval/gate.py pattern existant)
5. `app.py` : ligne `from antaerus_brain.api.skills import router as skills_router` + `include_router(skills_router)`.

### Étape 3 — Go Gateway : client + handlers skills (M7.1)
6. `brain_skills_client.go` : types Go alignés Pydantic/TS + `Request(ctx, method, path, in, out)`.
7. `skills_handler.go` : `ServeHTTP(w, r)` → `segments = strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/skills/"), "/")` switch len(segments). writeJSON helper existant. auth via existing `authenticator`? Appelé par mux parent déjà authentifié.
8. `routes.go` : +`skillsHTTPClient` + `NewBrainSkillsClient` + `skillsHandlers` + `apiMux.HandleFunc("/api/v1/skills"` + `/api/v1/skills/")`.

### Étape 4 — Frontend lib/api.ts types + Zustand skills slice (M7.2 base)
9. `api.ts` : +15 types, +8 fonctions `listSkills()`, `getSkill(id)`, `installSkill(req)`, `updateSkill(id, req)`, `uninstallSkill(id)`, `runSkillInSandbox(id, args)`, `approveSkill(id)`, `rejectSkill(id, reason)`.
10. `useAppStore.ts` : `skills / skillsLoading / skillsLastError / skillRunResult / pendingApprovals: SkillRecord[]` + 7 setters. Persist `editorDraft` in localStorage.

### Étape 5 — React Pages SkillLab + Home + App routes (M7.2)
11. `App.tsx` : import + route `<Route path="/skill-lab" element={<SkillLab />} />`.
12. `Home.tsx` : +5e carte "Skill Lab / Marketplace + Editor + Tester" icône `BookOpen` emerald `border-emerald-400/20 bg-emerald-500/5 text-emerald-100`, lien `to="/skill-lab"`.
13. `SkillLab.tsx` layout 3 onglets Marketplace / Editor / Tester + bandeau approbations en attente (buttons approve/reject). Wire useEffect → `listSkills()` + `setSkills()`.

### Étape 6 — React Components M7.2 (3 composants zero-dep)
14. `SkillEditor.tsx` : textarea rows=22 cols=100 font-mono text-[12px] ; colonne gauche line-numbers div (scroll synchronisé via event scroll) ; highlight simple tokens (def/fn/class via background span via JS split("\n").map → data-token). Boutons runtime toggle Python/WASM. Save draft → `localStorage.setItem("skill-editor-draft", v)`.
15. `SkillTester.tsx` : input textarea JSON args, bouton "TEST DANS SANDBOX" → appel `runSkillInSandbox`, affiche pre stdout + pre stderr + badges `exit_code` (0=vert /≠0=rose), `duration_ms`, `fuel_used` WASM.
16. `SkillMarketplace.tsx` : grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`, chaque card `rounded-2xl border border-white/10 bg-slate-950/40 p-4`, tags catégorie/runtime, boutons Installer/Désinstaller/Mettre à jour état disabled si status pending.

### Étape 7 — M7.3 Sandbox WASM Rust + Docker Python + Synthesizer
17. **Rust wasm.rs extend** : `pub fn compile_wat_to_wasm_bytes(wat: &str) -> Result<Vec<u8>, WasmRuntimeError>` (utilise `wat::parse_str(wat).unwrap()` — wat déjà en dev-deps, mais pour prod on embed via une fonctionnalité `wasm-runtime` + feature-gate). `pub fn execute_module_bytes_with_json(..)` — expose `run_result_json`.
18. **Rust executor.rs NEW** : `WasmExecutor::new(settings)` → `pub async fn run(&self, module_bytes: &[u8], export: &str, args: Vec<Val>) -> Result<RunOutcome, ExecError>` (tokio timeout, fuel 250k, default 30s timeout, store indépendant).
19. **Python docker_sandbox.py** : `async def run_python_code(code: str, timeout_s=30, memory_mb=256, network=False) -> SandboxRunResult`. Commande Docker `run --rm --network none --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop=ALL --memory=256m --pids-limit=64 python:3.11-slim python -c <code>` (capture via `asyncio.create_subprocess_exec` — stdlib, 0 pip). Si docker binaire absent → fallback `subprocess` Python local avec `--isolated` + timeout.
20. **Python synthesizer.py** : `async def generate_skill_from_usage(usage: str, preferred_runtime: SkillRuntime) -> GeneratedSkillDraft`. Prompt template : "Générez un module Skill Python/WASM minimal... [contraintes, tests, input output schema]". Appel via `litellm.completion` déjà présent dans brain → retour code + description + tests inline. **PAS DE NOUVELLE API KEY.**
21. **Workflow React validation humaine** : SkillLab.tsx section "Approbations en attente" (cards `status=="pending_approval"`). Boutons `Approuver` → `approveSkill(id)` → setSkillStatusInstalled. Bouton `Rejeter` → ouvre modal motif → `rejectSkill(id, reason)`.

### Étape 8 — Qualimétrie + cocher 15 cases tasks.md
22. Run `cd antaerus/interfaces/web && npm run check` (tsc) + `npm run build` (vite).
23. Run `cd antaerus/interfaces/gateway_go && go build ./... && go test ./internal/clients ./internal/http -count=1 -short`.
24. Run `cd antaerus/providers/brain_python && ruff check src/antaerus_brain/skills src/antaerus_brain/api/skills.py && mypy src/antaerus_brain/skills src/antaerus_brain/api/skills.py --ignore-missing-imports && pytest tests/test_skills_* -q`.
25. Run Rust tests si cargo présent : `cd antaerus/providers/engine_rust && cargo test --features wasm-runtime sandbox:: -- --nocapture 2>&1 | Select-Object -Last 30`.
26. Cocher 15 cases `[x]` tasks.md L447-L463 + écrire section "État actuel (Phase M7 — livrée)" avec liste fichiers + qualimétrie.

---

## D. Dépendances et considérations (0 nouvelle dépendance, risque = faible)

| Ressource | Dépendance | Existant déjà ? | Solution M7 |
|---|---|---|---|
| SkillEditor code editor | CodeMirror / Monaco / Prism | ❌ Non | `<textarea>` + line-numbers div scroll synchro + CSS token light (0 npm) |
| docker_sandbox Python SDK | `docker` PyPI | ❌ Non | `subprocess.run(["docker", "run", ...])` / asyncio stdlib |
| Skill → WASM compile | `wasm-tools` CLI bindgen crate external | ❌ Non CLI | Utiliser `wat` crate (DEV DÉJÀ PRÉSENT Cargo.toml) → `wat::parse_str(wat_src)` → bytes + stocke dans `SkillRecord.checksum=sha256(bytes)` |
| SkillLab React | drag-drop marketplace ui | ❌ Non | Grid simple boutons Installer (pas drag drop) |
| Rust wasm → stdout capture | wasmtime bindgen crate | ✅ wasmtime = déjà optional dep | Host exports minimal "print" via linker → write Vec<u8> → RunOutcome.stdout |

### Considérations architecture
- **Calls React NEVER brain direct** : Tous 8 endpoints skills passent par `/api/v1/skills/*` Go Gateway proxy.
- **Docker sandbox safety** : Toujours `--network none` par défaut, `--read-only`, tmpfs seulement 64 Mo, `--pids-limit=64`, `--memory=256m`, `--cap-drop=ALL`. Si Docker absent → fallback `python -I -S -c` isolé.
- **Skill pending approval** : Compteur `pendingApprovals.length` dans SkillLab header. Modal motif rejet (champ texte obligatoire min 8 caractères).
- **WASM fuel** : Par défaut 250 000 unités (~0.1s CPU), configurable par `SkillRunRequest.fuelLimitMax`.
- **Backward compat** : Zéro modification à endpoints M4/M5/M6 existants. Routes `/api/v1/skills*` + route `/skill-lab` sont des AJOUTS.
- **Bundle M6.3 scripts** : build_bundle.ps1/.sh étapes "install skills from curated_bundle" — pas besoin modification M7 (skills sont téléchargés post-install via marketplace), MAIS si user souhaiterait les embarquer on prévoit une variable `SKILLS_BUNDLE_TGZ_URL` dans manifest.json (optionnel). Non inclus.

---

## E. Risques et traitements

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Docker binaire absent sur host dev | Moyenne | Faible | Fallback `python -I -c` subproc local + warning bandeau "Docker absent, sandbox non isolé" SkillTester badge |
| CodeMirror 0-dep SkillEditor ergonomie limité | Élevée | Faible (acceptable) | Line numbers synchro + tabs auto (2 espaces via keydown Tab intercept event.preventDefault) + Ctrl+S save draft localStorage |
| Rust wasmtime compilation feature pas activée par défaut | Moyenne | Faible | Tous fns wasm.rs ont `#[cfg(feature = "wasm-runtime")]` + fallback `RuntimeNotEnabled` message clair Go/Brain retour HTTP 503 + frontend badge "WASM runtime désactivé côté Engine" |
| SkillRegistry SQLite concurrence write install concurrente | Faible | Faible | `BEGIN IMMEDIATE` transaction aiosqlite + lock `asyncio.Lock()` Python |
| Synthesizer LLM génère code malveillant | Moyenne | Moyenne | Statut `pending_approval` OBLIGATOIRE post-synthèse, jamais installé directement. User doit Approuver → validation humaine |
