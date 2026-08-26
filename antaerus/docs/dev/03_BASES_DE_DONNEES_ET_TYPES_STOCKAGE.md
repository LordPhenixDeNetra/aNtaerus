# BASES DE DONNÉES & TYPES DE STOCKAGE UTILISÉS PAR ANTAERUS
> **Source principale :** Réponse utilisateur 26/08/2026 — "Quels sont les types de base de données utilisées dans cette app ?"
> **But :** Lister TOUS les mécanismes de stockage / sérialisation de aNtaerus, couche par couche.
> **Convention chemins PORTABLES (multi-utilisateurs):**
> - `$ANTAERUS_MONOREPO` = racine WORKSPACE Git (dossier parent qui contient `antaerus/`)
>   - Windows: `N:\Utilisateurs\toi\Projets\aNtaerus`
>   - macOS / Linux: `/home/toi/Projets/aNtaerus`
> - Tous les chemins fichiers commencent par `antaerus/...` (relatif au repo).

---

## 🧭 RÉSUMÉ EN 1 LIGNE PAR TYPE

| # | Nom / Catégorie | Type | Quoi stocké ? |
|---|---|---|---|
| 1 | **SQLite (`antaerus_memory.db`)** | **Base relationnelle SQL, fichier plat** | **95% des données** : missions + chat + kernel mémoire (PRINCIPAL). |
| 2 | **IndexedDB / LocalStorage Navigateur** | NoSQL objet / Key-Value navigateur | Cache UI Zustand persisté + JWT dev + préférences. |
| 3 | **Protocol Buffers (gRPC `audio.proto`)** | Sérialisation binaire RPC RAM transit | Stream voix STT/TTS Go ↔ Rust (haute performance, pas persistant). |
| 4 | **Fichiers JSON config & secrets** | Key-Value fichier plat texte UTF-8 | OAuth Google credentials+token, package.json, tsconfig... |
| 5 | **Fichier YAML outils (`tools.yaml`)** | Config hiérarchique texte | Liste outils autorisés mission Gmail/Filesystem/CLI. |
| 6 | **Fichier `.env`** | Env vars Key=Value texte | Tous secrets API (JWT, Deepseek Key, LLVM path, ONNX, paths). |

---

## 📊 #1 — SQLite `antaerus_memory.db` (BASE PRINCIPALE)
> **Le plus important. 9 tables SQL.**

### Emplacement
```
$ANTAERUS_MONOREPO/antaerus/memory_data/antaerus_memory.db
```
- Fichier **`-shm`** + **`-wal`** créés à côté en mode journaling SQLite (suppression du fichier principal = reset complet).
- Override chemin possible dans `.env` :
  ```dotenv
  ANTAERUS_BRAIN_MEMORY_DB_PATH=/chemin/absolu/custom.sqlite3
  ```

### Driver utilisé (côté Brain Python)
→ Lib **`aiosqlite`** (SQLite asynchrone).
- Missions store (`MissionStateStore`) : [mission/state.py:L9](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/mission/state.py#L9)
- Mémoire Kernel (`MemoryKernel`) : [memory/kernel.py:L9](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/memory/kernel.py#L9)

### Tables SQL (9 tables)
Voir document détaillé : [02_SCHEMA_SQL_antaerus_memory_db.md](02_SCHEMA_SQL_antaerus_memory_db.md)

| Table | Quoi ? |
|---|---|
| `missions` | 1 ligne = 1 carte Mission (statut, titre, autonomie, tokens...) |
| `mission_steps` | Sous-étapes d'une mission (1 étape par outil ex: Gmail get_message) |
| `mission_events` | Timeline journal mission (status_changed, step_completed, error...) |
| `mission_step_idempotency` | Anti re-exécution side-effects (email envoyé 2x) (PK composite hash SHA256 payload) |
| `chat_sessions` | Session WebSocket page Chat |
| `chat_messages` | 1 bulle (role: user/assistant/system + content) |
| `events` | Timeline Kernel mémoire (brut avant extraction facts) |
| `facts` + `fact_observations` | Graph sémantique RDF (sujet/prédicat/objet) (mémoire long terme) |
| `initiative_store` | Missions proactives Curateur Nocturne (rappels / rendez-vous) |

### Types SQLite dans l'app
- 🔤 **`TEXT`** (90%): UUIDs + JSON serialisés (`tool_args`, `result_json`) + Dates ISO8601 UTC
- 🔢 **`INTEGER`**: autonomie (0..5), tokens, index étape `idx`
- ❌ Pas de type **BOOLEAN SQLite** → utilise INTEGER 0/1 ou TEXT enum ("planned"/"completed")

---

## 💾 #2 — IndexedDB / LocalStorage (NAVIGATEUR, UI)
Pas de fichier sur disque projet. Stocké DANS LE PROFIL NAVIGATEUR (Chrome/Edge/Firefox).

### Quoi stocké ?
→ Store Zustand React **persisté via middleware `zustand/middleware/persist`**
- Dernière session WebSocket + JWT dev (évite recliquer "Générer JWT dev" à chaque F5)
- Préférences UI (dark mode / light mode, volume micro, last voice model)
- Cache liste missions → si network coupe, on affiche les missions déjà chargées.

### Fichier code responsable
- `antaerus/interfaces/web/src/store/useAppStore.ts` → middleware persist.

---

## ⚡ #3 — Protocol Buffers 3 (gRPC, MÉMOIRE RAM HAUTE PERF)
⚠️ **PAS PERSISTANT** : Ce n'est PAS une base → **canal de transport binaire** entre Gateway Go et Engine Rust pour éviter JSON trop lent en streaming micro (48 kHz).

### Protocole + schéma
→ **`proto3`** (syntaxe Protocol Buffers version 3)
→ Fichier schema :
```
$ANTAERUS_MONOREPO/antaerus/kernel/proto/audio.proto
```
→ Voir : [kernel/proto/audio.proto](file:///N:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/kernel/proto/audio.proto)

### Services gRPC définis (voix)
- `AudioRuntime.StartVoiceSession(session_id, vad, stt_config)` → streaming `VoiceEvent {VadEvent, TranscriptEvent}`
- `AudioRuntime.StopVoiceSession(session_id)`
- `AudioRuntime.Speak(text, voice_config)` (TTS piper)

### Langages implémentés
| Couche | Lib |
|---|---|
| **Engine Rust** (serveur tonic) → `providers/engine_rust/src/grpc_service.rs` + `protocol/server.rs` | Crate `tonic` + `prost` (code Rust généré depuis audio.proto) |
| **Gateway Go** (client gRPC) → `interfaces/gateway_go/internal/clients/engine_grpc_client.go` | Package Go `google.golang.org/grpc` + protoc `--go_out` code généré `internal/gen/audiopb/` |

---

## 🗝️ #4 — FICHIERS JSON (CONFIG & SECRETS)
### 4.1 — ⚠️ SECRETS OAuth GOOGLE (JAMAIS PUSH DANS GIT !)
**Emplacement :**
```
$ANTAERUS_MONOREPO/antaerus/config/
  ├── google_credentials.json   → OAuth Desktop Installed (client_id + client_secret)
  └── google_token.json        → refresh_token PERMANENT 103 chars + access_token + expiry
```
- Protégés `.gitignore` wildcards : `*credentials*.json`, `*token*.json`
- Utilisés couche **Brain Python `antaerus_brain/tools/gmail.py` + `calendar.py`** (Google API `google-api-python-client`)

### 4.2 — Config package/build (Frontend, Gateway, Engine)
| Fichier | Couche | Rôle |
|---|---|---|
| `antaerus/interfaces/web/package.json` | Frontend React | npm deps (lucide-react, zustand, vite...) + scripts dev/build/test |
| `antaerus/interfaces/web/tsconfig.json` | Frontend React | TypeScript rules strict |
| `antaerus/interfaces/gateway_go/go.mod` + `go.sum` | Gateway Go | modules Go (gorilla websocket, gRPC, godotenv, jwt) |
| `antaerus/providers/engine_rust/Cargo.toml` + `Cargo.lock` | Engine Rust | **Features flags** : `voice = [dep:cpal, dep:silero, dep:whisper-rs]` · `voice_stt = ["voice"]` alias · `piper_tts = ["dep:piper1-rs"]` TTS optionnel. |
| `antaerus/providers/brain_python/pyproject.toml` + `uv.lock` | Brain Python | deps Python: FastAPI, aiosqlite, aiosse, pydantic v2, google-api-python-client, python-multipart, silero, whisper bindings... |

---

## ⚙️ #5 — FICHIER YAML CONFIG OUTILS MISSIONS (`tools.yaml`)
### Emplacement
```
$ANTAERUS_MONOREPO/antaerus/config/tools.yaml
```
Lecture par **`Brain Python create_tool_registry(settings.tools_config_path)`** → MissionPlanner ne peut appeler QUE les outils `enabled: true`.

### Contenu VERBATIM actuel (10 outils, à date 26/08/2026)
```yaml
browser:              # Recherche web
  enabled: true
  max_results: 5

gmail:                # Boîte Gmail (OAuth Google)
  enabled: true
  allow_send: false   # Ecriture interdite → 100% lecture seul par défaut (sécurité)

calendar:             # Google Calendar OAuth
  enabled: true
  allow_create: false # Lecture seul, pas créer événements (sécurité)

weather:              # Météo géolocalisée
  enabled: true
  geocoding_enabled: true

vision:               # Vision (classification image / screenshot)
  enabled: true
  default_confidence: 0.25

filesystem:           # Outils lire fichiers (Mission commande "Ouvre Musique" → path)
  enabled: true
  allowed_roots:
    - docs
    - memory_data
    - providers/brain_python
    - C:/Users/DELL/Music        # ⚠️ CE CHEMIN EST HARDCODÉ USER-SPECIFIC !
    - C:/Users/DELL/Videos       # → À remplacer par $env:USERPROFILE\Music
    - C:/Users/DELL/Downloads
  max_bytes: 65536

memory_tool:          # Écrire/FAITS dans mémoire Kernel
  enabled: true
  default_category: notes

cli:                  # Outils exécution commande terminal (liste blanche autorisée)
  enabled: true
  allowed_commands:
    - python · py · git · go · cargo · uv · npm
    - explorer / explorer.exe (ouvre dossier Win)
    - vlc / vlc.exe (lecteur audio, commande "Ouvre Musique")
    - wmplayer.exe (Windows Media Player)
    - msedge.exe
  timeout_seconds: 10
```
> ⚠️ **ATTENTION SECURITE multi-utilisateurs :**  
> Chemins **`C:/Users/DELL/...`** (`Music / Videos / Downloads`) sont **SPÉCIFIQUES À L'UTILISATEUR ACTUEL**.  
> Si quelqu'un d'autre clone le repo → ces 3 paths **n'existent PAS** (son user = `C:/Users/MARIE/...`).  
> ✅ **Bonnes pratiques :** remplacer par variable env `ANTAERUS_TOOLS_FS_ROOTS` séparée par `;` ou utiliser `$env:USERPROFILE` dans le code Python charger YAML.

---

## 🔐 #6 — FICHIER `.env` (TOUS SECRETS & PATHS CONFIG GLOBAUX)
### Emplacement
```
$ANTAERUS_MONOREPO/antaerus/.env
```
> `.gitignore` exclu aussi → **jamais commité.**  
> Voir template public : `antaerus/.env.example` (commité avec fausses valeurs)

### Catégories clefs stockées dans `.env` (Key=Value texte)
| Catégorie | Clé exemple | Rôle |
|---|---|---|
| Auth JWT Gateway WS | `ANTAERUS_GATEWAY_JWT_SECRET=...` | Signature JWT `/api/v1/auth/dev-token` + auth WS `?token=xxx` |
| API Keys LLM | `ANTAERUS_BRAIN_DEEPSEEK_API_KEY=sk-...` | Brain Python appel LLM Deepseek chat + plan mission |
| Paths OAuth | `ANTAERUS_BRAIN_GOOGLE_TOKEN_FILE=config/google_token.json` | Chemin refresh token |
| Paths build voix (Rust) | `LIBCLANG_PATH=C:/Program Files/LLVM-18/bin` <br> `ONNX_RUNTIME_DIR=C:/onnxruntime-win-x64-1.16.3` | Bindgen libclang whisper-rs + ONNX piper TTS |
| Ports services | `ANTAERUS_GATEWAY_PORT=8080` <br> `ANTAERUS_WEB_PORT=5173` <br> `ANTAERUS_ENGINE_GRPC_PORT=50051` | Ports Web / Gateway / Engine Rust gRPC |

---

## 🚫 **CE QUE L'APP NE FAIT PAS (pas installé, pas prévu)**
❌ Pas de serveur SQL externe : PostgreSQL / MySQL / MariaDB / SQL Server  
❌ Pas de cluster NoSQL : MongoDB / Cassandra / CouchDB  
❌ Pas de cache distribué : Redis / Memcached  
❌ Pas de Backend-as-a-Service : Firebase / Supabase / Amplify  
❌ Pas de base vectorielle RAG : pgvector / Chroma / Qdrant / Weaviate (prévu + tard pour embeddings docs)

### 🎯 POURQUOI CE CHOIX SQLite + JSON + YAML ?
→ **Zéro serveur.** Un nouveau dev clone le repo → `install scripts` → base SQLite créée automatiquement par `await store.initialize()` → tout marche. Pas à installer Postgres sur Windows.  
→ **Backup 1 fichier** : copier-coller `antaerus_memory.db` = backup complet missions + chat + mémoire.
