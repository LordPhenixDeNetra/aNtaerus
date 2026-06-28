# aNtaerus

`aNtaerus` est la fondation d'un assistant IA self-hosted polyglotte construite autour de `React`, `Go`, `Python` et `Rust`, désormais structurée sous `antaerus/` selon les couches `L0 -> L3`.

## Phase Courante

Cette livraison met en place une base exécutable :
- `interfaces/web/` : dashboard de fondation
- `interfaces/gateway_go/` : agrégation d'état et API système
- `providers/brain_python/` : service Python minimal
- `providers/engine_rust/` : service Rust minimal
- `kernel/` : contrats, settings, permissions, approval, notifications
- `engine/` : bootstrap d'orchestration

## Prérequis

- Node.js 20+
- npm 10+
- Go 1.22+
- Python 3.11+
- Rust stable
- Docker Desktop (optionnel pour `docker-compose`)

## Structure

```text
antaerus/
├── docs/
├── engine/
├── interfaces/
│   ├── gateway_go/
│   └── web/
├── kernel/
├── providers/
│   ├── brain_python/
│   └── engine_rust/
└── scripts/
```

## Démarrage Natif

### Windows

```powershell
cd antaerus
./scripts/dev-brain.ps1
./scripts/dev-engine.ps1
./scripts/dev-gateway.ps1
./scripts/dev-web.ps1
```

### Unix

```bash
cd antaerus
./scripts/dev-brain.sh
./scripts/dev-engine.sh
./scripts/dev-gateway.sh
./scripts/dev-web.sh
```

## Démarrage Standardisé

```bash
cd antaerus
docker compose up --build
```

## Endpoints Utiles

- frontend : `http://localhost:5173`
- gateway : `http://localhost:8080`
- brain : `http://localhost:8000`
- engine : `http://localhost:7000`

## Vérification

- `interfaces/web/` : `npm install && npm run check && npm run build && npm run test`
- `antaerus/` : `go test ./interfaces/gateway_go/...`
- `providers/brain_python/` : `python -m pytest`
- `providers/engine_rust/` : `cargo test`

## Documents

- [PRD fondation](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.trae/documents/antaerus-prd-fondation.md)
- [Architecture technique](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.trae/documents/antaerus-architecture-technique.md)
