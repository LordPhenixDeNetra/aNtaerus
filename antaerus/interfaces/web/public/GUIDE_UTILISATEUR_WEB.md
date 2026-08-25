# Guide utilisateur WEB — aNtaerus

Assistant personnel IA self-hosted. React Web UI + Go Gateway + Python Brain + Rust Engine.

Documentation exécutable pour Windows 10/11 (Powershell) et Linux/Docker (VPS Ubuntu/Debian type Hostinger Dokploy).

---

## 1. Prérequis installer sur la machine

### 1.1 Windows 10/11 (développement local recommandé)

| Outil | Version minimum | Commande de vérification (PowerShell) | Installation si absente |
|---|---|---|---|
| **Node.js** LTS (Vite 6 + React 18) | 20.11 ou plus | `node -v` | <https://nodejs.org/fr> (LTS recommandé) → cocher "Automatically install necessary tools" |
| **npm** (livré avec Node.js) | 10.2 ou plus | `npm -v` | inclus avec Node.js |
| **Go** (Gateway Go HTTP REST / WebSocket) | 1.22.x ou plus | `go version` | <https://go.dev/dl/> → `go1.22.x.windows-amd64.msi` |
| **Python** (Brain FastAPI, sqlite aiosqlite) | 3.11.x | `py -3.11 --version` OU `python --version` | <https://python.org/downloads/release/python-3119/> → **IMPORTANT** cocher "Add Python.exe to PATH" au premier écran |
| **pip** (gestionnaire paquets Python) | inclus | `py -3.11 -m pip --version` | inclus Python 3.11 |
| **Rust + Cargo** (Engine WASM sandbox feature `wasm-runtime`) | 1.77+ stable avec target `x86_64-pc-windows-msvc` | `rustc --version` + `cargo --version` | <https://rustup.rs/> → accepter défaut → installer "Build Tools for Visual Studio 2022" (C++ MFC/ATL x64) ~8Go via Visual Studio Installer |
| **git** | 2.40+ | `git --version` | <https://git-scm.com/download/win> |
| **(Optionnel M7 Skill Lab Docker sandbox)** Docker Desktop 4.25+ | 24+ engine | `docker ps` | <https://www.docker.com/products/docker-desktop/> → cocher "Use WSL 2 instead of Hyper-V". Si pas Docker: fallback local Python `python -I -S -c` utilisé automatiquement. |
| **(Optionnel M3 voix temps réel + M7 Rust voice feature)** LLVM/Clang 64-bit (`LIBCLANG_PATH` requis) | 17.x ou 18.x msvc x64 | `clang --version` | <https://winlibs.com/> → Win64 UCRT runtime LLVM-MinGW-w64 zip, dézipper `C:\llvm-18\bin`, ajouter `C:\llvm-18\bin` au PATH system, variable env `LIBCLANG_PATH=C:\llvm-18\bin`. |
| **(Optionnel LLM local)** Ollama | 0.1.30+ | `ollama --version` | <https://ollama.com/> |

Vérification rapide PowerShell (installs Windows 11 fraîches) :

```powershell
node -v ; npm -v ; go version ; py -3.11 --version ; rustc --version ; cargo --version ; git --version
# Doivent toutes retourner une version sans "is not recognized"
```

### 1.2 Linux Ubuntu 22.04 / 24.04 LTS (VPS / self-host / Dokploy Docker Swarm recommandé)

Pareil que Windows mais ligne de commande apt :

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
# Go 1.22
wget https://go.dev/dl/go1.22.8.linux-amd64.tar.gz && sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.22.8.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc ; source ~/.bashrc
# Python 3.11 + venv + pip
sudo apt update && sudo apt install -y python3.11 python3.11-venv python3-pip python3.11-dev git curl build-essential
# Rust stable
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y ; source "$HOME/.cargo/env"
# Docker (optionnel sandbox)
curl -fsSL https://get.docker.com | sudo sh ; sudo usermod -aG docker $USER ; newgrp docker
# (Optionnel M3 voix) LLVM Clang libclang
sudo apt install -y llvm-18 libclang-18-dev ; export LIBCLANG_PATH=/usr/lib/llvm-18/lib
```

---

## 2. Télécharger le code source

```powershell
# Windows Powershell (dossier projet PycharmProjects)
mkdir "C:\Users\$env:USERNAME\PycharmProjects" -Force | Out-Null
cd "C:\Users\$env:USERNAME\PycharmProjects"
git clone https://github.com/LordPhenixDeNetra/aNtaerus.git aNtaerus
cd aNtaerus
ls .\antaerus   # Valider 4 dossiers: kernel  engine  interfaces  providers
```

Chemin utilisateur actuel (exemple OneDrive UCAD) : `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus`

---

## 3. Installer dépendances projets (par langage, 1 fois)

IMPORTANT aNtaerus **aucun nouveau `npm install` hors web/**, aucun nouveau pip hors brain_python, aucun nouveau cargo hors engine_rust. Manifests figés M0-M7.

### 3.1 Installer dépendances React Web (Interface utilisateur UI)

```powershell
cd "n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\interfaces\web"
npm install
# Attendre ~1-3 minutes selon débit. Fin: "audited XXX packages" sans vulnérabilités critique
```

### 3.2 Installer dépendances Brain Python (moteur IA LLM + mémoire + missions + skills)

SANS créer ni utiliser `venv` si vous préférez global (recommandé dev local Windows) :

```powershell
cd "n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\providers\brain_python"
py -3.11 -m pip install -r requirements.txt   # OU "requirements-dev.txt" si vous voulez ruff/myPy/pytest aussi
```

OU avec `venv` (recommandé Linux VPS isolation stricte) :

```bash
cd ~/aNtaerus/antaerus/providers/brain_python
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3.3 Dépendances Gateway Go

Go télécharge les modules automatiquement au build. Pas d'install. Valider seulement :

```powershell
cd "n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\interfaces\gateway_go"
go mod download
```

### 3.4 Dépendances Engine Rust

Cargo télécharge `wasmtime-v17`, `tokio-runtime`, `tonic gRPC`, etc. au build avec features. Pas d'install explicite.

Région critique Windows : **restriction écriture fichier build 3rd-party memoffset/autocfg sur OneDrive**. Fix permanent variable utilisateur TEMP (à appliquer 1 fois dans la session powershell, ou ajouter aux variables d'environnement Windows) :

```powershell
# Pour TOUTE commande cargo dans aNtaerus:
$env:CARGO_TARGET_DIR = "$env:TEMP\cargo-engine-rust-2026"
# (Optionnel: le persister pour l'utilisateur courant)
[System.Environment]::SetEnvironmentVariable("CARGO_TARGET_DIR","$env:TEMP\cargo-engine-rust-2026","User")
```

---

## 4. Configuration environnement `.env` (1 fois par machine)

RÈGLE FORT PROJECT aNtaerus : **Le fichier `.env` DOIT se trouver DANS `antaerus/.env` (pas racine, pas dans gateway_go/brain).**

Copiez modèle `.env.example` → `.env` :

```powershell
cd "n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus"
Copy-Item .env.example .env
```

Éditez `antaerus/.env` (VS Code / Notepad++), les champs importants à modifier pour vous :

### 4.1 (OBLIGATOIRE) Fournisseur modèle IA (LLM)

Choisissez UN fournisseur, commentez les autres. Modifiez variable `ANTAERUS_BRAIN_DEFAULT_PROVIDER` :

#### Cas n°1 — OpenAI (facturation par token, rapide)
```
ANTAERUS_BRAIN_DEFAULT_PROVIDER=openai
ANTAERUS_BRAIN_OPENAI_MODEL=openai/gpt-4o-mini
# Plus bas dans le fichier (en dehors des champs fournis par défaut example): ajouter:
# OPENAI_API_KEY=sk-votre_cle_api_openai_sans_espaces
```

#### Cas n°2 — Anthropic Claude 3.5 Sonnet (haute raisonnement)
```
ANTAERUS_BRAIN_DEFAULT_PROVIDER=anthropic
ANTAERUS_BRAIN_ANTHROPIC_MODEL=anthropic/claude-3-5-sonnet-latest
# + variable:
# ANTHROPIC_API_KEY=sk-ant-votre_cle
```

#### Cas n°3 — Local Ollama `llama3.1:8b` (0 coût, CPU/GPU 8GB+ RAM)
Installez Ollama d'abord, puis :

```powershell
# Terminal Ollama:
ollama pull llama3.1:8b
# Vérifier que serveur tourne:
ollama list
```

Puis dans `.env` :
```
ANTAERUS_BRAIN_DEFAULT_PROVIDER=ollama
ANTAERUS_BRAIN_OLLAMA_BASE_URL=http://localhost:11434
ANTAERUS_BRAIN_OLLAMA_MODEL=llama3.1:8b
```

#### Cas n°4 — Autres (DeepSeek, Mistral) via variable OPENROUTER / MISTRAL API KEY :
Même logique, voir variables `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`.

### 4.2 (Optionnel) — JWT secret + sécurité
Changez par défaut en production pour éviter tokens de développement connus :
```
ANTAERUS_GATEWAY_JWT_SECRET=votre_longue_chaine_aleatoire_min_32_octets
ANTAERUS_BRAIN_API_SECRET=chaine_different_secret_brain_gateway
```

### 4.3 (Optionnel M5 moteur proactif curateur nocturne)
```
# Heure UTC declenchement nocturne compacter mémoire, générer initiatives :
ANTAERUS_GATEWAY_PROACTIVE_CRON_HOUR=2
```

### 4.4 (Optionnel M7 Skill Docker sandbox)
Par défaut utilisé si `docker ps` fonctionne. Pas besoin de variable. Si Docker absent, fallback python local s'active.

Sauvegarder `.env`. Ne JAMAIS commit ce fichier `.env` dans git (déjà dans `.gitignore` aNtaerus).

---

## 5. Démarrer l'application WEB (3 services + UI React Vite)

### Mode n°1 — Démarrage 1 clic TOUS LES SERVICES (dev local Windows, recommandé pour tester UI)

```powershell
cd "n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\antaerus\scripts"
powershell -ExecutionPolicy Bypass -File .\dev-all.ps1
```

Cette commande :
1. Démarre Brain Python FastAPI → port 8000
2. Démarre Gateway Go REST+WS → port 8080
3. Démarre Engine Rust (feature voice si LLVM) → port 7000 (HTTP) + 7001 (gRPC)
4. Démarre React UI Vite Dev Server → port 5173

PIDs écrits dans `%TEMP%\antaerus-dev-all-processes.json` pour suivre.

Après 20 secondes : ouvrez dans Chrome/Firefox/Edge : <http://localhost:5173/>

Vous voyez page Home avec 10 cartes, et pas de bandeau "Impossible de contacter le gateway" en haut à droite. Bravo.

### Mode n°2 — Arrêter tous les services

```powershell
cd antaerus\scripts
powershell -ExecutionPolicy Bypass -File .\stop-all.ps1
# Attendre confirmation "tous les 4 services arretes"
```

### Mode n°3 — Démarrer service par service (debug unitaire)

Si vous voulez seulement Brain Python + Gateway Go :

```powershell
# Terminal 1 Brain
cd antaerus\providers\brain_python ; py -3.11 -m uvicorn antaerus_brain.api.main:app --port 8000 --reload
# Terminal 2 Gateway
cd antaerus\interfaces\gateway_go ; $env:ANTAERUS_ENV="development" ; go run .\cmd\gateway\main.go
# Terminal 3 UI
cd antaerus\interfaces\web ; npm run dev
```

### Mode n°4 — Production (Build + distribuer bundle)

Utilisez scripts release multiplateformes créés M6 :

```powershell
cd antaerus\scripts\release
powershell -ExecutionPolicy Bypass -File .\build_bundle.ps1   # Windows
# Pour Linux: bash ./build_bundle.sh
```

Dossier créé : `aNtaerus/bundle/` → `antaerus-web-win-x64.zip` / `.tar.gz` linux + `MANIFEST.txt` + checksums SHA256. Déployer zip extrait sur VPS, puis lancer `start.ps1` (ou `start.sh`).

### Mode n°5 — Docker run direct 1 conteneur UI dist (sans backend, seulement interface)

Build UI d'abord, puis image Nginx statique servir `dist/` :

```powershell
cd antaerus\interfaces\web ; npm run build
# Copiez antaerus\interfaces\web\dist dans C:\nginx\html. Ou:
docker run -d --name antaerus-web --rm -p 80:80 -v "C:\chemin\vers\antaerus\interfaces\web\dist:/usr/share/nginx/html:ro" nginx:1.27-alpine
# UI: http://localhost:80
# Attention: ce mode ne fait PAS tourner gateway 8080 ni brain 8000, donc chat/skills NE MARCHENT PAS.
# A utiliser pour démonstration UI seulement + installer backend séparément VPS.
```

---

## 6. Utiliser l'interface Web — 10 écrans principaux

Ouvrez <http://localhost:5173/> → arrive sur **Home** (page d'accueil).

Astuce générale : **passer la souris sur les boutons / icônes "i"** pour tooltip explicatif. Les paramètres sont aussi sauvés dans `localStorage` du navigateur (clé `antaerus_session`, `skill-editor-draft`, etc.) par page.

### 6.1 Setup — Configuration initiale (écran 1, à faire AU PREMIER LANCEMENT)

Cliquez : **Home → carte Setup (icône outils)** ou directement URL <http://localhost:5173/setup>

**Setup Wizard 5 étapes (M6 Polish)** :
1. **Étape 1 — Licence** : Validez MIT license, cochez case "J'accepte les conditions", Suivant.
2. **Étape 2 — Chemins** : Indiquez emplacement dossier de sauvegarde mémoire (par défaut `memory_data/` relatif, OK). Modifiez seulement si vous voulez sur SSD séparé.
3. **Étape 3 — Modèles IA** : Sélectionnez le fournisseur LLM (OpenAI / Anthropic / Ollama / DeepSeek / Mistral). Collez la Clé API (si cloud) → bouton "Tester la connexion" (validation fetch `api/v1/config/test-llm`). Si test OK, voyez coche verte.
4. **Étape 4 — Voix** : Activez/désactivez voix temps réel (M3). Modèles STT (parole→texte) et TTS (texte→parole) par défaut "whisper-local" si Rust feature voice activée, sinon "désactivé".
5. **Étape 5 — Terminer** : Cliquez "Enregistrer et redémarrer la session". Vous êtes redirigé Home.

Pour **modifier la config plus tard** : menu Home → carte **Config** → <http://localhost:5173/config> (formulaire ConfigForm.tsx complet avec sauvegarde immédiate gateway → brain).

### 6.2 Chat texte — Interface principale assistant (M3)

Home → carte **Chat** → <http://localhost:5173/chat>

Composants :
- Zone messages (bulle bleue utilisateur droite, bulle grise assistant gauche — streaming token par token via SSE)
- Input texte en bas + bouton micro (si voix activée).
- `Ctrl+Enter` pour envoyer message multiline.
- Historique session gauche (plusieurs conversations persistantes mémoire brain SQLite).

Fonctionnalités utiles :
- Cliquer sur un message → menu "Copier / Réessayer / Supprimer".
- `Command + K` (Mac) ou `Ctrl + K` (Win) : ouvre palette commandes rapide.

### 6.3 Voice — Micro + Transcription temps réel (M3)

Depuis page **Chat**, cliquez icône microphone ronde à gauche input. Composants Voice M3 :
- **VoiceButton** : Start/Stop capture micro (cercle rouge animé si record actif).
- **VoiceVisualizer** : Waveform audio live en SVG (zéro dépendance).
- **VoiceTranscript** : Transcription mot par mot affichée pendant parole. Cliquer "Confirmer" pour l'envoyer comme message utilisateur.
- **Voice Activity Detection** (useVAD hook) : silence > 1.5s → enregistrement s'arrête automatiquement et transcription part.

**Problèmes micro courants** : Chrome bloque micro sur http non localhost. Si vous testez depuis IP LAN `http://192.168.1.42:5173`, ajouter drapeau Chrome `#unsafely-treat-insecure-origin-as-secure`. Ou utilisez HTTPS + certificat auto-signé.

### 6.4 Missions — Définir objectifs + DAG tâches (M2/M4)

Home → carte **Missions** → <http://localhost:5173/missions>

3 onglets:
- **Toutes** : liste cards mission état `pending` / `running` / `done` / `failed`.
- **Créer** : MissionWizard, entrez objectif "Préparer un rapport trimestriel finances Q3" → bouton "Planifier". Brain planner décompose en étapes.
- **Détail d'une mission** : cliquez sur une carte → **TaskGraph** SVG custom 0-dépendance (graphe DAG dépendances étapes). Flèches = dépendances. Nœud rouge = failed, vert = done, bleu = running. Bouton "Exécuter étape suivante".

Types missions supportées :
- Rapport / Recherche web / Analyse données CSV / Compose Email (requires Google OAuth) / Script Python.

### 6.5 Memory Explorer — Graphe mémoire sémantique (M1/M6)

Home → carte **Memory Explorer** → <http://localhost:5173/memory-explorer>

- **SVG graphe circular layout + Bézier curves** (zéro dep chart.js) → nœuds = concepts / pensées / missions. Liens = relations sémantiques.
- Cliquez un nœud → **FactCard** côté droit (texte brut + tags + date création).
- Recherche en haut à droite (type "finance") → filtre nœuds contenant tag/mot.
- Bouton "Exporter JSON" dump mémoire brain au format `memory-export-YYYYMMDD.json`.

### 6.6 Command Center — Moteur proactif gouvernance (M5)

Home → carte **Command Center** → <http://localhost:5173/command-center>

Deux zones:
1. **Niveau Autonomie** (slider 0 à 5) — composant `AutonomySlider`.
   - `0` = Aucune initiative → tout demande validation humaine.
   - `2` = Actions bas risque validées auto (ex: nettoyage fichiers temporaires) → recommandé début.
   - `5` = Autonomie totale (utilisateurs avancés; budget max + risques définis).
2. **Initiatives proposées par le moteur** (cards `InitiativeCard`). Chaque card affiche :
   - Titre / Catégorie (memory/skills/missions/security) / Budget estimé / Niveau Risque.
   - Boutons **Approuver** (vert) → applique la modification immédiatement.
   - Bouton **Rejeter** (rouge) → demande motif texte min. 8 caractères.
   - Exemple initiative : "Compacter la mémoire 28 MB libre → libérer 3 MB en supprimant doublons".

Curateur nocturne tourne à 2h UTC (variable `.env`) et génère la plupart des initiatives.

### 6.7 Analytics — Tableau de bord métriques (M6)

Home → carte **Analytics** → <http://localhost:5173/analytics>

- **SVG MetricsChart** custom 0-dépendance (barres + lignes + KPI cards).
- 4 blocs : (1) Missions terminées / échouées 30j, (2) Mémoire utilisée / taille DB SQLite, (3) Voice temps de parole minutes, (4) M7 Sandbox fuel utilisé par skill run.
- Bouton "Télécharger CSV" exporte métriques brutes.

### 6.8 System Health — Santé services temps réel (M6)

Home → carte **System Health** → <http://localhost:5173/system-health>

- 4 cards service (`ServiceStatusCard`) avec voyant LED vert/orange/rouge :
  1. **Web UI** : status (dev 5173 / build dist 80)
  2. **Gateway Go** : port 8080, RPS courant, mémoire RSS, goroutines count.
  3. **Brain Python** : port 8000, Uvicorn workers, DB SQLite status.
  4. **Engine Rust** : port 7000 HTTP + 7001 gRPC, wasmtime feature OK, fuel sandbox pool.
- Refresh auto toutes 5 secondes. Cliquez manuel refresh icône.
- Chaque card cliquable ouvre modale logs 100 dernières lignes service (si gateway droit admin).

### 6.9 Config — Modifier la configuration (M0/M6)

Home → carte **Config** → <http://localhost:5173/config>. Formulaire complet. Sauvegarder en bas → push immédiat gateway `/api/v1/config` → brain persisté dans `.env` et mémoire runtime.

### 6.10 Skill Lab — Créer, tester, installer des plugins compétences (M7 NOUVEAU)

**Page phare M7**, accessible Home → carte **Skill Lab (accent vert émeraude)** → <http://localhost:5173/skill-lab>

3 onglets en haut : Onglet 1 Marketplace, Onglet 2 Editor, Onglet 3 Tester. + **Bandeau haut approbations skills en attente** (si skills en `pending_approval`).

---

## 7. Guide Skill Lab — 3 onglets M7 pas à pas (compétences custom)

Skill = un petit programme Python 3.11 (ou module WebAssembly WASM) que brain exécute, **isolé dans sandbox Docker ou local Python**.

### 7.1 Marketplace — Découvrir packages curated (3 exemples inclus par défaut)

Marketplace affiche grille 3 cards `SkillMarketplace` curated aNtaerus équipe :

1. **`echo-json`** (runtime python, 1 KB) — prend JSON argument, renvoie echo + timestamp. Installer gratuit.
2. **`sha256`** (runtime python, stdlib hashlib) — calcule hash SHA-256 fichier/texte. Sécurité vérifiée.
3. **`wasm-add-forty-two`** (runtime wasm, 320 B module) — prend entier, renvoie + 42 via WebAssembly Rust. Démo sandbox WASM.

Cliquez sur une card → panel détail. Boutons :
- **Installer** → popup confirm, `trusted=oui` → statut devient `installed`. `trusted=non` → statut `pending_approval` → apparaît dans bandeau approbations.
- **Aperçu code** → extrait 20 premières lignes.

### 7.2 Editor — Créer un skill depuis zéro (ZÉRO dépendance éditeur)

**SkillEditor.tsx** = textarea custom (PAS CodeMirror / Monaco). Fonctionnalités :
- Colonne gauche **line-numbers** synchronisée avec scroll zone texte.
- Tab = insère 2 espaces (PAS caractère tabulation \t).
- `Ctrl+S` = sauvegarde draft dans localStorage du navigateur, clé `skill-editor-draft`. (Fermer navigateur ne perd pas.)
- 3 boutons en haut: "Nouveau" / "Charger draft" / "Générer depuis description" (appelle `generateSkillDraftFromUsage` API M7).

**Exemple — créer skill "hello-somme"** :

1. Onglet Editor → champ **Nom** : `hello-somme`. Runtime sélection : **python**.
2. Champ description utilisateur (usage) : "Prend deux nombres entiers a, b arguments JSON, renvoie la somme".
3. Cliquer **"Générer draft depuis usage"** → code s'écrit auto. Resultat type :
   ```python
   import json
   import sys
   def main() -> dict:
       args_json = sys.argv[1] if len(sys.argv) > 1 else "{}"
       payload = json.loads(args_json) if args_json else {"raw": sys.argv[1:]}
       a = int(payload.get("a", 0))
       b = int(payload.get("b", 0))
       return {"result": a + b, "status": "ok", "skill": "hello-somme"}
   if __name__ == "__main__":
       print(json.dumps(main(), ensure_ascii=False))
   ```
4. Vérifier le code, cliquez **"Envoyer en revue pour installation"** → skill apparaît **Pending approval** dans bandeau approbations (haut SkillLab).
5. Aller dans bandeau → **Approuver** (bouton vert) / **Rejeter** (rouge → écrivez motif min. 8 caractères ex : "nom skill invalide").

### 7.3 Tester — Exécuter un skill installé (sandbox isolé)

Onglet **Tester** → `SkillTester.tsx` :
1. Sélectionnez skill dropdown : choisissez `hello-somme` (si vous l'avez installé) ou `echo-json` (Marketplace).
2. **Arguments JSON** : zone de texte entrez payload. Exemple hello-somme :
   ```json
   {"a": 18, "b": 24}
   ```
3. Choisissez Mode sandbox :
   - **Auto** : utilise Docker si `docker ps` répond, sinon local. Recommandé.
   - **Forcer local (python -I -S -c)** : fallback, sans Docker. Utile quand engine indisponible.
   - **Forcer Docker** : isolé max. Échoue si Docker pas installé.
4. Cliquer **Bouton Test dans sandbox**. → voyant "Running" clignote.

Après fin, badges résultats affichés (font-mono uppercase):
- `exitCode=0` = succès (vert). Autre valeur = échec (rouge).
- `durationMs=124` temps total (brain → sandbox) en millisecondes.
- `fuel=382` (si wasm) fuel wasmtime consommé ; pour skills python affiche approximatif instructions Python.
- `sandboxKind=docker-local` OU `python-local-fallback`. Si amber warning: "Fallback local utilisé, isolation moins stricte".

Panneau bas : sortie JSON brute (exemple `hello-somme`) :
```json
{"result": 42, "status": "ok", "skill": "hello-somme"}
```

### 7.4 Bandeau approbations (tout en haut SkillLab)

S'affiche automatiquement quand 1+ skill en attente. Boutons :
- Approver → skill passe statut `installed` immédiatement, disponible dans Tester.
- Rejeter → boîte de dialogue motif obligatoire min. 8 caractères (validation front + backend double garde 400 si < 8). Skill statut `rejected` (réapparaît pas Marketplace).

---

## 8. Commandes utiles qualimétrie vérifier que tout marche

À lancer chaque fois avant de distribuer ou de créer une PR git :

```powershell
# ==== REACT UI (qualim + tests unitaires) ====
cd antaerus\interfaces\web
npm run check            # TypeScript tsc typecheck, exit 0 = OK
npm run build            # Build production Vite dist/
npm run test -- --run    # Tests Vitest composants (voice/chat/mission/config ...)
npm run lint             # ESLint
npm run format:check     # Prettier

# ==== GATEWAY GO ====
cd ..\..\interfaces\gateway_go
go build ./...            # Compile tous packages
go test ./... -v          # Tests handlers + clients REST

# ==== BRAIN PYTHON ====
cd ..\..\providers\brain_python
py -3.11 -m ruff check src tests
py -3.11 -m mypy src --ignore-missing-imports
py -3.11 -m pytest tests -v      # Tous tests (memory/mission/proactive/skill registry/docker sandbox/synthesizer)

# ==== ENGINE RUST ====
cd ..\..\providers\engine_rust
$env:CARGO_TARGET_DIR = "$env:TEMP\cargo-engine-rust-2026"
cargo build --features wasm-runtime          # Build inclut sandbox M7
cargo test --features wasm-runtime --test wasm_executor   # 4 tests M7
cargo test --features wasm-runtime --lib     # Tests unitaires sandbox + grpc engine
```

Attendu : **Toutes les commandes retournent exit code 0, PAS d'erreurs FAIL.** (Si vous venez de livrer M7 c'est le cas.)

---

## 9. Dépannage fréquent FAQ

### Q1. Erreur navigateur Home : "Failed to fetch http://localhost:8080/api/v1/health"
Cause probable: Gateway Go pas démarré. Lancer `scripts\dev-all.ps1`.
Ou: firewall Windows bloque port 8080. Autoriser application `go.exe` dans Pare-feu Windows > Règles entrantes.

### Q2. Chat réponse vide : "Erreur fournisseur LLM indisponible"
- Vérifiez `.env` (dans antaerus/.env) : clé API copiée SANS espace ni guillemets.
- Testez directement URL brain: `Invoke-RestMethod http://localhost:8000/health`. Doit répondre `{"status":"ok","version":"0.1.0"}`.
- Si Ollama: `ollama list` dans un terminal montre modèle ? Sinon `ollama pull llama3.1:8b`.

### Q3. M7 SkillLab Docker échoue : "Sandbox échec exit 9009"
Cause Windows Store alias bug: `python.exe` pointe vers store et pas Python 3.11 installé.
Déjà FIXÉ code (`docker_sandbox.py` `_find_python() sys.executable PREMIER ordre`). Si vous rencontrez encore :
- Désactivez alias Windows Store : Paramètres > Apps > Avancé > Aliases d'exécution → mettre OFF "python.exe" / "python3.exe".
- Ou utilisez bouton Tester → "Forcer local" (marche toujours).

### Q4. Moteur Rust build erreur "output path is not writable"
Cause: build OneDrive restrictions. Appliquer :
```powershell
$env:CARGO_TARGET_DIR = "$env:TEMP\cargo-engine-rust-2026"
```
(Permanent: Variables d'environnement Utilisateur Windows → Ajouter CARGO_TARGET_DIR.)

### Q5. Voice M3 micro ne s'active pas / "Pas de périphérique"
- Vérifiez permissions Chrome > Paramètres > Confidentialité > Microphone → Autoriser localhost.
- Si vous utilisez IP autre que localhost: activez HTTPS ou flag Chrome `#unsafely-treat-insecure-origin-as-secure`.

### Q6. Skill reject demande motif, je mets "non" → erreur 400
Normal: règlement minimum 8 caractères. Écrivez : "Skill refusé car logique incorrecte".

### Q7. M5 Command Center initiatives vide (aucune carte)
Le Curateur nocturne tourne 2h UTC. Pour tester immédiatement déclenchement manuel :
```powershell
Invoke-RestMethod -Method POST http://localhost:8080/api/v1/proactive/curator/run-now -Headers @{Authorization="Bearer dev-jwt-gateway"}
# Puis rafraichir Command Center page (Ctrl+R)
```

### Q8. Memory Explorer graphe vide après 10 messages chat
Par défaut brain compacte mémoire toutes 100 conversations. Forcez synchro manuelle :
```powershell
Invoke-RestMethod -Method POST http://localhost:8080/api/v1/memory/flush
```

### Q9. Install VPS Hostinger Dokploy (production)
Utilisateur préfère `docker run` (pas docker compose). Exemple conteneur Gateway Go + Brain Python côté à côté :

```bash
# 1. Brain Python
docker run -d --name antaerus-brain --restart always \
  --network antaerus-net \
  -v /opt/antaerus/brain/data:/app/antaerus/providers/brain_python/memory_data \
  -v /opt/antaerus/.env:/app/antaerus/.env:ro \
  -p 8000:8000 \
  your-registry/antaerus-brain:latest \
  uvicorn antaerus_brain.api.main:app --host 0.0.0.0 --port 8000

# 2. Gateway Go (port 8080 -> reverse proxy HTTPS Nginx 443)
docker run -d --name antaerus-gateway --restart always \
  --network antaerus-net \
  -v /opt/antaerus/.env:/app/antaerus/.env:ro \
  -p 8080:8080 \
  your-registry/antaerus-gateway:latest

# 3. UI Web dist Nginx (HTTPS 443 certificat LetsEncrypt via certbot)
docker run -d --name antaerus-web --restart always \
  --network antaerus-net \
  -v /opt/antaerus/web/dist:/usr/share/nginx/html:ro \
  -v /opt/antaerus/web/nginx.conf:/etc/nginx/nginx.conf:ro \
  -p 80:80 -p 443:443 \
  nginx:1.27-alpine
```

### Q10. Mise à jour aNtaerus nouvelle version
```powershell
cd "n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus"
git pull origin main
cd antaerus\interfaces\web ; npm install ; cd ..\..\providers\brain_python ; py -3.11 -m pip install -r requirements.txt --upgrade
# Relance dev-all.ps1. Pour les migrations SQL de mémoire/registry SQLite, sont exécutées automatiquement au start brain.
```

---

## 10. Architecture 4 couches — comprendre le flux de données (rappel rapide utilisateur)

Utile quand on veut étendre :
```
[Utilisateur Navigateur React UI (L3 Interfaces)]
           |  REST /api/v1/* et WebSocket /ws
           v
[Go Gateway 8080 (L3 Proxy/rate limit/JWT auth)]
           |  HTTP interne JSON + headers Brain secret
           v
[Python Brain FastAPI 8000 (L2 Providers/logique)]
           |  gRPC / appel direct Rust Engine
           v
[Rust Engine 7000 (L0 Kernel/L1 Providers sandbox/voice)]
```

Flux M7 exemple installation skill → Exécution sandbox :
1. Clique "Installer" Marketplace React → POST http://localhost:5173/api/v1/skills → Proxifié Go Gateway 8080 → Transmis Brain 8000 `/skills`.
2. Brain lifecycle unpack tarball si .tar.gz, vérifie pas "../" escape, écrit SQLite registry table skills statut installed.
3. Quand SkillTester Run : POST `/api/v1/skills/:id/run` → brain → engine_rust sandbox docker/python-local/wasm selon runtime.
4. Gateway renvoie réponse JSON React → SkillTester affiche badges exitCode/duration/fuel.

---

## 11. Liens utiles dans le projet (code source fichiers)

- Backlog tasks : [tasks.md](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md) — voir tâches M0 à M7 cases [x].
- Cahier des charges CDC architecture 4 couches : [cahier-des-charges.md](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/cahier-des-charges.md)
- Exemple .env modèle : [antaerus/.env.example](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/.env.example)
- App Router React 13 pages (routes) : [App.tsx](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/App.tsx)
- Store Zustand état global slices : [useAppStore.ts](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/store/useAppStore.ts)
- Endpoints API TypeScript tous services (memory/skill/mission/analytics) : [api.ts](file:///n:/OneDrive%20-%20Université%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/api.ts)

---

## 12. Changelog rapide — nouveautés jalons M0 à M7

- **M0** : Fondation monorepo 4 couches, CI linting tooling, Secrets leak protection, gRPC/JSON/WS contrats interservices
- **M1** : Memory kernel SQLite, graphe Memory Explorer SVG
- **M2/M4** : Mission engine DAG planner, MissionCenter cards + TaskGraph, FactCard, voice
- **M3** : Chat texte streaming + Voice Micro STT/TTS temps réel useVAD hooks, VoiceVisualizer SVG
- **M5** : Moteur proactif, Curateur nocturne 2h UTC, InitiativeCard, AutonomySlider 0–5, workflow Approve/Reject
- **M6** : Polish UI glassmorphism dark theme, Setup Wizard 5 étapes, Analytics Metrics SVG, System Health cards, Bundle multiplateforme release scripts
- **M7** : **Skill Lab Marketplace/Editor/Tester 3 onglets**, Skill Registry brain SQLite, Go Gateway skills handler, Sandbox Python/Docker, Rust WASM wasmtime sandbox fuel, Skill Editor textarea custom zero-dépendance localStorage, bandeau approbations motif min. 8 caractères.

Bon usage.
