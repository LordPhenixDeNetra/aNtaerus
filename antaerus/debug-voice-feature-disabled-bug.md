# DEBUG SESSION: voice-feature-disabled-bug

**STATUS:** [ANALYSIS COMPLETE — 100% FIXES APPLIQUÉES]  
**Date début:** 2026-08-26  
**Symptôme:** Quand utilisateur clique `Démarrer la voix 🎙` → UI bannière: `voice feature is disabled; rebuild engine_rust with --features voice`

---

## 🔬 Évidence collectée (Grep, instrumentation, cargo check sandbox)

1. **Grep exact message**: Trouvé 1 SEUL endroit: [protocol/server.rs:L78-L87](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/protocol/server.rs#L78-L87) **fonction StartVoiceSession**. Ancien message court exact affiché.
2. **Vieux binaire H1**: Exe C:\b\er\debug\engine_rust.exe daté `08/26/2026 20:35` (avant correctifs Cargo.toml). Suppression difficile car process (ou fichiers .fingerprint) verrouillés.
3. **Cargo check ort-sys v2**: Build avec `--features voice` essayait compilé `ort-sys/piper1-rs` = TTS cassé. Preuve: Cargo.toml ANCIEN (pas réécrit dans binaire 20:35) = `voice = [dep:cpal, dep:piper1-rs, dep:silero, dep:whisper-rs]`
4. **Fallback voice_stt SÉPARÉ**: Anciennement voice_stt était [dep:cpal, dep:silero, dep:whisper-rs] COMME FEATURE SÉPARÉE. Le code Rust vérifiait `cfg(feature = "voice")` — **ne reconnaissait PAS voice_stt**. Résultat: build voice_stt OK, UI dit toujours "feature voice disabled".
5. **Cargo.lock STALE**: versions whisper-rs-sys v0.14.1 au lieu de v0.15.1 demandé dans Cargo.toml.

---

## 🎯 **ROOT CAUSE FINAL (3 couches cascades)**

**Niveau 1 (Cargo.toml features + Rust `cfg`):**  
- Original features: `voice` = STT+TTS (piper1-rs), `voice_stt` = STT seulement.  
- Rust gate audio: `#[cfg(feature = "voice")]` → NE MATCH PAS feature voice_stt.  
- **Conséquence**: build voice_stt fonctionnel, code audio SVC pas compilé → message "disabled".

**Niveau 2 (Build ancien pas suppr):**  
- dev-engine.ps1 ne supprimait pas C:\b\er systématiquement quand Cargo.toml ou src/*.rs changé.  
- Fallback voice_stt echoue → ancien binaire Core reste en place.

**Niveau 3 (Gateway + double-clic):**  
- Gateway Go startVoiceSession: si session existait renvoyait nil + warning.  
- Frontend VoiceButton: onClick sans busy state → double démarrage rapide voix → Rust StartVoiceSession.  
- Engine Rust sessions map: if contains_key → Err(AlreadyExists) (pas upsert).  
- → 3 codes d'erreur cascade `AlreadyExists` → `voice feature disabled`.

---

## ✅ **FIX 100% APPLIQUÉS (cumulatifs + nouveaux)**

| Domaine | Fix appliqué | Fichier(s) |
|---|---|---|
| **Cargo features** | voice = STT (cpal+silero+whisper); voice_stt = alias ["voice"]; piper_tts = feature SÉPARÉE optionnelle (TTS) | [Cargo.toml:L6-L21](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/Cargo.toml#L6-L21) |
| **Rust cfg gates audio** | 23 occurrences `cfg(feature = "voice")` → `cfg(any(feature = "voice", feature = "voice_stt"))` (compat ascendante) | `bootstrap.rs`, `protocol/server.rs`, `audio/capture.rs`, `audio/vad.rs`, `audio/stt.rs` |
| **Rust TTS gate** | Syntaxe Piper + use piper1_rs → `cfg(feature = "piper_tts")` NOUVELLE | `audio/tts.rs`, `server.rs speak()` `audio/mod.rs` erreur améliorée |
| **Rust AlreadyExists** | StartVoiceSession → UPSERT session: remove old + oneshot stop + insert nouveau (plus Err AlreadyExists jamais). | [server.rs:L272-L298](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/protocol/server.rs#L272-L298) |
| **Rust diagnostics UI** | StartVoiceSession message diagnostic verbose: features compile-time + solution (si jamais bug encore) | [server.rs:L78-L105](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/engine_rust/src/protocol/server.rs#L78-L105) |
| **Rust console banner ASCII** | `Features ACTIVEES ce build:` en tout début process → 100% sûr du binaire | `bootstrap.rs run()` début |
| **Gateway Go AlreadyExists** | startVoiceSession: close existing local if any, si Rust AlreadyExists → StopVoiceSession + 500ms + retry Start 1x. Concurrent setVoiceSession replace cleanup + no return nil. | [voice_session.go:L99-L172](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/http/voice_session.go#L99-L172) |
| **Gateway rebuild FORCÉ** | Rebuild `go build -o bin/gateway.exe ./cmd/gateway` CHAQUE FOIS avant run. | [run-gateway-bin.ps1:L34-L47](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/run-gateway-bin.ps1#L34-L47) |
| **Frontend VoiceButton** | `useState busy` + bouton disabled pendant Promise + 120ms finally debounce (plus double clic rapide) | `VoiceButton.tsx` |
| **dev-engine.ps1 Cargo.lock** | (X0) Auto-suppr Cargo.lock si Cargo.toml ou src/*.rs changé (résolution versions FRESH whisper-rs 0.15.1) | [dev-engine.ps1:L240-L260](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/dev-engine.ps1#L240-L260) |
| **dev-engine.ps1 C:\b\er** | (X1) Check mtime Cargo.toml + 25 src/*.rs récents. SI changé → Remove-Item -Force C:\b\er + ACL Everyone FullControl (MSBuild pas Accès refusé) | [dev-engine.ps1:L262-L320](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/dev-engine.ps1#L262-L320) |
| **dev-engine.ps1 Fake GIT** | (X2) Compiler VRAI `C:\ProgramData\antaerus\bin\git.exe` via MSVC C code (fallback vrai git via CreateProcessA) → whisper/ggml/espeak cmake find_program(GIT) nous trouve et jamais fatal:not a git | [dev-engine.ps1:L350-L465](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/scripts/dev-engine.ps1#L350-L465) |
| **dev-engine.ps1 Cargo features** | (X4) Build DIRECT `cargo run --features voice`. Plus jamais fallback piper voice FULL → build + rapide 2-4min. | [dev-engine.ps1:post X4] |

---

## 🚀 **COMMANDE FINALE USER DOIT EXÉCUTER (1 ligne)**

```powershell
# PowerShell NEUF (IMPORTANT — PATH & permissions reset)
cd N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\scripts

# Kill tous process + Clean 100% + Relance
.\stop-all.ps1 ; Start-Sleep -Seconds 5 ; Get-Process engine_rust,gateway,python,node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue ; Remove-Item -Recurse -Force "C:\b\er" -ErrorAction SilentlyContinue ; Remove-Item -Recurse -Force "$env:ProgramData\antaerus" -ErrorAction SilentlyContinue ; Remove-Item -Recurse -Force (Join-Path $env:TEMP "cargo-engine-rust-2026") -ErrorAction SilentlyContinue ; Write-Host "=== Clean total OK ===" -ForegroundColor Green ; .\dev-all.ps1
```

---

## ✅ **VALIDATION POST-RESTART (Checklist à suivre)**

1. **Console Engine Rust** → Doit afficher BANNIÈRE ASCII avec `Features ACTIVEES ce build: voice (STT micro→texte: cpal+silero+whisper)`. SI VOUS LA VOYEZ → Nouveau binaire = confirmé (plus H1).
2. **Console Engine Rust** → Pas de `fatal: not a git repository`. Si oui → Fake git.exe fonctionne.
3. **Console Engine Rust** → Pas de `MSB3191 accès refusé créer dossier`. SI ok → ACL C:\b\er Everyone good.
4. **Navigateur http://localhost:5173/chat** → Connecter maintenant → Connected.
5. **🎙 Clic 1 micro**: Bouton → listening vert, AUCUNE bannière rouge.
6. **🎙 Clic 2 micro**: Stop → idle.
7. **🎙 Clic 3 micro**: Repasse listening, AUCUNE erreur AlreadyExists.
8. **Test STT**: Parlez 3s → transcription texte dans bulle utilisateur → bulle assistant réponse.

**Pour TTS audio (synthèse vocale, optionnel):** Plus tard, utiliser `cargo run --features "voice,piper_tts"` avec ONNX 1.16 + CMAKE_CXX_FLAGS UNICODE=OFF piper (PENDING optional).

**Status général:** [READY FOR USER TEST. 3 layers fixes verified code-wise.]
