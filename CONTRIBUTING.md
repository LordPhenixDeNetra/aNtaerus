# Contribuer à aNtaerus

Merci de votre intérêt pour `aNtaerus`.

Ce dépôt est un monorepo open source en construction active. Les contributions sont bienvenues, à condition de respecter les conventions techniques et documentaires déjà en place.

## Avant de commencer

- Vérifiez d'abord si le besoin existe déjà dans `tasks.md`.
- Lisez le `README.md` racine et les README de sous-modules concernés.
- Préférez les changements ciblés, cohérents avec le jalon en cours.

## Principes du dépôt

- Toute la structure active doit rester sous `antaerus/`.
- Ne dupliquez pas des modules actifs à la racine du dépôt.
- La documentation et le backlog doivent évoluer avec le code.
- Les secrets ne doivent jamais être commités ou affichés en clair.

## Workflow recommandé

1. Ouvrir une issue ou commenter une issue existante si le changement est important.
2. Créer une branche dédiée.
3. Faire des commits ciblés et lisibles.
4. Mettre à jour la documentation impactée.
5. Mettre à jour `tasks.md` lorsque l'avancement d'un jalon change réellement.
6. Ouvrir une Pull Request décrivant clairement le périmètre et les validations effectuées.

## Attentes qualité

Selon les zones touchées, rejouez les vérifications pertinentes.

### Web

```bash
cd antaerus/interfaces/web
npm install
npm run lint
npm run check
npm run test
npm run build
```

### Gateway Go

```bash
cd antaerus
go test ./interfaces/gateway_go/...
```

### Brain Python

```bash
cd antaerus/providers/brain_python
python -m pip install -e .[dev]
python -m ruff check .
python -m mypy src tests
python -m pytest tests
```

### Engine Rust

```bash
cd antaerus/providers/engine_rust
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

## Documentation attendue

Si votre changement touche le comportement utilisateur, l'architecture, la sécurité ou le setup :

- mettez à jour le `README.md` concerné
- mettez à jour `tasks.md` si une étape est réellement livrée
- évitez les documents vagues ou obsolètes

## Sécurité

- Ne commitez jamais de `.env` réel.
- N'ajoutez pas de clés API, JWT, tokens, mots de passe ou secrets de test plausibles.
- Si vous découvrez une vulnérabilité, suivez `SECURITY.md` au lieu d'ouvrir immédiatement une issue publique.

## Pull Requests

Une bonne PR doit contenir :

- le contexte du changement
- les fichiers principaux modifiés
- les validations exécutées
- les risques ou limites connus
- les mises à jour de documentation associées

## Style de collaboration

- Soyez factuel et respectueux.
- Préférez les changements testables.
- Évitez les réécritures massives hors besoin explicite.
- N'ajoutez pas de dépendance lourde sans justification claire.

## Licence

En contribuant au projet, vous acceptez que votre contribution soit distribuée sous la licence `MIT` du dépôt.
