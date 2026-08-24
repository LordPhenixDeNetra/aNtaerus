# Plan M4.2 + M4.3 : Proxy Go Mission + UI React Mission

Source de vérité des cases à cocher dans [tasks.md](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md) lignes 321-330 :

### M4.2 — Go Mission Proxy
- [ ] `gateway/mission_handler.go` : routes REST missions
- [ ] `gateway/mission_proxy.go` : proxy vers Python mission engine
- [ ] `gateway/mission_ws.go` : push WebSocket progression mission

### M4.3 — React Mission UI
- [ ] `pages/Missions.tsx` : liste missions en cours
- [ ] `components/MissionCard.tsx` : carte mission (état, étapes, progression)
- [ ] `components/MissionStep.tsx` : étape individuelle pending/active/done/failed
- [ ] `hooks/useMissions.ts` : gestion missions temps réel

---

## 1. Recherche repo — constat &eacute;tat actuel

### 1.1 Couche Gateway Go (`antaerus/interfaces/gateway_go/`)
- **Routeur HTTP : [routes.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/routes.go#L25-L53) — pattern `apiMux` sous `/api/v1/*` + `withCORS`. Crée `clients.NewBrainChatClient` avec `cfg.BrainBaseURL = "http://localhost:8000"` (par défaut)
- **Configuration : [config.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/config/config.go#L40-L66) — `Config.BrainBaseURL` ; chargement Viper env vars `ANTAERUS_BRAIN_URL`
- **Client HTTP brain : [python_client.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/clients/python_client.go#L53-L65) — `NewBrainClient(baseURL) -> ServiceClient` et helpers génériques `FetchHealth / FetchCapabilities`. Il manque un client pour /missions dédié (à créer)
- **Hub WebSocket : [websocket.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/websocket.go#L19-L69) — struct Hub avec `clients map[*Client]struct{}`. Messages `enqueue(contracts.ServerMessage)` via `serverMessage(ServerMessageMissionUpdate` déjà prévu dans les contrats.
- **Contrats WS Go : [contracts/websocket.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/contracts/websocket.go#L12) — constantes `ClientMessageCancel = "mission.cancel"` et `ServerMessageMissionUpdate = "mission.update"` déjà EXISTANTES avec structure `MissionUpdatePayload {MissionID, Status}` → à étendre avec step progression étapes step_id statut
- **Pattern proxy existant : [voice_proxy.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/voice_proxy.go#L1-L86) — exemple de goroutines proxying vers brain (hub pattern d session; brainChat.StreamSession, forwardVoiceEvent -> enqueue serverMessage

### 1.2 Endpoints brain Python exposés
- `POST /missions` — crée/ `GET /missions` — liste, filter sessionId/status, `GET /missions/{id}` — détail, `POST /missions/{id}/run`, `POST /missions/{id}/recover`, `POST /missions/{id}/reflect`, `GET /missions/{id}/events` (voir [missions.py](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/missions.py))

### 1.3 Couche Web React (`antaerus/interfaces/web/`)
- **Router App.tsx** : [App.tsx](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/App.tsx#L1-L16) — BrowserRouter routes `/`, `/setup`, `/foundation`. Ajouter route `/missions`
- **Store Zustand** : [useAppStore.ts](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/store/useAppStore.ts#L1-L174) — ajouter state mission (mission_list, activeMissionId, actions de base
- **TypeScript API [api.ts](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/api.ts) — fonctions fetch déjà pattern existants (pattern ; typingsServiceHealth,SystemStatus, ChatHistoryMessage, fetchSystemStatus, etc
- **WS type côté client [ws.ts](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/ws.ts#L1-L79) — types `WebSocketServerMessageType` et `MissionUpdatePayload { missionId, status` mission_id, status string,stepId? status? déjà existants ;  → 0x## 2. Modules à créer ou modifier

---

## 2. Liste détaillée des fichiers

### A. Bloc M4.2 — Gateway Go

#### MISSION PROXY Go : fichiers NOUVEAUX
1. **`internal/clients/brain_mission_client.go`** + test **Nouveau fichier : client HTTP dédié vers brain `/missions`
   - Types Go correspondant aux Pydantic Python mission (Mission/MissionStep/MissionStep/StepResult/ReflexionReport
   - Méthodes : `CreateMission`, `ListMissions`, `GetMission`, `RunMission`, `RecoverMission`, `ReflectMission`, `ListMissionEvents` (t (contextctx,req → proxy HTTP simple body &MissionHTTP simple proxy HTTP brain
   - helper private generic helper doJSON marshal JSON request to body, méthode privée: unexportée HTTP Do BrainBaseURL
   - `mission_create → `BrainBaseURL + "/missions" → code BrainBaseURL +"/missions"
2. **`internal/http/mission_handler.go` ** Nouveau fichier
   - Handler HTTP REST `/api/v1/missions* pattern (pattern pattern REST missions POST :
   - routes : POST `/api/v1/missions/{id}` — GET détail
   - `/api/v1/missions/{id}/run → lancer mission
   - `/api/v1/missions/{id}/recover → reprise après crash
   - `/api/v1/missions/{id}/reflect → reflexion
   - `/api/v1/missions/{id}/events → GET events
3.
3. **`internal/http/mission_proxy.go`** Nouveau fichier
   - Fonctions privées `proxy request brain via brain_mission_client.go
   - Pattern de transtypage error, log structured erreur brain → 500/400/404/409 mapping code4.
4. **`internal/http/mission_ws.go`** Nouveau fichier
   - Fonctions sur Hub : `BroadcastMissionUpdate(missionID, status, stepIndex, stepStatus, stepResult?
   - Handler de message client -> enque ServerMessageMissionUpdate pay enrichiPayload étendu à MissionUpdatePayload dans contracts/websocket.go
   - Abonnement clients connectés : broadcast à tous les clients authentifiés du Hub.
5. Modifier** Modifications (petits)** fichiers existants) dans les fichiers existants5 :
   - [contracts/websocket.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/contracts/websocket.go) — étendre `MissionUpdatePayload MissionID, Status, StepIndex *int, StepStatus *string, StepResultJSON string
   - [http/routes.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/routes.go#L25) — ajouter 6 routes REST et fournir `missionClient HTTP mux apiMissionHTTPClient avec Timeout`
   - [http/websocket.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/websocket.go) — ajouter méthode `ProcessMissionCancelPayload` handling dans le dispatch message du client (mission.cancel ws client
   - [system/health.go](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/system/health.go) — ajouter `mission-proxy` capability / vérification capabilities si présent array capabilities brain
6. **Tests unitaires Go** Nouveaux : `internal/http/mission_handler_test.go`, `internal/clients/brain_mission_client_test.go` (httptest.Server mock brain renvoyant JSON tests Fake) et `newFakeMissionTest avec handlers de test de 2xx 6.

---

### B. Bloc M4.3 — React UI Mission

1. **Nouveau composants** NOUVEAUX fichiers
7. `src/types/
   1. `src/pages/Missions.tsx`
      - `/missions` + navigation depuis route App.tsx, import de missions, état page layout  liste des missions filtrer (filter by session/cards
      - Filtres sessionId, statut : filtre statut + état état pagination
      - Bouton créer une mission bouton rafraîchir + Rechargement auto intervalle 10s like FoundationDashboard
   2. `components/MissionCard.tsx` : wrapper carte mission (titre, statut, progression % pourcentage completedSteps, liste steps expand collapse
      - Mini liste MissionStep dans un array, boutons Run / Recover / Reflect bouton état terminal
   3. `components/MissionStep.tsx` : visuel statut visuel : statut step (pending = gris, active = bleu anim pulse, done= vert, failed = rouge
      - Icône étape résultat JSON affichage description tool + tool call stack, 3 points en attente/pending
   4. `hooks/useMissions.ts` : hook React renvoie { missions, loading, error {fetchMissions, runMission(id), recoverMission(id), reflectMission(id), connectWS()
      - Utilise fetch via lib/api.ts fonctions fetch
      - WebSocket subscription via Mission update via lib/ws.ts : `mission.update event via new message listener. Type MissionUpdatePayload

2. **Fichiers EXISTANTS à modifications
   - [`lib/api.ts ajouter types **Nouveau code Typescript :
   - `Mission`, `MissionStep`, `StepResult` `ReflexionReport`, `MissionEventsResponse`, `CreateMissionRequest` `MissionRequest` types
   - fonctions : `createMission(user_request, createMission({ session_id, user_request) POST /api/v1/missions
   - listMissions(params listMissions()
   - getMission(id) getMission(id) GET détail
   - runMission(id) run mission
   - recoverMission(id) run POST recupérer id reprise recover
   - reflectMission(id) reflect
   - listMissionEvents(id) events
   - [store/useAppStore.ts ajouter state list missionsMissionList: Mission[]; current filter filterStatus, selectedMissionId?: string | null; setMissions(missions: Mission[]); addOrUpdateMission(m: Mission); removeMission(missionId: string)
   - App.tsx ajouter Route "/missions" => <Missions /> → routeur
   - Home.tsx ajouter lien bouton lien card vers "/missions" lien dans navbar ? Si absent, ajouter dans FoundationDashboard lien dans page Home 1.

3. **Tests unitaires** NOUVEAUX
   - MissionCard.test.tsx, MissionStep.test.tsx, Missions.test.tsx, useMissions.test.ts (via renderHook, @testing-library/react-hooks, pas @testing-library/react pour React-hooks)

---

## 3. Contraintes & dépendances architecture CDC §5.1
- **Layered architecture strict 4 couches React → Go → Python, pas d'appel direct brain direct HTTP uniquement par Go gateway. Pas de bypass (pas de CORS brain_cors pas autorisée sauf via gateway : React intermediaire autorisée qu'autorisé cross-origin)
  → Donc **TOUS les appel doivent impérativement `/api/v1/missions` sur gateway, PAS brain via React doit utiliser React est appelé brain direct URL `/missions` (localhost:8000
- Aucun emoji composant React ne doit en log/texte texte émojis (conformément user preferences user)
- **Pattern lang UI : tailwindcss, css 400/20 border-radius 32px + bg-slate950 / backdrop-blur. Lucide-react existants icônes Activity / Cpu / Network RefreshCcw FoundationDashboard. Utiliser icones: Lucide Play/Pause/RotateCcw/Search, etc.
- TypeScript types unknown interdit any sauf si obligatoire.

## 4. Risques & mitigation
- **Risque #1** : brain Python brain indisponible pendant appel mission run long HTTP run → Mitigation : Tous les endpoints (run de erreur HTTP 502 Bad Gateway, messages d'erreur "BrainPython unavailable, message "Mission engine indisponible"
  - Mitigation : Go handler code HTTP Go handler Go utilise `context.WithTimeout` sur requête brain avec timeout cfg.RequestTimeout ou cfg.WriteTimeout (existants.
- **Risque #2** : Mission.run > WS broadcast rate clients WebSocket broadcast trop frequent (trop MissionUpdatePayload.
  - Mitigation : Go throttle/Débordement rate broadcast pas de pas broadcast uniquement lors de appels d'événements Go uniquement lors appels events Mission : update step transitions.
- **Risque #3** : Désérialisation types JSON Python types mismatch  différente 422 mismatch.
  - Mitigation : typescript interfaces TS de Go Go struct tags json field struct : string json JSON response mission response dans le strict Mission du brainPython exact champ champ `json:"field1 mission_id / `json:"mission_id", etc. Les deux types Mission → cohérents tests mission_id etc.)
- **Risque #4** : Routes Missions
- Go import cycle de cycle de vie React WebSocket double subscription / désabonnement au unmount cleanup.
  - Mitigation : hook cleanup useEffect cleanup clear interval clear nettoyage addEventListener.removeEventListener.

## 5. Tests & acceptance criteria
### M4.2
1. Go build (`go build ./... clean sans erreur
2. Tests go test $(go list./internal/http/... ./internal/clients/... -count=1`) — 0 FAIL
3. GET /api/v1/health capability mission-proxy présente → mission proxy mission handler mission brain accessible routeur accessible uniquement via api/v1/missions autorisées 4xx 401 si non authentifié
4. fake httptest httptest test mission handler → HTTP handler code 2xx 201/200 status codes, 409 conflict quand mauvais status sur POST /run → 409 quand mission terminée
5. WS dispatch MissionCancelPayload mission cancel WS client type de message →  → WS mission.cancel payload → broadcast ServerMessageMissionUpdate

### M4.3
1. TS check (tsc --noEmit no error 0 erreur TypeScript
2. npm vite build compile sans ESLint build
3. MissionCard /tsx render tests unitaires 80% coverage minimum sur mission
4. React Hook useMissions tests via renderHook : mock fetch WS MissionUpdate.
5. Route "/missions" accessible access via routeur

### End-to-end scénario nominal E2E minimal via Navigateur :
- CREATE mission → POST gateway /api/v1/missions {user_request → HTTP 201 liste Missions.tsx → affichage carte → bouton Run → statut " planned → statut → pending → running → mission update WS step étape 1 → running → completed → bouton Reflect → bouton reflect Reflexion rapport.
→ POST reflect → Reflect → GET Events liste events liste events

## 6. Étapes séquencielles de exécution séquentielle
- **Étape 1** : M4.2.1 : Implémentation de `internal/clients/brain_mission_client.go` + types contracts Go Mission + tests client
- **Étape 2** : M4.2.2 : Implémenter `mission_proxy.go` handlers mission_proxy handlers handlers proxy pattern
- **Étape 3** : M4.2.3 : Implémenter `mission_handler.go` handler REST + Register routes handler REST 6 endpoints
- **Étape 4** : M4.2.4 : Étendre contracts/websocket.go MissionUpdatePayload étendu + mission_ws.go Broadcast WS
- **Étape 5** : M4.2.5 : Modifier routes.go websocket.go routes handler.go, health.
- **Étape 6** : M4.2.6 : Tests Go tests HTTP HTTP httptest
- **Étape 7** : M4.3.1 : Étendre `lib/api.ts` types + fonctions API REST missions
- **Étape 8** : M4.3.2 : Créer MissionStep.tsx composant + test
- **Étape 9** : M4.3.3 : Créer MissionCard.tsx + test
- **Étape 10** : M4.3.4 useMissions hook
- **Étape 11** : M4.3.5 : Missions.tsx page liste
- **Étape 12** : M4.3.6 : Modifs App.tsx, store/useAppStore state missions + home/navbar Home navbar
- **Étape 13** : Qualimétrie finale go build, go test, tsc, vite build lint, lint fix, lint fix.
- **Étape 14** : Mettre à jour tasks.md M4.2 + M4.3 cases cochées [x] + paragraphes "État actuel : M4.2 M4.3"

## 7. Non-régression
- Pas de modification code Rust, Gateway M4.1 (Python (Python déjà livrée intact)
- Pas de 4.0 tests Go Gateway voix M2 voix déjà tests livré, laisser audio/vad/wakeword intacts Go tests voice_proxy voice_session ws, voice routes, non
- React pages Home chat non- voice components react foundation dashboard ne pas modifier
- Tous pas de modification des fichiers existants;
