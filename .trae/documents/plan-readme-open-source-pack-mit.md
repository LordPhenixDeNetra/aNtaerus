# Plan d'exécution — README open source complet + pack communautaire MIT

## Résumé

Objectif : transformer la documentation racine de `aNtaerus` en un package open source conventionnel et publiable, en s'appuyant sur la structure réelle du dépôt, avec :

- un `README.md` racine complet, orienté GitHub/open source ;
- une licence `MIT` ;
- les fichiers communautaires et de gouvernance minimaux attendus pour un dépôt public :
  - `LICENSE`
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md`
  - `SECURITY.md`
  - `CHANGELOG.md`

Succès attendu :

- le dépôt présente clairement la proposition de valeur, la stack, l'état actuel, l'installation, la configuration, les modes de lancement et la feuille de route ;
- les attentes open source sont explicites pour contributeurs et utilisateurs ;
- la licence est nette et cohérente avec le positionnement open source choisi ;
- la documentation existante du monorepo n'est pas contredite mais réorganisée de façon conventionnelle.

## Analyse de l'état actuel

### Fichiers présents

- Le dépôt contient déjà un [README racine](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/README.md) technique, utile pour l'équipe, mais encore centré sur l'état de livraison interne du projet.
- Le monorepo réel est structuré sous `antaerus/` avec :
  - `interfaces/web/`
  - `interfaces/gateway_go/`
  - `providers/brain_python/`
  - `providers/engine_rust/`
  - `kernel/`
  - `engine/`
- Des README de sous-modules existent déjà pour `web` et `brain_python`.
- Des documents techniques existent déjà sous `.trae/documents/` et `antaerus/docs/`.

### Fichiers absents

- Aucun `LICENSE`
- Aucun `CONTRIBUTING.md`
- Aucun `CODE_OF_CONDUCT.md`
- Aucun `SECURITY.md`
- Aucun `CHANGELOG.md`

### Contraintes déjà visibles dans le backlog

Le backlog mentionne explicitement :

- `README.md` présentation/installation/démarrage rapide ;
- `CHANGELOG.md` ;
- `CONTRIBUTING.md` ;
- `CODE_OF_CONDUCT.md` ;
- choix de licence.

Ces artefacts sont donc cohérents avec la direction produit et ne constituent pas un ajout hors-scope.

## Hypothèses et décisions

- Licence retenue : **MIT**
- Périmètre retenu : **pack complet**
- Le README racine cible avant tout :
  - visiteurs GitHub ;
  - utilisateurs techniques qui veulent tester le projet ;
  - futurs contributeurs open source.
- Le README ne doit pas être un dump exhaustif de tous les détails internes ; il doit renvoyer vers les sous-README et docs spécialisées pour les détails fins.
- La documentation produite doit être cohérente avec l'état réel du projet aujourd'hui :
  - fondation livrée ;
  - chat texte intégré jusqu'à `M1.4` ;
  - roadmap encore ouverte sur voix, tools, mission engine, proactive, polish, bundle et release.

## Changements proposés

### 1. Refonte du `README.md` racine

#### Fichier à modifier

- `antaerus/README.md`

#### Action

- remplacer l'approche actuelle, très orientée "état de lot", par un README open source conventionnel ;
- structurer le contenu avec les sections utiles sur GitHub :
  - nom et proposition de valeur ;
  - vision produit / ce que fait `aNtaerus` ;
  - statut du projet ;
  - fonctionnalités actuelles ;
  - architecture monorepo ;
  - stack technique ;
  - prérequis ;
  - installation rapide ;
  - configuration via `.env` ;
  - démarrage local natif et `docker compose` ;
  - commandes de validation ;
  - roadmap / état d'avancement ;
  - documentation associée ;
  - contribution ;
  - sécurité ;
  - licence.

#### Pourquoi

- c'est la première entrée publique du dépôt et le document qui donne le ton open source.

### 2. Ajouter la licence MIT

#### Fichier à créer

- `LICENSE`

#### Action

- ajouter le texte standard complet de la licence `MIT` ;
- harmoniser la mention de licence dans le `README`.

#### Pourquoi

- un projet open source public sans `LICENSE` est juridiquement ambigu pour les utilisateurs et contributeurs.

### 3. Ajouter un `CONTRIBUTING.md`

#### Fichier à créer

- `CONTRIBUTING.md`

#### Action

- définir les règles minimales de contribution adaptées au dépôt actuel :
  - principe monorepo ;
  - obligation de rester sous `antaerus/` ;
  - mise à jour de `tasks.md` après avancement validé ;
  - attentes de tests/lint/typecheck selon les stacks ;
  - pas de secrets dans le dépôt ;
  - style de PR / issues.

#### Pourquoi

- le projet a déjà des conventions fortes ; sans fichier de contribution, elles restent implicites.

### 4. Ajouter un `CODE_OF_CONDUCT.md`

#### Fichier à créer

- `CODE_OF_CONDUCT.md`

#### Action

- utiliser une base conventionnelle et concise, typiquement inspirée du `Contributor Covenant`, adaptée au contexte d'un dépôt public ;
- inclure les comportements attendus et le canal de signalement.

#### Pourquoi

- c'est un standard communautaire attendu pour un projet open source public.

### 5. Ajouter un `SECURITY.md`

#### Fichier à créer

- `SECURITY.md`

#### Action

- définir la manière de signaler une vulnérabilité ;
- rappeler les règles de non-publication de secrets et de divulgation responsable ;
- renvoyer vers `antaerus/docs/security/SECRETS.md` pour les pratiques techniques déjà documentées.

#### Pourquoi

- le projet manipule déjà des secrets, des tokens JWT et des providers externes ; il faut une entrée de sécurité publique claire.

### 6. Ajouter un `CHANGELOG.md`

#### Fichier à créer

- `CHANGELOG.md`

#### Action

- initialiser un changelog conventionnel avec une structure lisible (`Unreleased`, puis jalons déjà livrés si pertinent) ;
- refléter les livraisons déjà effectives au minimum :
  - fondation `M0`
  - gateway `M1.1`
  - brain `M1.2`
  - UI core `M1.3`
  - intégration texte `M1.4`

#### Pourquoi

- le backlog mentionne déjà le besoin de changelog, et un dépôt public gagne à afficher son historique même minimal.

### 7. Relier proprement le README aux documents existants

#### Fichiers à modifier

- `antaerus/README.md`

#### Action

- ajouter des liens vers les ressources déjà présentes :
  - `antaerus/interfaces/web/README.md`
  - `antaerus/providers/brain_python/README.md`
  - `antaerus/docs/security/SECRETS.md`
  - `.trae/documents/` seulement si pertinent pour des docs publiques, sinon éviter de trop exposer des artefacts de travail internes.

#### Décision retenue

- privilégier les docs sous `antaerus/` et limiter la dépendance du README public aux documents `.trae/`, qui sont davantage des artefacts de travail.

#### Pourquoi

- un README public doit renvoyer vers des documents stables et compréhensibles pour les utilisateurs externes.

### 8. Harmoniser la terminologie open source du projet

#### Fichiers à modifier

- `antaerus/README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`

#### Action

- utiliser un ton cohérent et conventionnel :
  - "open source"
  - "self-hosted"
  - "monorepo"
  - "currently available"
  - "roadmap"
  - "contributing"
- rester cohérent avec la langue du dépôt actuel : README principal en français, avec noms techniques en anglais si nécessaire.

#### Pourquoi

- il faut une présentation lisible pour un public open source tout en respectant votre préférence de travail en français.

## Fichiers concernés à l'exécution

- `antaerus/README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `CHANGELOG.md`
- éventuellement `tasks.md` si l'on décide de refléter l'avancement documentaire dans le backlog

## Hors périmètre volontaire

- refonte complète des sous-README `web` / `brain_python`
- création de tous les docs `docs/architecture/*` ou `docs/development/*` encore prévus au backlog
- publication GitHub réelle, release, tags ou annonce communautaire
- audit juridique des dépendances tierces

## Vérifications

### Vérifications de contenu

- le README répond à un lecteur GitHub qui découvre le projet ;
- la licence MIT est cohérente et explicitement mentionnée ;
- les règles de contribution sont exploitables ;
- les pratiques de sécurité sont clairement indiquées ;
- le changelog initial n'invente pas des fonctionnalités non présentes.

### Vérifications techniques

- diagnostics éditeur sans erreur sur les fichiers Markdown créés/modifiés ;
- liens de chemins internes cohérents ;
- terminologie alignée avec l'état réel du dépôt.

## Résultat attendu

À la fin, `aNtaerus` dispose d'une façade open source conventionnelle et crédible :

- un `README.md` public, complet et lisible ;
- une licence `MIT` explicite ;
- un minimum viable de gouvernance open source ;
- une base propre pour publier et faire contribuer la communauté autour du projet.
