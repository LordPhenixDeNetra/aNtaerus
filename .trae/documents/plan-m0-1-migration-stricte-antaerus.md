## Résumé

Objectif : exécuter `M0.1 — Architecture & Bootstrap` de manière **stricte**, en alignant réellement le dépôt sur la cible `antaerus/` décrite dans `tasks.md` et dans `cahier-des-charges.md`, tout en mettant `tasks.md` à jour après chaque sous-tâche validée.

Le périmètre couvre :
- la migration structurelle du dépôt vers un conteneur racine `antaerus/`
- la matérialisation explicite des 4 couches `L0 -> L3`
- la création du noyau `kernel/`
- l’introduction des modules `settings/`, `permissions/`, `approval/`, `notifications/`
- l’écriture des bootstraps `Go`, `Python`, `Rust`
- la définition initiale des interfaces/protocoles entre couches
- la mise à jour continue de `tasks.md`

Décision utilisateur verrouillée :
- migration **stricte** vers `antaerus/`
- **rupture acceptée**

## Analyse De L’État Actuel

État observé du dépôt :
- le dépôt actuel est structuré à la racine autour de `web/`, `gateway_go/`, `brain_python/`, `engine_rust/`, `contracts/`, `docs/`, `scripts/`
- `M0.1` dans `tasks.md` exige explicitement une structure `antaerus/` et la règle critique `zéro fichier hors package antaerus/`
- `cahier-des-charges.md` confirme cette cible avec :
  - architecture en couches `L0 -> L3`
  - principe `Tout est sous antaerus/`
  - présence prévue de `kernel/`, `permissions/`, `approval/`, `notifications/`, `bootstrap.go`
- l’architecture technique actuelle dans `.trae/documents/antaerus-architecture-technique.md` reflète encore une fondation pragmatique à la racine, donc elle est en écart avec `M0.1`

Écarts majeurs à résorber :
- absence de dossier racine `antaerus/`
- absence de séparation formelle des couches `L0`, `L1`, `L2`, `L3`
- absence de `kernel/` transverse
- absence des modules `permissions/`, `approval/`, `notifications/`
- absence des bootstraps `bootstrap.go`, `bootstrap.py`, `bootstrap.rs`
- absence de définition explicite des interfaces/protocoles inter-couches
- présence de plusieurs entrées et manifests à la racine qui violent la cible finale

## Changements Proposés

### 1. Réorganiser Le Dépôt Sous `antaerus/`

Fichiers et dossiers actuels concernés :
- `web/`
- `gateway_go/`
- `brain_python/`
- `engine_rust/`
- `contracts/`
- `docs/`
- `scripts/`
- `docker-compose.yml`
- `README.md`

Nouvelle structure cible :
- `antaerus/kernel/`
- `antaerus/providers/`
- `antaerus/engine/`
- `antaerus/interfaces/`

Répartition proposée :
- `web/` -> `antaerus/interfaces/web/`
- `gateway_go/` -> `antaerus/interfaces/gateway_go/`
- `brain_python/` -> `antaerus/providers/brain_python/`
- `engine_rust/` -> `antaerus/providers/engine_rust/`
- `contracts/` -> `antaerus/kernel/schemas/`
- `docs/` -> `antaerus/docs/`
- `scripts/` -> `antaerus/scripts/`

Pourquoi :
- matérialiser immédiatement la structure L0-L3 demandée
- supprimer la divergence entre le dépôt réel et le cahier des charges

Comment :
- déplacer les dossiers existants vers leurs nouvelles destinations
- corriger tous les chemins, imports, modules, commandes et documentations impactés
- conserver à la racine uniquement ce qui est strictement indispensable au pilotage du projet :
  - `.git*`
  - `.github/`
  - `.trae/`
  - `tasks.md`
  - `cahier-des-charges.md`

Décision stricte :
- aucun shim de compatibilité durable ne sera conservé à la racine pour les services déplacés

### 2. Matérialiser Les 4 Couches L0 → L3

Nouveaux dossiers à créer :
- `antaerus/kernel/` pour `L0`
- `antaerus/providers/` pour `L1`
- `antaerus/engine/` pour `L2`
- `antaerus/interfaces/` pour `L3`

Pourquoi :
- `M0.1` demande explicitement une structure de couches
- aujourd’hui seules des briques fonctionnelles existent, sans organisation de couches visible

Comment :
- `L0 / kernel` : contient les contrats, schémas, événements, erreurs, chemins, permissions, approval, notifications, settings
- `L1 / providers` : contient les services techniques Python et Rust
- `L2 / engine` : contient le futur cœur d’orchestration transversal, même si son implémentation reste encore squelettique dans cette étape
- `L3 / interfaces` : contient les points d’entrée utilisateur et réseau

Livrable attendu :
- la hiérarchie du dépôt permet de lire directement l’architecture cible depuis l’arborescence

### 3. Créer Le Noyau `kernel/`

Nouveaux éléments à créer :
- `antaerus/kernel/contracts/`
- `antaerus/kernel/contracts/contracts.go`
- `antaerus/kernel/contracts/contracts.rs`
- `antaerus/kernel/contracts/contracts.py`
- `antaerus/kernel/schemas/`
- `antaerus/kernel/events/`
- `antaerus/kernel/errors/`
- `antaerus/kernel/paths/`

Pourquoi :
- `M0.1` exige ce noyau transverse
- les contrats actuels sont limités à des JSON Schema dans `contracts/`, sans noyau d’architecture commun

Comment :
- déplacer les schémas JSON existants vers `antaerus/kernel/schemas/`
- créer des fichiers de contrats minimaux par langage définissant :
  - santé de service
  - capacités de service
  - statut système
- créer des modules squelettiques documentés pour :
  - événements
  - erreurs
  - chemins

Décision :
- les contrats seront d’abord minimaux mais concrets, alignés sur l’état réel déjà présent
- ne pas inventer tout le périmètre final de `M3+` dans cette étape

### 4. Implémenter `settings/` Au Niveau L0

Nouveaux éléments à créer :
- `antaerus/kernel/settings/config.go`
- `antaerus/kernel/settings/config.py`
- `antaerus/kernel/settings/config.rs`

Pourquoi :
- `M0.1` exige une base de configuration immuable transverse
- le dépôt possède déjà des configurations locales dans chaque service, mais pas de point d’architecture L0

Comment :
- extraire ou répliquer la logique de configuration minimale existante vers le noyau
- introduire :
  - Go : base de config immuable, idéalement compatible avec le futur usage Viper
  - Python : usage explicite de `pydantic.SecretStr`
  - Rust : usage explicite de `secrecy::SecretString`

Décision d’étape :
- même si `M0.4` traitera davantage la sécurité, `M0.1` doit déjà poser les types et emplacements structurels attendus

### 5. Créer `permissions/`, `approval/`, `notifications/`

Nouveaux éléments à créer :
- `antaerus/kernel/permissions/`
- `antaerus/kernel/approval/`
- `antaerus/kernel/notifications/`

Pourquoi :
- ces modules sont explicitement listés dans `M0.1`
- ils n’existent pas encore dans le dépôt

Comment :
- `permissions/` : définir les rôles de base et les niveaux d’autonomie `0-5`
- `approval/` : définir le modèle de gate composite `risque × catégorie × budget`
- `notifications/` : poser un contrat de bus d’événements cross-langage et une première structure de message

Décision :
- pour cette étape, viser une implémentation squelettique mais réelle, suffisamment concrète pour être importée et testée
- ne pas attendre `M5` pour introduire les concepts structurants

### 6. Écrire Les Bootstraps `Go`, `Python`, `Rust`

Nouveaux éléments à créer :
- `antaerus/engine/bootstrap.go`
- `antaerus/providers/brain_python/bootstrap.py`
- `antaerus/providers/engine_rust/bootstrap.rs`

Fichiers actuels à adapter :
- `gateway_go/cmd/gateway/main.go`
- `brain_python/src/antaerus_brain/app.py`
- `engine_rust/src/main.rs`

Pourquoi :
- les services démarrent aujourd’hui directement depuis leurs `main/app`, sans composition root explicite
- `M0.1` exige des bootstraps

Comment :
- introduire un bootstrap central par runtime qui assemble :
  - settings
  - contrats
  - composants locaux
  - dépendances de service
- faire en sorte que les points d’entrée existants délèguent au bootstrap

Décision :
- `bootstrap.go` devient la composition root principale côté Go
- `bootstrap.py` et `bootstrap.rs` reflètent la même logique à leur échelle

### 7. Définir Les Protocols / Interfaces Entre Couches

Nouveaux éléments à créer :
- `antaerus/kernel/contracts/protocols.go`
- `antaerus/kernel/contracts/protocols.py`
- `antaerus/kernel/contracts/protocols.rs`

Pourquoi :
- `M0.1` demande explicitement les interfaces entre couches
- aujourd’hui les frontières existent surtout de façon implicite

Comment :
- formaliser les interfaces minimales nécessaires pour la fondation déjà livrée :
  - lecture de santé
  - lecture de capacités
  - agrégation de statut
  - notification d’événements système
- utiliser :
  - interfaces Go
  - `Protocol` Python
  - traits Rust

Résultat attendu :
- les couches échangent par contrats explicitement nommés et localisés dans `kernel`

### 8. Mettre À Jour Les Toolings Et Chemins Impactés Par La Migration

Fichiers à adapter :
- `antaerus/interfaces/web/package.json`
- `antaerus/interfaces/web/vite.config.ts`
- `antaerus/interfaces/gateway_go/go.mod`
- `antaerus/providers/brain_python/pyproject.toml`
- `antaerus/providers/engine_rust/Cargo.toml`
- `antaerus/scripts/dev-*`
- `docker-compose.yml`
- `README.md`
- `.github/workflows/ci.yml`

Pourquoi :
- la migration stricte casse les chemins actuels
- les scripts, builds et tests doivent pointer vers la nouvelle structure

Comment :
- corriger les `working-directory`
- corriger les chemins d’import et les chemins de lancement
- corriger les références documentaires et d’installation

### 9. Mettre `tasks.md` À Jour Pendant Le Chantier

Fichier à modifier :
- `tasks.md`

Pourquoi :
- exigence utilisateur explicite
- règle projet déjà inscrite dans le backlog

Comment :
- avant d’attaquer une sous-tâche de `M0.1`, repérer la ligne correspondante
- après validation réelle, cocher immédiatement la sous-tâche
- si une sous-tâche reste partielle, la laisser ouverte et ajouter un état intermédiaire bref

Sous-tâches de `M0.1` à synchroniser explicitement :
- structure `antaerus/`
- création `kernel/`
- `settings/`
- `permissions/`
- `approval/`
- `notifications/`
- `bootstrap.go`
- `bootstrap.py`
- `bootstrap.rs`
- protocols/interfaces
- règle zéro shim hors `antaerus/`

## Hypothèses Et Décisions

- l’utilisateur veut une migration stricte et accepte les ruptures
- `tasks.md` doit être mis à jour au fil du chantier, pas seulement à la fin
- `cahier-des-charges.md` reste la référence cible et n’est pas modifié dans ce chantier, sauf si un conflit majeur d’architecture apparaît
- la priorité est de rendre la structure conforme à `M0.1`, quitte à casser les chemins actuels puis les réparer dans le même chantier
- les livrables de `M0.1` seront réels mais encore squelettiques sur certaines briques de domaine

## Étapes D’Exécution Recommandées

1. Relire `tasks.md`, `cahier-des-charges.md` et les documents `.trae/documents/` utiles.
2. Déplacer les blocs existants sous `antaerus/` selon la cartographie décidée.
3. Créer la hiérarchie `kernel/`, `providers/`, `engine/`, `interfaces/`.
4. Déplacer `contracts/` vers `antaerus/kernel/schemas/` et introduire les contrats de base par langage.
5. Ajouter `settings/`, `permissions/`, `approval/`, `notifications/`.
6. Introduire `bootstrap.go`, `bootstrap.py`, `bootstrap.rs`.
7. Refaire les points d’entrée pour déléguer aux bootstraps.
8. Définir les interfaces/protocoles `Go`, `Python`, `Rust`.
9. Corriger tous les manifests, scripts, imports, chemins et documentation impactés.
10. Vérifier builds, tests, démarrage local minimal.
11. Mettre `tasks.md` à jour sous-tâche par sous-tâche au fur et à mesure.

## Vérifications

Vérifications structurelles :
- un dossier `antaerus/` existe et contient explicitement `kernel/`, `providers/`, `engine/`, `interfaces/`
- les services majeurs ne vivent plus à la racine technique du dépôt
- les modules `permissions/`, `approval/`, `notifications/`, `settings/` existent
- les fichiers de bootstrap existent dans les emplacements décidés
- les interfaces/protocoles existent par langage

Vérifications fonctionnelles :
- le frontend compile toujours
- le service Go compile toujours
- le service Python démarre toujours
- le service Rust compile et démarre toujours
- les scripts de dev et la CI pointent vers les nouveaux chemins

Vérifications backlog :
- chaque sous-tâche `M0.1` réellement terminée est cochée dans `tasks.md`
- aucune sous-tâche non terminée n’est cochée

## Résultat Attendu

À la fin de ce chantier, le dépôt ne sera plus seulement une fondation pragmatique, mais une fondation **structurellement alignée** sur la cible `M0.1` :
- architecture visible en couches
- noyau transverse explicite
- bootstraps présents
- contrats et interfaces localisés
- backlog `tasks.md` synchronisé avec l’avancement réel
