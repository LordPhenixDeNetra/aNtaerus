[CLOSED] — Debug Session: web-ui-runtime-errors
Started: 2026-08-25
Closed: 2026-08-25T18:45Z
Scope: 7 pages localhost:5173 : Home/docs links, Chat(typing/ws/voice), Setup(upload/suivant), Foundation(engine offline), Analytics(empty), SystemHealth(0/0/0), SkillLab(empty)
Verdict: 6/6 tests E2E INTERACTIFS VERT + 3 endpoints health 200 + qualim tsc/build exit 0.

## Hypothèses falsifiées et validées
| ID  | Hypothèse | Statut | Preuve |
|---|---|---|---|
| H1  | Home boutons docs React Router catch /docs 404 | CONFIRMEE puis FIXEE | window.open("/docs/index.html","_blank") — snapshot docs 426 nodes sidebar 12 sections OK |
| H2  | Chat typing invisible state aiThinking | CONFIRMEE puis FIXEE | bulle 3 bounce dots violet + "aNtaerus ecrit une reponse..." affichée apres send ; disparue apres reponse LLM recue |
| H3  | Setup Suivant step2 disabled car photo requise | CONFIRMEE puis FIXEE | canContinue step 1 = true tjrs, photo optionnelle ; Suivant actif sans upload |
| H4  | SkillLab vide Zustand destruct selector → infinite loop | CONFIRMEE puis FIXEE | 14 scalaires useAppStore(s=>s.champ) ; npm run check exit 0 ; runtime 48 nodes + install demo OK |
| H5  | Foundation 3/4 engine offline car dev-engine.ps1 throw libclang | CONFIRMEE puis FIXEE | Write-Warning sans throw + cargo run default features core ; 4/4 HEALTHY ports 5173/8080/8000/7000 curl 200 |
| + | Analytics vide + TypeError undefined.toLocaleString | 3 bugs CONFIRMES + FIXES | scalaires + normalisation series snake↔camel + fallback ?? 0 KPI ; KPI P95=312ms + Messages=1 + 3 MetricsChart ×24p |
| + | System-health 0/0/0 heartbeat vide au demarrage | CONFIRME + FIXE | FALLBACK_SERVICES 4 statiques ; degraded 4 cartes visibles |

## Matrice de traçabilité TESTS E2E (6 items prioritaires)
| # | Test E2E | Résultat | Preuve snapshot |
|---|---|---|---|
| 1 | Chat envoyer Bonjour → bulle typing → stream reponse LLM → assistant final | ✅ PASS | reponse LLM: "Bonjour ! Je suis aNtaerus, un assistant IA open source..." |
| 2 | Chat WebSocket connecter + JWT + session heartbeats WS=4 | ✅ PASS | texte "Mode ws Session 1779a83e Connexion connected" |
| 3 | Skill Lab installer demo echo-json → registre 1/1 → carte installed + bouton Desinstaller | ✅ PASS | registre 1/1, carte echo-json v0.1.0 python installed, bouton "Déjà présent" disabled |
| 4 | Skill Lab onglet Tester args {"ping":1} → TEST DANS SANDBOX → docker exit 0 + stdout JSON | ✅ PASS | "exit 0 1333 ms docker" stdout {"ok":true,"echo":{},"now":"2026-08-25T18:42:04Z"} |
| 5 | Setup step2 upload photo jpg fictif → img preview affichee + bouton Retirer photo | ✅ PASS | dispatch change Event via canvas JPEG 1x1 → <img Reference> visible + bouton "Retirer la photo" e23 |
| 6 | Analytics bouton Actualiser → "Chargement des métriques..." → fin → KPI mis a jour + 3 MetricsChart 24 points | ✅ PASS | KPI P95 312ms Messages=1 ; axes ticks X heures 18:43 / 02:43 / 10:43 ; latencyMs 24p |

## Qualimétrie finale
- [x] npm run check (tsc -b --noEmit) → exit 0
- [x] npm run build (tsc -b && vite build) → exit 0 (1985 modules, dist 1036 kB)
- [x] curl localhost:5173/health 200 (web vite)
- [x] curl localhost:8080/health 200 (gateway go)
- [x] curl localhost:8000/health 200 (brain python)
- [x] curl localhost:7000/health 200 (engine rust)
- [x] gateway /api/v1/skills POST echo-json-test HTTP 201 → skill stored id=2b856e3a
