# aNtaerus — Normes de codage (obligatoires, IA comprises)

> **VERSION IMPRATIQUE : RÈGLE N°1, LA PLUS IMPORTANTE, TOUJOURS EN HAUT.**
> Toute personne (ou agent IA / assistant de code) qui modifie ce dépôt DOIT
> respecter ces règles. Toute contribution qui viole la RÈGLE 1 sera refusée
> automatiquement.

---

## RÈGLE 1 — ZÉRO EMOJI / PICTOGRAMME UNICODE DANS LES FICHIERS SOURCE

### Portée
S'applique à TOUS les fichiers sous contrôle de version :
```
*.py  *.go  *.ts  *.tsx  *.js  *.jsx  *.yaml  *.yml  *.toml  *.json
*.css  *.html  *.rs  *.ini  *.cfg  *.proto  *.md   *.rst
```

**Sont exclus de cette règle (aucun impact build/encodage) :**
- Dossiers ignorés par git (node_modules, dist, bin, target, memory_data, .git, .venv, __pycache__)
- Images binaires (PNG/JPG/SVG/WOFF/WOFF2)
- Base de données SQLite

### Ce qui est INTERDIT (exemples non exhaustifs)
- Smiley / pictos U+1Fxxx : 🤖 📋 👨‍💻 🧑‍💻 👩‍💼 💻 📁 📧 🌐 🧠 🌤 ⭐ ❗ ❓ ✅ ❌ 🚫 🔥
- Petits pictos U+2xxx : ℹ️ U+2139 ⚠️ U+26A0 ✅ U+2705 ❌ U+274C ⭐ U+2B50 ❓ U+2753 ❕ U+2755
- Marques Unicode : ™ (U+2122) ® (U+00AE) © (U+00A9) — remplacer par `(TM)`, `(R)`, `(C)` en ASCII.

### Ce qui est AUTORISÉ
- Lettres accentuées ISO-8859-1 : é è à ç ô ï etc. (français autorisé, ça marche partout)
- Flèches d'illustration U+2190..U+21FF (→ ← ↔ ↕ ↗) **dans les fichiers markdown uniquement** (.md, .rst).
  > NOTE : Pour les fichiers SOURCE non-MD (.py/.go/.tsx/.yaml etc.), UTILISER `->` ASCII au lieu de `→`.
- Tout autre caractère ASCII pur (U+0020 à U+007E).

### Remplacement syntaxique standard
| Interdit | Remplacer par (ASCII / texte simple) |
|----------|--------------------------------------|
| ℹ️  U+2139 | `[INFO]` ou `[INFO]` en commentaire |
| ⚠️  U+26A0 | `[WARN]` ou `[WARNING]` |
| ✅  U+2705 | `[OK]` ou `PASS` / `OK` en lettres |
| ❌  U+274C | `[KO]` ou `FAIL` / `ERR` |
| ⭐  U+2B50 | `[IMPORTANT]` ou `[NEW]` / `-- NEW --` |
| 🔥  U+1F525 | `[HOT]` |
| 📋  U+1F4CB | `[LIST]` ou écrire `Note:` |
| 👨‍💻 / 🧑‍💻 / 👩‍💼 (tous emoji métier) | `[DEV]`, `[UI]`, `[ENV]`, `[OPS]`, `[PROD]`, `[ADMIN]` |
| 💻 📁 📧 🌐 🧠 🌤 (emoji de catégorie) | `[N]` avec N numéro, ou `[CATEGORIE]` en lettres |
| ™ / ® / © | `(TM)` / `(R)` / `(C)` |

### Comment vérifier (scanner anti-emoji)
Exécuter le script de vérification (PowerShell / Bash) avant commit :
```powershell
# Windows PowerShell
python.exe scripts/lint/scan_emoji.py
# -> Retourne exit code != 0 si emoji interdit trouve dans SOURCE.
```

---

## RÈGLE 2 — Encodage & fin de ligne

- **Tous les fichiers texte = UTF-8 SANS BOM** (UTF-8 strict, pas `\xEF\xBB\xBF` en tête).
- **Fin de ligne** : `LF` (`\n`). Pas de `CRLF` Windows dans les fichiers suivis. Configurer
  `.gitattributes` (voir fichier à la racine).
- **Pas de caractère de contrôle inutile** : Tab = 0? Non, utiliser espaces (voir RÈGLE 3).

---

## RÈGLE 3 — Indentation & style par langage

| Langage | Indentation | Ligne max | Formatteur / Linter recommandé |
|---------|-------------|-----------|---------------------------------|
| Python  | 4 espaces   | 100       | `ruff format` + `ruff check` + `mypy --strict` (opt-in) |
| Go      | gofmt (tab) | 120       | `gofmt -w` + `go vet ./...`     |
| Rust    | 4 espaces   | 100       | `cargo fmt` + `cargo clippy`    |
| TS / TSX (React) | 2 espaces | 120 | Prettier (ou Vite/tsc avec `check`) — `npm run check` (tsc -b --noEmit) |
| YAML    | 2 espaces   | 140       | yamllint (interdit tabs)        |
| Shell / PowerShell | 2 ou 4 espaces | 140 | shellcheck (bash) / PSScriptAnalyzer |

---

## RÈGLE 4 — Commentaires : Français autorisé, mais lisible

- Les commentaires en **français sont acceptés** (maîtrisé par l'équipe) mais on peut aussi
  écrire en anglais. Pas de mélange French-English "Franglais" dans le même bloc de commentaire.
- **Ne jamais traduire les noms de symboles** d'une API publique : noms d'export TS, fonctions Go,
  classes Python doivent rester en anglais (`MissionCard` reste `MissionCard`).
- Rien d'interdit dans les commentaires sauf la RÈGLE 1.

---

## RÈGLE 5 — Nommage (conservation)

- **Ne jamais renommer** un export / champ JSON / endpoint HTTP / clé YAML publique sans
  **compatibilité ascendante** : ajouter le nouveau champ, lire l'ancien en fallback
  pendant au moins 2 versions majeures.
- Toujours préfixer `_` (ou commentaire `// PRIVATE`) pour un symbole interne non destiné à
  être utilisé hors du module.

---

## RÈGLE 6 — Chemins, secrets et `.gitignore`

- **Jamais** de chemins absolus spécifiques utilisateur du type `C:/Users/DELL/...` ou
  `/home/jean/...` dans les fichiers .yaml / .toml / .json suivis.
  Utiliser variables d'environnement (`${VAR}`), ou chemins relatifs sandbox.
- **Jamais** de secrets en dur (clé API Google, mot de passe, token). Toujours passer par
  `.env` (lui-même dans `.gitignore`) + instructions `config/`.
- Fichiers à **ne jamais committer** : `config/google_credentials.json`, `config/*token*.json`,
  `antaerus/memory_data/*.db`, `antaerus/memory_data/*.sqlite*`, `.env.local`.

---

## RÈGLE 7 — Conventions React / UI

- Même si l'UI affiche des **icônes** à l'écran : **Toujours utiliser une Icône SVG via composant
  React (lucide-react, heroicons, custom SVG)**, JAMAIS un emoji Unicode dans le code source.
  - BIEN : `<CheckCircle className="h-4 w-4" />` (lucide-react)
  - MAL : `completed: "✅"` (emoji dans une string) → remplacer par `[OK]` ASCII + style CSS.
- `npm run check` DOIT passer (tsc -b --noEmit) **avant tout commit modifiant les TSX / TS**.

---

## RÈGLE 8 — Gateways, endpoints HTTP

- **PAS DE BYPASS** : Tous les appels React → Brain Python DOIVENT transiter par le
  Gateway Go `/api/v1/*`. Jamais d'appel direct `fetch(http://127.0.0.1:5050/...)`
  depuis le frontend.
- Toute nouvelle route `/api/v1/xxx` est documentée dans le fichier correspondant
  sous `gateway_go/internal/http/*_proxy.go` (ou handler).

---

## RÈGLE 9 — Tests & builds obligatoires (avant Push / PR)

Commande à exécuter avant chaque commit significatif :

| Couche | Commande | Doit retourner |
|--------|----------|----------------|
| Web React | `cd antaerus/interfaces/web && npm run check` | exit 0 |
| Gateway Go | `cd antaerus && go build ./...` + `go test ./internal/...` | exit 0, PASS |
| Brain Python | `cd antaerus/providers/brain_python && ruff check src/` + `pytest -q` (ou -m "not integration") | All checks passed |
| Engine Rust | `cargo build` + `cargo test -q` (ou selon features) | exit 0 |

---

## RÈGLE 10 — Modifier ces normes

Ces normes évoluent. Pour modifier :
1. Modifier `CODING_STANDARDS.md` (ce fichier).
2. Incrémenter la date de dernière révision en bas.
3. Mentionner la règle modifiée dans le message de commit.

---

Dernière révision : 2026-08-26 — Ajout RÈGLE 1 (anti-emoji) après observation d'erreurs
d'encodage cp1252 sur PowerShell Windows lors de l'usage d'emojis 📋 👨‍💻 ℹ️ dans des
commentaires YAML.
