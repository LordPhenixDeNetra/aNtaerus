# 🐛 RAPPORT DES BUGS ENCOURANTS - aNtaerus - 26/08/2026

**Auteur:** Debug TRAE session voix  
**Fichiers logs permanents associés:** `N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\crache.txt`  
**Dossier projet:** `antaerus/`

---

## TABLE DES MATIÈRES

| # | Bug | Priorité | Statut |
|---|---|---|---|
| 1 | **Voice Engine Rust: features voice/voice_stt compile-time = FALSE (cfg(voice|voice_stt)=FALSE)** | 🔴 CRITIQUE (bloquant bouton micro) | ⚠️ ACTIF — corrigé code-wise SANS rebuild runtime |
| 2 | **Voice Engine Rust + Gateway Go + Frontend VoiceButton: AlreadyExists session already exists (clic micro x2)** | 🔴 HAUTE (erreur UI cascade) | ✅ Corrigé code-wise — PAS runtime testé SANS rebuild |
| 3 | **Piper1-rs TTS (synthèse vocale audio) build C++ MSVC échoue systématiquement Windows** | 🟡 MOYENNE (STT micro fonctionne sans ça) | ⚠️ Workaround STT-only actif (feature `piper_tts` séparée, pas build) |
| 4 | **DSML format `< | | DSML | | tool_calls...>` brut affiché dans bulle assistant Gmail** | 🟡 MOYENNE (réponses illisibles outils) | ⏸️ MISE EN PAUSE USER ("laissons ça pour le moment") |
| 5 | **ParseError dev-engine.ps1 `UnexpectedToken } else { L500`** | 🟠 BASSE (corrigé encoding/ASCII 7bit) | ✅ Corrigé, parser syntax PowerShell = OK |
| 6 | **Build whisper-rs-sys/silero-sys/cpal casse cascade (avant fixes LLVM/CMake/MSBuild)** | 🟠 BASSE (corrigé code + tooling) | ✅ Workarounds actifs (fake git, CARGO_TARGET_DIR court, ACL, LLVM18 Downgrade) |

---

---

## 🔴 #1 — VOICE ENGINE RUST: FEATURES VOICE/VOICE_STT = FALSE (cfg(voice|voice_stt)=FALSE)

> **STATUT:** ⚠️ ACTIF. Code corrigé dans les fichiers MAIS `C:\b\er\debug\engine_rust.exe` binaire ACTUELLEMENT LANCÉ est un VIEUX build SANS AUCUNE FEATURE (cf. diagnostic UI).

### Symptôme exact UI (copié depuis screenshot):
```
⚠️ [DIAG voice-feature-disabled-bug v2 / server.rs:L93] cfg(voice|voice_stt)=FALSE. 
Build cargo n'a AUCUNE feature STT active. Features compile-time:
  feature voice ......... false
  feature voice_stt ..... false
  feature piper_tts ..... false
  feature wasm-runtime .. false
RAPPEL Cargo.toml reorganise: features voice = STT micro; voice_stt = alias STT; piper_tts = TTS optionnel.
SOLUTION 1 SEUL COMMANDE POUR DEBUG: cd N:\...\antaerus\scripts; .\stop-all.ps1; Remove-Item -Recurse -Force C:\b\er; Set-Location ..\providers\engine_rust; cargo run --features voice
```

### Cause racine EXACTE (3 sous-causes):
1. **Variable `$voiceFeatureEnabled` forcée `$false`**: script [scripts/dev-engine.ps1:L128-L177](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/dev-engine.ps1#L128-L177) `Initialize-EngineBuildEnvironment` — SI `libclang.dll` LLVM 18 introuvable dans `.env` ou Program Files → `$VoiceEnabledRef.Value = $false` → build `cargo run` SANS `--features voice`.
2. **Ancien binaire `C:\b\er\debug\engine_rust.exe` non supprimé**: dev-engine.ps1 ne supprimait pas systématiquement `C:\b\er` quand `Cargo.toml` / `src/*.rs` changent. Processus `engine_rust.exe` maintient souvent un lock sur ce dossier → `Remove-Item -Recurse -Force` échoue silencieusement ou partiellement → ancien binaire avec `feature voice=false` toujours lancé.
3. **Cargo.lock STALE**: ancien `Cargo.lock` résout whisper-rs v0.14 plutôt que v0.15 demandé dans `Cargo.toml`.

### Correctifs DÉJÀ APPLIQUÉS (code, PAS rebuild runtime):
| Fichier modifié | Correctif | Lignes |
|---|---|---|
| [providers/engine_rust/Cargo.toml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/Cargo.toml) | Features reorganise: `voice` = STT micro (cpal/silero/whisper); `voice_stt` = alias voice; `piper_tts` = feature séparée optionnelle TTS | 6-21 |
| [scripts/dev-engine.ps1](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/dev-engine.ps1) | Plus JAMAIS `$VoiceEnabledRef.Value = $false`. Force `$voiceFeatureEnabled = $true` FINAL. Build DIRECT `cargo run --features voice`; fallback CORE avec bannière rouge checklist | 128-503 |
| [scripts/dev-engine.ps1](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/dev-engine.ps1) | (X0) Auto-suppression Cargo.lock SI `Cargo.toml` ou `src/*.rs` changés; (X1) Check mtime Cargo.toml + 25 fichiers .rs récents → Remove-Item `C:\b\er` + ACL Everyone FullControl. Si ÉCHEC suppression hold par process: `exit 1` avec message clair. | 240-320 |
| Tous fichiers audio Rust (capture/stt/vad/bootstrap/server.rs) | 23 occurrences `cfg(feature = "voice")` → `cfg(any(feature = "voice", feature = "voice_stt"))` → compat ascendante builds voice_stt. | cf. Grep: `providers/engine_rust/src/audio/*, providers/engine_rust/src/bootstrap.rs, providers/engine_rust/src/protocol/server.rs` |
| [providers/engine_rust/src/audio/tts.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/audio/tts.rs) + [server.rs `Speak()`](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/protocol/server.rs) | `piper1-rs` gated par `cfg(feature = "piper_tts")` SEULEMENT (plus build par défaut dans voice) | tts.rs L1-L80; server.rs L332-L340 |

### Comment VALIDER que #1 est résolu (PAS ENCORE FAIT):
1. Lancer PowerShell NEUF.
2. Exécuter:
   ```powershell
   cd N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\scripts
   .\stop-all.ps1; Start-Sleep -Seconds 5; Get-Process engine_rust,gateway,python,node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force "C:\b\er" -ErrorAction SilentlyContinue; Remove-Item -Recurse -Force "$env:ProgramData\antaerus" -ErrorAction SilentlyContinue
   .\dev-all.ps1
   ```
3. Dans la fenêtre Engine Rust: vérifier la **TODA (tout en haut)** Bannière ASCII `Features ACTIVEES ce build: voice (STT micro→texte: cpal+silero+whisper)`. SI on voit ça → #1 SOLUTIONNÉ.
4. UI http://localhost:5173/chat → clic micro: SI PAS de bannière `[DIAG ... cfg(voice|voice_stt)=FALSE]` → #1 SOLUTIONNÉ.

---

---

## 🔴 #2 — ALREADYEXISTS SESSION ALREADY EXISTS (clic micro x2)

> **STATUT:** ✅ Code corrigé 3 couches. Reste à valider runtime APRÈS #1 résolu (besoin nouveau engine + nouveau gateway.exe builds).

### Symptôme UI précédent (capture utilisateur):
```
Voice runtime stream failed: rpc error: code = AlreadyExists desc = session already exists
```
**Déclencheur:** Clic bouton Démarrer la voix → Stop → Redémarrer rapidement OU double-clic rapide sur micro.

### Cause racine 3 couches:
1. **Engine Rust [protocol/server.rs:L272-L298](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/protocol/server.rs#L272-L298)**: code avant: `if sessions.contains_key(&id) { return Err(AlreadyExists(...)) }` — pas d'upsert.
2. **Gateway Go [internal/http/voice_session.go:L99-L172](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/voice_session.go#L99-L172)**: avant: si session existait → `return nil` sans cleanup; si erreur AlreadyExists Rust → propagé. Concurrent `setVoiceSession` race condition.
3. **Frontend VoiceButton React**: `onClick` direct `onPrimaryAction()` Promise SANS état busy → double-clic rapide = 2 requêtes `voice.start` WS = 2e AlreadyExists.

### Correctifs DÉJÀ APPLIQUÉS (code, PAS rebuild runtime):
| Couche | Fichier | Correctif |
|---|---|---|
| Rust Engine | [protocol/server.rs:L272-L298](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/protocol/server.rs#L272-L298) | UPSERT: SI session exist → `stop_sender_old.send(())` kill ancienne capture → remove key → insert nouveau stop_sender. JAMAIS AlreadyExists. |
| Gateway Go | [voice_session.go:L99-L172](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/voice_session.go#L99-L172) | (A) existing session Go: `closeVoiceSession()` + 250ms. (B) Rust AlreadyExists détecté → `StopVoiceSession gRPC` Rust + 500ms → retry Start 1x. (C) Concurrent race setVoiceSession: delete stale → replace PUIS return. |
| Gateway Rebuild Auto | [scripts/run-gateway-bin.ps1:L34-L47](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/run-gateway-bin.ps1#L34-L47) | Rebuild `go build -o bin/gateway.exe ./cmd/gateway` OBLIGATOIRE AVANT lancement → prend toujours dernier voice_session.go. |
| Frontend VoiceButton | [interfaces/web/src/components/VoiceButton.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/components/VoiceButton.tsx) | `useState primaryBusy / bargeInBusy`. Button `disabled={disabled || busy}`. `await onPrimaryAction()` puis `finally { setTimeout(() => setBusy(false), 120ms) }`. → anti double-clic. |

### Comment VALIDER #2 résolu (après #1 OK):
1. http://localhost:5173/chat → Connected.
2. **Clic 1 micro 🎙**: listening vert icône ⏹ → PAS AlreadyExists.
3. **Clic 2 micro**: Stop, idle.
4. **Clic 3 micro**: Repasse listening clean, AUCUNE bannière AlreadyExists (rouge ou autre).
5. Double-clic RAPIDE 2x sur micro → bouton disabled visuellement pendant Promise → AUCUNE double requête.

---

---

## 🟡 #3 — PIPER1-RS TTS BUILD C++ ÉCHOUE WINDOWS (MSVC UNICODE + ONNX 1.25 API BREAK)

> **STATUT:** ⚠️ Workaround STT-only ACTIF. STT micro transcription MARCHE (si #1 OK). TTS audio piper DÉSACTIVÉ (build plante trop).

### Symptômes build (extraits anciens crache.txt):
- `error C2440: '<function-style-cast>': cannot convert from 'const char *' to 'const wchar_t *'` (ORTCHAR_T UNICODE MSVC).
- `error C2039: 'GetOutputNames': is not a member of 'Ort::Session'` (ONNX Runtime 1.25 breaking API → Ort::Session constructor now requires `Ort::Model` wrapper; GetOutputNames removed).
- `E0080 whisper-rs-sys attempt compute 1_usize - 296_usize overflow` (LLVM 22.1.8 struct opaque).

### Workaround actuels (PAS DE VRAI FIX PIPER MAINTENANT):
| Fichier | Correctif contournement |
|---|---|
| [providers/engine_rust/Cargo.toml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/Cargo.toml) | Feature `piper_tts = ["dep:piper1-rs"]` est OPTIONNELLE. Build `--features voice` ne compile PAS piper. |
| [providers/engine_rust/src/audio/tts.rs](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/audio/tts.rs) | `use piper1_rs::Piper` gated par `#[cfg(feature = "piper_tts")]` seulement. SI `--features voice` sans piper_tts → synthesize retourne `AudioError::VoiceFeatureDisabled`. |
| [scripts/dev-engine.ps1](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/dev-engine.ps1) | Build DIRECT `--features voice` (SANS `piper_tts`). Plus jamais tentative voice FULL piper → 2-4 min de build gagnées. |

### VRAI FIX TTS (optionnel futur, À FAIRE):
1. Build piper1-rs-sys avec `CMAKE_CXX_FLAGS="/D UNICODE=0 /D _UNICODE=0"` → `ORTCHAR_T = char` (pas wchar_t). Résout erreur C2440.
2. Downgrade ONNX Runtime → `ONNX_RUNTIME_DIR=C:\onnxruntime-win-x64-1.16.3` (déjà renseigné dans `.env`). ONNX < 1.18 API `Ort::Session(const char*, ...)` toujours supportée → GetOutputNames existe. Résout erreur C2039.
3. Lancer build `cargo run --features "voice,piper_tts"`.

---

---

## 🟡 #4 — DSML FORMAT `< | | DSML | | ...>` BRUT AFFICHÉ BULLE ASSISTANT GMAIL

> **STATUT:** ⏸️ MISE EN PAUSE UTILISATEUR (verbatim: "Je vois toujours les `< | | DSML...` mais laissons ça pour le moment").

### Symptôme exact CAPTURE UTILISATEUR VERBATIM (commande Gmail "Donnez moi mon dernier mail"):
```
USER: Donnez moi mon dernier mail

ASSISTANT (bulle):
<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="gmail">
<｜｜DSML｜｜parameter name="message_id" string="true">1a03c87b6b1069f8</｜｜DSML｜｜parameter>
<｜｜DSML｜｜parameter name="operation" string="true">get_message</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>
```
> Format DOUBLES PLEINS (FULLWIDTH) `｜｜` = caractère Unicode U+FF5C "Fullwidth Vertical Line` (pas ASCII pipe 0x7C).  
> Anciennes regex / Brain regex / Frontend regex SPECIFIQUEMENT écrites pour ASCII `|` => NE MATCHENT PAS ces caractères Fullwidth → balises affichées brutes.
>
> **VARIATION 1 (espaces + pipes normaux): `< | | DSML | | ...>`  
> **VARIATION 2 (cette capture, FULLWIDTH pipes):** `<｜｜DSML｜｜...>` (DEUX VARIANTES DIFFÉRENTES à matcher.**

### Correctifs PARTIELS appliqués (pas runtime testés car brain pas restart, frontend regex en attente):
| Fichier | Correctif | Statut |
|---|---|---|
| [providers/brain_python/src/antaerus_brain/tool_calling/orchestrator.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/tool_calling/orchestrator.py) | Nouveau regex `_DSML_OPEN = r"<\s*(?:\/)?\s*(?:\|\s*)+DSML\s*(?:\|\s*)+" → DOIT être étendu inclure caractères FULLWIDTH `｜` (`U+FF5C`) (caractère pipe pleine largeur). À MAJ 🔴 N'EST PAS FAIT. Brain DOIT être redémarré. | ⚠️ Appqué PARTIEL / ❌ N'INCLUT PAS FULLWIDTH PIPE / ⚠️ Pas redémarré |
| [interfaces/web/src/lib/chat.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/chat.ts) `sanitizeAssistantText` | Anciennes regex `<\|DSML\|...>` strictes; DOIVENT matcher (A) pipe ASCII `\|` (B) FULLWIDTH pipe `｜` (C) espaces multiples (D) doubles\|/open-close. | ❌ TODO (en pause user) |
| [interfaces/web/src/store/useAppStore.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/store/useAppStore.ts) L216-L286 | Sanitize cascade apply sur replace/add/append/finalize. Applique si chat.ts regex bon. | ✅ Architecture OK |

---

---

## 🟠 #5 — PARSERERROR dev-engine.ps1 `Jeton inattendu « } » EXPRESSION`

> **STATUT:** ✅ CORRIGÉ (vérifié avec Parser PowerShell → PAS D'ERREUR MAINTENANT).

### Cause:
Lignes bannières `Write-Host "╔═══╗║╚═╝"` (caractères UTF-8 étendus box-drawing). Le parser PowerShell 5.1 Windows locale FR interprétait mal ces multi-bytes Unicode → croyait que les accolades `{ }` suivants étaient "Unexpected".

### Correctif appliqué:
- Remplacé toutes bannières ASCII étendues par séparateurs `=======` (ASCII 7 bits).
- Ré-encodage FORCE script entier en `UTF-8 NO BOM` [scripts/dev-engine.ps1](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/dev-engine.ps1).
- Validation 100% → `System.Management.Automation.Language.Parser.ParseFile(dev-engine.ps1)` → **PAS D'ERREURS**.

---

---

## 🟠 #6 — BUILD CASCADE: whisper/ggml/silero ECHEC (LLVM, CMake, MSBuild, Git, Cargo.lock)

> **STATUT:** ✅ Workarounds 100% appliqués (fake git, court target dir, LLVM 18 Downgrade, BINDGEN args).

### Liste sous-bugs anciennement présents + solutions:
| Bug | Solution dans dev-engine.ps1 / .env |
|---|---|
| `whisper-rs-sys E0080 overflow 1-296` → struct opaque (LLVM 22.1.8 trop récent) | Downgrade: `LIBCLANG_PATH=C:\Program Files\LLVM-18\bin` (LLVM 18.1.8 stable) dans `.env` |
| `fatal: not a git repository` (whisper/ggml CMake `git rev-parse` dans source cargo sans .git) | Compilation **vrai fake `C:\ProgramData\antaerus\bin\git.exe`** via MSVC `cl.exe` code C minimal → exit 0 + SHA1 bidon. Placé en TÊTE PATH + `GIT_EXEC_PATH` défini → CMake `find_program(GIT)` nous trouve. |
| `MSB3191 Accès refusé créer répertoire ggml.tlog/` → permissions dossier | CARGO_TARGET_DIR = chemin ULTRA COURT `C:\b\er` (3 chars) + Remove-Item avant build + ACL `Everyone FullControl` explicite. Évite aussi MAX_PATH 260 chars. |
| `stdbool.h file not found` bindgen whisper | Variable `$INCLUDE` Windows NE LUE PAS par Rust bindgen. Génération: split `$INCLUDE` → `BINDGEN_EXTRA_CLANG_ARGS = "-I<path1> -I<path2>"` tous chemins MSVC/UCRT. |
| `CMake program not found` | `winget install Kitware.CMake` (déjà fait sur machine utilisateur). |
| `Cargo.lock STALE whisper v0.14` | Dev-engine X0: auto-suppression Cargo.lock si Cargo.toml/src changés. |
| `whisper-rs bundled fallback` → DÉSACTIVÉ: SI build bindings échoue → ERROR + exit 1 (plus bundled perimé). | `WHISPER_DONT_GENERATE_BINDINGS` PAS SET. |

---

---

## 📌 **PROCHAINE ÉTAPE CRITIQUE (1 ACTION, RÉSOUD #1 + #2 SI RUNTIME OK):**

```powershell
# PowerShell NEUF (ferme TOUTES fenêtres PS aNtaerus avant)
cd N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\scripts

.\stop-all.ps1 ; Start-Sleep -Seconds 5 ; Get-Process engine_rust,gateway,python,node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue ; Remove-Item -Recurse -Force "C:\b\er" -ErrorAction SilentlyContinue ; Remove-Item -Recurse -Force "$env:ProgramData\antaerus" -ErrorAction SilentlyContinue ; Remove-Item -Recurse -Force (Join-Path $env:TEMP "cargo-engine-rust-2026") -ErrorAction SilentlyContinue ; Write-Host "=== Clean total OK ===" -ForegroundColor Green ; .\dev-all.ps1
```

**Post-lancement vérifier:**
1. Console Engine Rust: Bannière ASCII → `Features ACTIVEES ce build: voice (STT micro→texte: cpal+silero+whisper)`.
2. Console Gateway: `Rebuild Gateway Go ... OK`.
3. UI clic micro 3x: AUCUNE bannière AlreadyExists / cfg(voice)=FALSE.
4. Parle 3s → transcription bulle utilisateur → bulle assistant.
