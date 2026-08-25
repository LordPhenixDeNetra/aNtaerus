[OPEN] — Debug Session: web-ui-runtime-errors
Started: 2026-08-25
Scope: 7 pages localhost:5173 : Home/docs links, Chat(typing/ws/voice), Setup(upload/suivant), Foundation(engine offline), Analytics(empty), SystemHealth(0/0/0), SkillLab(empty)

## Hypothèses falsifiables
H1. Home boutons docs -> React Router catch /docs renvoie 404.
H2. Chat typing invisible: state aiThinking jamais toggle apres send.
H3. Setup Suivant disabled: canContinue step 2 renvoie false (photo requise).
H4. SkillLab vide: useEffect skills() throw avant render (state.skills = []).
H5. Foundation 3/4: endpoint /api/v1/system/health engine_rust field offline sans fix dev-engine.

## Checkpoints runtime evidence
C1. `npm run check exit 0` (pre instrumentation)
C2. Dev servers up: vite 5173, gateway 8080, brain 8000, engine 7000
C3. Navigateur integration: browser_navigate / chat / skill-lab / foundation
