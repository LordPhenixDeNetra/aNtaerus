# Plan d'exécution — Finalisation stricte de `M0.1`

## Résumé

Objectif : terminer réellement `M0.1 — Architecture & Bootstrap` en partant de l'état actuel du dépôt, puis mettre `tasks.md` à jour de façon fidèle.

Le dépôt est déjà largement migré sous `antaerus/`, avec un noyau `kernel/`, des bootstraps et des chemins CI/scripts redirigés. Le travail restant consiste surtout à :

- fermer l'écart avec la règle stricte "zéro fichier hors package `antaerus/`" ;
- valider de bout en bout la structure migrée ;
- mettre `tasks.md` en cohérence avec ce qui est réellement livré et vérifié.

Succès attendu :

- les dossiers techniques racine `web/`, `gateway_go/`, `brain_python/`, `engine_rust/` n'existent plus ;
- la structure `L0 -> L3` est lisible uniquement sous `antaerus/` ;
- les vérifications minimales passent dans le layout strict ;
- les sous-tâches `M0.1` terminées sont cochées dans `tasks.md`, les restantes gardent un état explicite.

## Analyse de l'état actuel

### État observé dans le dépôt

La racine contient à la fois :

- le nouveau layout cible sous `antaerus/` ;
- les anciens dossiers techniques à la racine :
  - `web/`
  - `gateway_go/`
  - `brain_python/`
  - `engine_rust/`

Le layout strict déjà présent sous `antaerus/` comprend :

- `antaerus/kernel/`
  - `contracts/`
  - `schemas/`
  - `settings/`
  - `permissions/`
  - `approval/`
  - `notifications/`
  - `events/`
  - `errors/`
  - `paths/`
- `antaerus/providers/`
  - `brain_python/`
  - `engine_rust/`
- `antaerus/engine/`
  - `bootstrap.go`
- `antaerus/interfaces/`
  - `gateway_go/`
  - `web/`

### Fichiers clés déjà alignés

- `antaerus/engine/bootstrap.go`
  - composition root Go présente ;
- `antaerus/providers/brain_python/bootstrap.py`
  - bootstrap Python présent ;
- `antaerus/providers/engine_rust/src/bootstrap.rs`
  - bootstrap Rust présent ;
- `antaerus/interfaces/gateway_go/cmd/gateway/main.go`
  - délègue déjà au bootstrap Go ;
- `.github/workflows/ci.yml`
  - pointe déjà vers `antaerus/interfaces/web`, `antaerus/providers/brain_python`, `antaerus/providers/engine_rust` et `antaerus/` pour Go ;
- `antaerus/docker-compose.yml`
  - pointe déjà vers les nouveaux répertoires.

### Écart principal restant

L'écart bloquant pour considérer `M0.1` terminé est la coexistence des anciens dossiers racine avec le nouveau layout. Cet état viole directement :

- `tasks.md` : "zéro fichier hors package `antaerus/`" ;
- `cahier-des-charges.md` : "Tout est sous `antaerus/`" et "pas de shim racine".

### Conséquence backlog

`tasks.md` montre encore toutes les sous-tâches `M0.1` à `non faites`, alors que plusieurs éléments sont déjà matérialisés. Le fichier doit donc être resynchronisé sur preuves, et non réécrit de façon spéculative.

## Changements proposés

### 1. Finaliser la migration structurelle

#### Fichiers et dossiers concernés

- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\web`
- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\gateway_go`
- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\brain_python`
- `n:\OneDrive - Université Cheikh Anta DIOP de DAKAR\PycharmProjects\aNtaerus\engine_rust`

#### Action

- supprimer les anciens dossiers racine devenus doublons ;
- conserver à la racine uniquement le pilotage projet et les métadonnées nécessaires :
  - `.github/`
  - `.trae/`
  - `.git*`
  - `tasks.md`
  - `cahier-des-charges.md`
  - fichiers de configuration globaux réellement justifiés.

#### Pourquoi

- c'est la condition décisive pour satisfaire la règle stricte de `M0.1` ;
- cela élimine les ambiguïtés d'édition, de build et de lecture documentaire.

#### Comment

- vérifier d'abord que le contenu utile existe bien dans `antaerus/` ;
- tenter la suppression via l'outil dédié ;
- si un verrou Windows/OneDrive bloque, arrêter les processus locaux liés au projet, puis relancer la suppression ;
- re-vérifier l'arborescence racine immédiatement après.

### 2. Consolider la cartographie `L0 -> L3`

#### Dossiers concernés

- `antaerus/kernel/`
- `antaerus/providers/`
- `antaerus/engine/`
- `antaerus/interfaces/`

#### Action

- confirmer que chaque dossier incarne bien la couche prévue ;
- compléter seulement les points structurels manquants détectés pendant la vérification ;
- ne pas introduire de nouvelle hiérarchie non demandée.

#### Pourquoi

- `M0.1` demande une matérialisation visible, pas seulement des composants dispersés.

#### Comment

- valider que :
  - `L0` contient les contrats et concepts transverses ;
  - `L1` contient les providers Python et Rust ;
  - `L2` expose la composition/orchestration Go ;
  - `L3` contient les interfaces réseau et UI.

### 3. Vérifier et, si nécessaire, compléter les artefacts `kernel`

#### Fichiers concernés

- `antaerus/kernel/contracts/contracts.go`
- `antaerus/kernel/contracts/contracts.py`
- `antaerus/kernel/contracts/contracts.rs`
- `antaerus/kernel/contracts/protocols.go`
- `antaerus/kernel/contracts/protocols.py`
- `antaerus/kernel/contracts/protocols.rs`
- `antaerus/kernel/settings/config.go`
- `antaerus/kernel/settings/config.py`
- `antaerus/kernel/settings/config.rs`
- `antaerus/kernel/permissions/roles.md`
- `antaerus/kernel/approval/gate.md`
- `antaerus/kernel/notifications/event_bus.md`
- `antaerus/kernel/events/README.md`
- `antaerus/kernel/errors/README.md`
- `antaerus/kernel/paths/README.md`

#### Action

- vérifier que chaque sous-tâche `M0.1` correspondante est réellement matérialisée ;
- compléter uniquement les fichiers encore incomplets au point d'empêcher la validation de la sous-tâche.

#### Pourquoi

- `tasks.md` doit être coché sur base de fichiers présents et cohérents, pas sur intention.

#### Comment

- utiliser les critères suivants :
  - `kernel/` : existe avec ses sous-parties attendues ;
  - `settings/` : types de secrets présents dans les trois langages ;
  - `permissions/`, `approval/`, `notifications/` : concepts explicitement documentés ;
  - `protocols/` : frontières inter-couches nommées par langage.

### 4. Vérifier les bootstraps et les entrées

#### Fichiers concernés

- `antaerus/engine/bootstrap.go`
- `antaerus/providers/brain_python/bootstrap.py`
- `antaerus/providers/engine_rust/src/bootstrap.rs`
- `antaerus/providers/engine_rust/src/main.rs`
- `antaerus/interfaces/gateway_go/cmd/gateway/main.go`
- `antaerus/providers/brain_python/src/antaerus_brain/app.py`

#### Action

- valider que les entrées délèguent bien aux bootstraps ;
- corriger uniquement s'il reste une entrée directe court-circuitant la composition root.

#### Pourquoi

- `M0.1` demande des bootstraps réels, pas seulement des fichiers présents.

#### Comment

- côté Go : `main.go` doit appeler `engine.NewRuntimeBootstrap()` ;
- côté Python : l'exécution doit passer par `bootstrap.py` ;
- côté Rust : `main.rs` doit déléguer au bootstrap Rust.

### 5. Valider l'écosystème de lancement et d'intégration

#### Fichiers concernés

- `antaerus/scripts/dev-all.ps1`
- `antaerus/scripts/dev-all.sh`
- `antaerus/scripts/dev-brain.ps1`
- `antaerus/scripts/dev-brain.sh`
- `antaerus/scripts/dev-engine.ps1`
- `antaerus/scripts/dev-engine.sh`
- `antaerus/scripts/dev-gateway.ps1`
- `antaerus/scripts/dev-gateway.sh`
- `antaerus/scripts/dev-web.ps1`
- `antaerus/scripts/dev-web.sh`
- `antaerus/docker-compose.yml`
- `.github/workflows/ci.yml`
- `antaerus/go.mod`

#### Action

- confirmer que tous les chemins de démarrage, de test et de CI utilisent uniquement la nouvelle structure ;
- corriger les références restantes si l'une pointe encore implicitement vers la racine legacy.

#### Pourquoi

- un `M0.1` "terminé" doit rester lançable dans le layout strict.

#### Comment

- contrôler les `working-directory`, imports Go, commandes `go run`, `cargo`, `python`, `npm`.

### 6. Mettre `tasks.md` à jour de façon probante

#### Fichier concerné

- `tasks.md`

#### Action

- cocher uniquement les éléments `M0.1` démontrés par le dépôt et par la vérification ;
- laisser ouverts les éléments insuffisamment prouvés ;
- ajouter un bloc `État actuel` sous `M0.1` si nécessaire pour préciser ce qui reste à fermer.

#### Pourquoi

- le backlog doit refléter l'état réel, conformément à la règle projet.

#### Comment

- logique de décision par sous-tâche :
  - cocher si artefact présent + usage réel ou validation suffisante ;
  - laisser ouvert si artefact présent mais règle stricte non satisfaite ;
  - documenter les reliquats plutôt que sur-cocher.

### 7. Vérifier la fondation strictement après nettoyage

#### Vérifications à exécuter

- Go :
  - depuis `antaerus/` : `go test ./interfaces/gateway_go/...`
- Python :
  - depuis `antaerus/providers/brain_python` : `python -m pip install -e ".[dev]"`
  - puis `python -m pytest`
- Rust :
  - depuis `antaerus/providers/engine_rust` : `cargo test`
- Web :
  - depuis `antaerus/interfaces/web` : `npm run check`
  - puis `npm run build`
  - puis `npm run test`

#### Pourquoi

- après suppression des doublons racine, il faut prouver que la structure stricte reste fonctionnelle.

#### Comment

- exécuter ces commandes après le nettoyage ;
- si un échec révèle une dépendance cachée à l'ancien layout racine, corriger cette dépendance avant mise à jour finale de `tasks.md`.

### 8. Contrôler les diagnostics après modifications

#### Fichiers à cibler

- les fichiers effectivement modifiés pendant l'exécution, en priorité :
  - `tasks.md`
  - scripts ou manifests ajustés
  - points d'entrée éventuellement retouchés

#### Action

- lancer les diagnostics sur les fichiers modifiés ;
- corriger immédiatement toute erreur simple introduite par le chantier.

#### Pourquoi

- éviter qu'une mise au propre structurelle introduise des régressions triviales.

## Hypothèses et décisions

- la migration sous `antaerus/` déjà présente est la base de vérité technique à conserver ;
- les anciens dossiers racine sont désormais des doublons à supprimer, pas des sources à maintenir ;
- la règle stricte de `M0.1` s'applique aux dossiers techniques du produit, pas aux fichiers de pilotage projet comme `tasks.md`, `cahier-des-charges.md`, `.github/` ou `.trae/` ;
- aucune compatibilité transitoire par shim racine ne sera conservée ;
- `tasks.md` sera mis à jour après validation effective, pas avant ;
- si un verrou Windows/OneDrive bloque une suppression, le plan d'exécution inclut l'identification et l'arrêt des processus concernés avant nouvelle tentative.

## Séquence d'exécution

1. Relire `tasks.md`, `cahier-des-charges.md` et les fichiers structurels `M0.1`.
2. Vérifier que la copie utile de chaque service est bien celle sous `antaerus/`.
3. Supprimer les anciens dossiers racine `web/`, `gateway_go/`, `brain_python/`, `engine_rust/`.
4. Recontrôler l'arborescence racine pour confirmer la disparition des doublons.
5. Vérifier les bootstraps, protocols et settings déjà introduits.
6. Corriger les éventuels chemins résiduels dans scripts, CI ou manifests.
7. Exécuter les validations Go, Python, Rust et Web dans le layout strict.
8. Contrôler les diagnostics sur les fichiers modifiés.
9. Mettre à jour `tasks.md` en fonction des preuves finales.

## Vérifications

### Vérifications structurelles

- `antaerus/` contient bien `kernel/`, `providers/`, `engine/`, `interfaces/`.
- Les anciens dossiers racine `web/`, `gateway_go/`, `brain_python/`, `engine_rust/` ont disparu.
- Les bootstraps existent et sont les entrées réellement utilisées.
- Les modules `settings/`, `permissions/`, `approval/`, `notifications/` existent dans `L0`.

### Vérifications fonctionnelles

- `go test ./interfaces/gateway_go/...` passe depuis `antaerus/`.
- `python -m pytest` passe depuis `antaerus/providers/brain_python`.
- `cargo test` passe depuis `antaerus/providers/engine_rust`.
- `npm run check`, `npm run build` et `npm run test` passent depuis `antaerus/interfaces/web`.

### Vérifications backlog

- `tasks.md` coche les sous-tâches `M0.1` réellement terminées.
- `tasks.md` laisse ouvertes les sous-tâches non encore prouvées.
- Un état intermédiaire explicite est ajouté sous `M0.1` si une fermeture totale n'est pas possible.

## Résultat attendu

À l'issue de l'exécution :

- `M0.1` n'est plus seulement "presque migré" mais structurellement fermé ;
- le dépôt est lisible selon l'architecture stricte définie dans le cahier des charges ;
- le risque de confusion entre ancien layout racine et layout cible disparaît ;
- `tasks.md` redevient un reflet fiable et exploitable de l'avancement réel.
