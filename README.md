# aNtaerus

`aNtaerus` est la fondation d'un assistant IA self-hosted polyglotte construit autour de `React`, `Go`, `Python` et `Rust`.

## Phase Courante

Cette livraison met en place une base exécutable :
- `web/` : dashboard de fondation
- `gateway_go/` : agrégation d'état et API système
- `brain_python/` : service Python minimal
- `engine_rust/` : service Rust minimal

## Prérequis

- Node.js 20+
- npm 10+
- Go 1.22+
- Python 3.11+
- Rust stable
- Docker Desktop (optionnel pour `docker-compose`)

## Structure

```text
aNtaerus/
├── .trae/documents/
├── brain_python/
├── contracts/
├── docs/
├── engine_rust/
├── gateway_go/
├── scripts/
└── web/
```

## Démarrage Natif

### Windows

```powershell
./scripts/dev-brain.ps1
./scripts/dev-engine.ps1
./scripts/dev-gateway.ps1
./scripts/dev-web.ps1
```

### Unix

```bash
./scripts/dev-brain.sh
./scripts/dev-engine.sh
./scripts/dev-gateway.sh
./scripts/dev-web.sh
```

## Démarrage Standardisé

```bash
docker compose up --build
```

## Endpoints Utiles

- frontend : `http://localhost:5173`
- gateway : `http://localhost:8080`
- brain : `http://localhost:8000`
- engine : `http://localhost:7000`

## Vérification

- `web/` : `npm install && npm run check && npm run build && npm run test`
- `gateway_go/` : `go test ./...`
- `brain_python/` : `python -m pytest`
- `engine_rust/` : `cargo test`

## Documents

- [PRD fondation](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.trae/documents/antaerus-prd-fondation.md)
- [Architecture technique](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.trae/documents/antaerus-architecture-technique.md)
