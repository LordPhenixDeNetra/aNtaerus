# Plan M5 — Moteur Proactif (tâches M5.1 Collectors, M5.2 Command Center, M5.3 Curator Nocturne

## 0. Recherche repo (Conclusion
- Architecture 4 couches CDC §5.1 : React Web → Go Gateway (/api/v1/*) → Python Brain → Go/Rust Engine. M5 ajoute un sous-module `proactive/` Python, une route gateway `/api/v1/proactive*`, un client Go BrainProactiveClient, et UI React `/command-center`. ZERO CORS bypass.
- Patterns existants exploités :
  - Python FastAPI router `api/*.py prefix + Pydantic BaseModel (missions.py`, `app.py include_router`
  - Python tools patterns `BaseTool` + httpx async (weather.py`, `calendar.py`)
  - Go gateway pattern `internal/clients/brain_*_client.go` doJSON + `internal/http/*_handler.go` ServeHTTP dispatch + wire routes.go
  - Go Hub broadcast buffered 64 + WS ServerMessage type
  - Zustand store `useAppStore.ts` state + setters + merge
  - React composants `pages/*`, `components/*` Tailwind + lucide-react, `lib/api.ts fetch helpers

## 1. Modules et fichiers à créer/modifier

### 1.1 Brain Python (M5.1 + M5.2 + M5.3
Nouveau package `proactive/` sous `antaerus/providers/brain_python/src/antaerus_brain/proactive/` :
- `__init__.py`
- `collectors/__init__.py` : registry des collectors
- `collectors/base.py` : classe abstraite `BaseCollector` + types Pydantic CollectorBriefing / CollectorAlert / CollectorResult
- `collectors/weather.py` : briefing météo via Open-Meteo (httpx async, pas nouvelle dépendance) + alertes température/pluie
- `collectors/news.py` : digest RSS via `xml.etree.ElementTree` + `httpx` (stdlib, pas feedparser)
- `collectors/calendar.py` : rappels Google Calendar prochains 24h via Google OAuth existant
- `collectors/system.py` : alertes CPU (loadavg), disque (shutil.disk_usage), mémoire via stdlib UNIX/Win compat
- `collectors/custom.py` : collecteur générique configurable URL HTTP GET + headers, stockés en config dataclass
- `command_center.py` : module Initiative + InitiativeStore (SQLite memory_db_path partagée) + CRUD initiatives + run_collector / run_all_collectors / apply_initiative
- `curator.py` : Curator nocturne: generate_report (facts incohérents via memory kernel, skills inutilisées via tool_registry, couts estimés), propose_patches, workflow validate patch (humain pour niveau autonomie >=3)
- `scheduler.py` : scheduler AsyncAPScheduler; ticker simple en Go pour M5.3 cron interne — scheduler léger stdlib `asyncio` tasks `datetime + APScheduler.

Router REST brain Python `api/proactive.py` (prefix `/proactive`) reprend le nouveau router:
- `GET /proactive/collectors` : liste collectors enregistrés + statut enabled
- `POST /proactive/collectors/{name}/run` : exécute un collector
- `POST /proactive/collectors/run-all` : exécute tous enabled
- `GET /proactive/initiatives` + `POST /proactive/initiatives`
- `GET /proactive/initiatives/{id}` + `PATCH /proactive/initiatives/{id}`
- `POST /proactive/initiatives/{id}/run`
- `GET /proactive/curator/report` : rapport nocturne dernier
- `POST /proactive/curator/run` : lancement curator
- `POST /proactive/curator/patches/{patch_id}/approve` + `reject` (validation humaine)
- `POST /proactive/scheduler/start` + `stop` + `status` (contrôle cron Go via cervelet HTTP gateway, mais piloté par Python scheduler)

Fichiers Python à modifier :
- `antaerus_brain/config.py` : ajouter settings proactive : `proactive_enabled`, `proactive_schedule_cron`, `proactive_max_initiative_budget`, `curator_cron_expr`, `curator_autonomy_level (0-5)`
- `antaerus_brain/app.py` : `include_router(proactive_router)`
- `.importlinter` : ajouter contrats proactive-no-backrefs + proactive-correct-deps

Tests Python :
- tests/test_proactive_collectors.py (weather, news, calendar stubs httpx AsyncMock)
- tests/test_proactive_command_center.py (CRUD initiative)
- tests/test_proactive_curator.py (génération rapport + patch approve/reject)

### 1.2 Gateway Go (M5.2 handler + client + scheduler cron (M5.3))
Nouveaux fichiers Go `gateway_go/internal/` :
- `clients/brain_proactive_client.go` : client BrainProactiveClient 1:1 endpoints (ListCollectors / RunCollector / RunAllCollectors + ListInitiatives / CreateInitiative / GetInitiative / PatchInitiative / RunInitiative + CuratorReport / CuratorRun / ApprovePatch / RejectPatch)
- `clients/brain_proactive_client_test.go` : httptest tests 9 méthodes + 409 error
- `http/proactive_handler.go` : ProactiveHandlers ServeHTTP dispatch 9 routes REST
- `http/proactive_handler_test.go` : fake brain + tests list/create/run
- `http/proactive_ws.go` : BroadcastInitiativeUpdate broadcast hub.broadcast ServerMessage type "initiative.update" (type message étendu dans contracts)
- `scheduler/cron.go` : CronScheduler struct start/stop/status, jobs (tick `time.NewTicker`, run periodic (30s), triggers curator nocturne à heure configurable, list registered proactive_ws_push initative update broadcast hub
- `scheduler/cron_test.go` : tests ticker next run
- Modifier `internal/contracts/websocket.go` : ajouter types ClientMessageScheduler="scheduler.command" + ServerMessageInitiativeUpdate + InitiativeUpdatePayload
- Modifier `internal/http/routes.go` : wire client proactive + handlers + scheduler cron
- Modifier `internal/system/health.go` : ajouter capabilities "proactive-proxy","proactive-scheduler"
- Modifier `internal/config/config.go` : ajouter ProactiveCronHour (default 02:00 nocturne

### 1.3 React UI M5.2 Command Center
Nouveaux fichiers web `src/` :
- `components/InitiativeCard.tsx (test) : carte initiative titre autonomie(0-5 budget status
- `components/AutonomySlider.tsx (test) : slider 0 paliers 0-5 (manuel→automatique)
- `pages/CommandCenter.tsx (test) : dashboard 4 panels: Collectors chips run/ status → 8-collectors buttons, initiatives paginées, Curator rapport, slider autonomie global
- `hooks/useProactive.ts` + test : Zustand + polling, ws subscription initiative.update
- `lib/api.ts` ajout types + 12 fetch prefix /api/v1/proactive*
- `lib/ws.ts` + InitiativeUpdatePayload étendu
- Modifier `store/useAppStore.ts` : state + setters initiatives + merge
- Modifier `App.tsx` route `/command-center + Home.tsx carte Command Center
- Modifier `pages/Home.tsx` ajouter carte lien vers `/command-center`

## 2. Étapes séquentielles

**Phase 1 — Brain Python proactive package M5.1 Collectors
1. Créer `proactive/__init__.py + collectors/base.py abstraits
2. Implémenter 5 collectors (weather, news, calendar, system, custom)
3. Tests collectors avec stubs httpx

**Phase 2 — Brain Python M5.2 Command Center + M5.3 Curator
4. Créer `command_center.py Initiative/InitiativeStore SQLite schema
5. Créer `curator.py rapport + patches validate
6. Créer `api/proactive.py router 12 endpoints
7. Étendre config.py settings proactive, app.py include_router, .importlinter
8. Tests Python command_center + curator + api proactive

**Phase 3 — Gateway Go M5.2 proactive handler + M5.3 cron scheduler
9. Créer BrainProactiveClient Go client + test
10. Créer ProactiveHandlers HTTP handler + test
11. Étendre websocket contracts InitiativeUpdatePayload
12. Créer scheduler/cron.go Go scheduler nocturne + test
13. Wire routes.go, health.go capabilities proactive, config proactive cron

**Phase 4 — React UI M5.2 Command Center
14. Étendre api.ts types + 12 fetch proactive
15. Créer InitiativeCard.tsx + AutonomySlider.tsx + tests
16. Créer useProactive hook Zustand + store useAppStore state
17. Créer pages/CommandCenter.tsx dashboard
18. Wire App.tsx route, Home.tsx carte, ws.ts merge initiative.update

**Phase 5 — Qualimétrie
19. Go build/test gateway packages
20. npm run check (tsc noEmit)
21. vitest run React tests
22. vite build web
23. ruff / mypy brain Python
24. Mettre à jour tasks.md M5 cases [x] + paragraphes État actuel

## 3. Dépendances & risques
- NOUVELLES dépendances Python PROHIBÉES :
  - news RSS stdlib `xml.etree.ElementTree` au lieu de feedparser
  - system stats `shutil.disk_usage`, `os.getloadavg` (stdlib) au lieu de psutil
  - scheduler async `asyncio` + tasks stdlib au lieu de apscheduler
  - cron simple TZ-naive via `datetime` + `time.Ticker` Go
- Pas de Rust / Mission M5 (pas de nouvelle dépendance dans M4 précédentes)
- Modifications aux contrats websocket : ajouter messages sans casser existants (append au lieu de remplacer)
- SQLite partagée memory_db_path pour InitiativeStore mémoire
- Validation du curator patch autonomie niveau ≥ 3 → workflow manuel required (endpoint approve/reject)

## 4. Risques & garde-fous
- HTTP 424 Failed Dependency sur gateway si Python brain si offline
- Curator nocturne overlap: serrurier lock fichier `.curator_running.lock`)
- Slow clients WS nettoyage non bloquant (même pattern Hub broadcast existant)
- Pas de nouvelle dépendance npm, tout stdlib partout (sauf existants)
- No-ops (weather no network gracefully degradé offline gracefully retour empty list)

## 5. Critères d'acceptation
- go test gateway_go/... 0 FAIL
- go build ./... clean
- ruff + mypy brain_python 0 erreur
- pytest brain_python/test_proactive* verts
- npm run check tsc noEmit 0 erreur
- vitest run tests 0 FAIL inclus nouveaux tests Command Center
- vite build sans erreur bloquante
- tasks.md 5.1 (5 cases), M5.2 (5 cases), M5.3 (4 cases) → 14 cases cochées [x]
