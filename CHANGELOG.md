# Changelog

Toutes les évolutions notables de `aNtaerus` seront documentées dans ce fichier.

Le format s'inspire de `Keep a Changelog` et ce projet suit une progression par jalons.

## [Unreleased]

### Documentation

- Ajout d'un `README.md` racine orienté open source
- Ajout de `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` et `SECURITY.md`
- Initialisation du présent `CHANGELOG.md`

## Fondation et jalons déjà livrés

### M0 - Fondation

- Mise en place du monorepo sous `antaerus/`
- Outillage CI, scripts de démarrage et conventions de sécurité
- Contrats inter-services et schémas partagés

### M1.1 - Gateway Go

- Infrastructure socle du gateway
- Authentification JWT pour REST et WebSocket
- Rate limiting HTTP et WebSocket

### M1.2 - Brain Python

- Routes LLM et mémoire documentées et validées
- Vérifications `pytest`, `mypy` et `ruff`

### M1.3 - Web UI

- UI React/Vite avec `Chat`, `Setup` et store local
- Build statique servie par le gateway Go

### M1.4 - Intégration texte

- Flux texte complet `React -> Go -> Python -> Go -> React`
- Persistance SQLite de l'historique par session
- Hydratation d'historique côté UI et smoke dédié
