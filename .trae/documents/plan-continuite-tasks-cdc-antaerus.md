## Résumé

Objectif de ce plan : instaurer une continuité d’exécution stricte pour `aNtaerus` en faisant de [`tasks.md`](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md) le **backlog principal vivant** et de [`cahier-des-charges.md`](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/cahier-des-charges.md) la **référence produit stable**.

Le prochain chantier devra :
- réaligner d’abord `tasks.md` avec l’état réel du dépôt déjà implémenté
- utiliser ensuite `tasks.md` comme source de vérité opérationnelle pour la suite
- poursuivre en priorité les tâches restantes de `M0`
- mettre à jour `tasks.md` **par sous-tâche** après chaque avancement vérifié

## Analyse De L’État Actuel

Constats observés :
- le dépôt contient maintenant une fondation exécutable avec `web/`, `gateway_go/`, `brain_python/`, `engine_rust/`, les contrats JSON, les scripts de dev, `docker-compose.yml` et la CI
- un plan de fondation existe déjà dans [`plan-fondation-monorepo-antaerus.md`](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.trae/documents/plan-fondation-monorepo-antaerus.md)
- `tasks.md` décrit un backlog complet par phases `M0` à `M9`, mais il est encore entièrement formulé comme si rien n’avait été livré
- le contenu de `tasks.md` et l’état réel du dépôt sont donc désynchronisés
- `cahier-des-charges.md` décrit une vision complète, stable et plus large que la fondation déjà implémentée

Implication :
- avant toute nouvelle implémentation, il faut corriger la désynchronisation entre backlog et code
- sans ce réalignement, les prochaines tâches risquent d’être reprises en double, ou exécutées hors ordre

## Changements Proposés

### 1. Réaligner `tasks.md` Avec L’Existant

Fichier à modifier pendant l’exécution :
- `tasks.md`

Pourquoi :
- ce fichier devient le backlog principal
- il doit refléter immédiatement ce qui est déjà réalisé dans le dépôt

Comment :
- analyser les éléments déjà livrés dans les dossiers `web/`, `gateway_go/`, `brain_python/`, `engine_rust/`, `contracts/`, `docs/`, `.github/workflows/`, `scripts/` et les documents `.trae/documents/`
- identifier les sous-tâches de `M0` déjà totalement ou partiellement couvertes
- cocher uniquement les sous-tâches réellement terminées
- reformuler si nécessaire certaines lignes de `tasks.md` pour qu’elles correspondent au vocabulaire et à la structure actuelle du dépôt, sans changer le sens produit
- si une tâche de `M0` est seulement partiellement satisfaite, la laisser non cochée mais préciser son état au bon endroit dans `tasks.md`

Résultat attendu :
- `tasks.md` cesse d’être un backlog théorique et devient une photo fidèle de la réalité du projet

### 2. Fixer Le Rôle Respectif De `tasks.md` Et `cahier-des-charges.md`

Fichiers concernés :
- `tasks.md`
- `cahier-des-charges.md`

Pourquoi :
- ces deux documents ne doivent pas dériver chacun dans une logique différente

Décision d’usage :
- `cahier-des-charges.md` reste la **référence stable** de vision, d’architecture cible, de fonctionnalités, de contraintes et de trajectoire globale
- `tasks.md` devient la **source de vérité opérationnelle**, orientée exécution et suivi

Comment :
- lors des prochaines exécutions, commencer par relire les deux fichiers
- prendre dans `cahier-des-charges.md` les objectifs, contraintes et architecture cible
- prendre dans `tasks.md` le périmètre actif, l’ordre de traitement et l’état d’avancement
- ne modifier `cahier-des-charges.md` que si une décision produit ou architecture invalide réellement la vision courante

### 3. Instituer Une Règle De Mise À Jour Continue Par Sous-Tâche

Fichier à modifier pendant l’exécution :
- `tasks.md`

Pourquoi :
- vous avez explicitement demandé une mise à jour constante après chaque avancement
- le niveau de granularité choisi est la **sous-tâche**

Comment :
- avant de commencer un sous-chantier, repérer dans `tasks.md` les lignes qui seront impactées
- après chaque sous-tâche terminée et vérifiée, mettre à jour immédiatement son état dans `tasks.md`
- si une sous-tâche débouche sur un découpage plus fin indispensable, ajouter ce détail sans casser la structure générale par phase
- ne pas attendre la fin d’une phase ou d’un lot volumineux pour mettre `tasks.md` à jour

Règle de discipline :
- aucune avancée validée ne doit rester absente de `tasks.md`
- aucune case ne doit être cochée sans preuve correspondante dans le dépôt ou dans les tests/vérifications

### 4. Prioriser La Suite Sur Les Tâches Restantes De `M0`

Fichier principal de pilotage :
- `tasks.md`

Pourquoi :
- votre choix explicite est de finir `M0` avant `M1`
- le dépôt possède déjà une fondation exécutable, mais `M0` contient encore plusieurs tâches non couvertes ou seulement amorcées

Comment :
- après réalignement, isoler les sous-tâches `M0` encore ouvertes
- ordonner leur exécution par dépendances techniques
- conserver une priorité sur :
  - architecture & bootstrap réellement alignés avec les principes L0-L3 du cahier des charges
  - CI/CD et tooling manquants
  - formats de communication inter-services encore incomplets
  - sécurité fondamentale non encore matérialisée

Ordre recommandé pour la suite de `M0` :
1. mettre `tasks.md` à jour rétroactivement
2. compléter `M0.2` CI/CD & tooling
3. compléter `M0.1` architecture & bootstrap sur les zones non encore matérialisées
4. compléter `M0.3` communication inter-services
5. compléter `M0.4` sécurité fondamentale

### 5. Réutiliser Les Documents Déjà Générés Sans Les Confondre Avec Le Backlog

Fichiers de contexte à relire avant chaque exécution :
- `.trae/documents/plan-fondation-monorepo-antaerus.md`
- `.trae/documents/antaerus-prd-fondation.md`
- `.trae/documents/antaerus-architecture-technique.md`

Pourquoi :
- ces documents décrivent ce qui a été planifié et construit pour la fondation
- ils sont utiles pour expliquer pourquoi certaines lignes de `tasks.md` doivent déjà être cochées

Comment :
- s’en servir comme preuves de cadrage et comme contexte d’architecture
- ne pas les traiter comme source de pilotage quotidien à la place de `tasks.md`
- faire converger les prochains plans détaillés avec `tasks.md`, au lieu de laisser plusieurs sources concurrentes de suivi

### 6. Encadrer Les Prochains Plans D’Exécution

Fichiers concernés :
- `.trae/documents/*.md`
- `tasks.md`

Pourquoi :
- les futurs plans détaillés resteront utiles, mais ne doivent plus vivre indépendamment du backlog principal

Comment :
- chaque futur plan devra commencer par :
  - relire `cahier-des-charges.md`
  - relire `tasks.md`
  - repérer les sous-tâches concernées
- chaque futur plan devra explicitement indiquer quelles lignes de `tasks.md` seront mises à jour
- la clôture d’un chantier devra inclure la mise à jour de `tasks.md` avant la fin du tour d’exécution

## Fichiers Ciblés Lors De La Prochaine Exécution

Fichiers à lire systématiquement :
- `tasks.md`
- `cahier-des-charges.md`
- `.trae/documents/plan-fondation-monorepo-antaerus.md`
- `.trae/documents/antaerus-prd-fondation.md`
- `.trae/documents/antaerus-architecture-technique.md`

Fichier à modifier en priorité :
- `tasks.md`

Fichiers de code à utiliser comme preuve de réalisation déjà existante :
- `web/src/pages/FoundationDashboard.tsx`
- `gateway_go/internal/system/handlers.go`
- `brain_python/src/antaerus_brain/app.py`
- `engine_rust/src/http.rs`
- `.github/workflows/ci.yml`
- `contracts/*.json`
- `scripts/dev-*`
- `docker-compose.yml`

## Hypothèses Et Décisions

- `tasks.md` devient le backlog principal du projet
- `cahier-des-charges.md` reste la référence stable de vision produit et architecture cible
- la mise à jour rétroactive de `tasks.md` doit précéder toute nouvelle implémentation
- la granularité de suivi retenue est la sous-tâche
- la phase prioritaire après réalignement est `M0`
- les prochains plans détaillés existent toujours, mais s’alignent obligatoirement sur `tasks.md`

## Étapes D’Exécution Recommandées

1. Lire `tasks.md`, `cahier-des-charges.md` et les documents `.trae/documents/` existants.
2. Auditer les fichiers réellement présents dans le dépôt pour identifier les sous-tâches de `M0` déjà couvertes.
3. Mettre à jour rétroactivement `tasks.md` en cochant ou ajustant uniquement ce qui est effectivement livré.
4. Lister les sous-tâches de `M0` encore ouvertes après réalignement.
5. Choisir un premier bloc cohérent de tâches restantes de `M0`.
6. Implémenter ce bloc.
7. Mettre à jour immédiatement `tasks.md` après chaque sous-tâche terminée et vérifiée.
8. Répéter ce cycle jusqu’à clôture de `M0`, puis seulement ensuite préparer `M1`.

## Vérifications

Vérifications à effectuer lors de la prochaine exécution :
- vérifier que `tasks.md` reflète explicitement la fondation déjà présente
- vérifier qu’aucune tâche déjà livrée n’est laissée à tort comme non commencée
- vérifier qu’aucune case n’est cochée sans code, documentation ou test correspondant
- vérifier que les prochaines implémentations s’attachent bien aux lignes ouvertes de `M0`
- vérifier qu’après chaque sous-tâche livrée, `tasks.md` est mis à jour dans le même cycle de travail

Critère de succès :
- à la fin du prochain chantier, `tasks.md` est fiable comme backlog maître, `cahier-des-charges.md` reste le cadre produit stable, et la suite de `M0` peut être menée sans perte de continuité documentaire.
