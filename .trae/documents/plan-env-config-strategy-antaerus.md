# Plan d'exécution — Stratégie `.env` et fichiers de configuration

## Résumé

Objectif : clarifier puis implémenter une stratégie cohérente de configuration pour `aNtaerus`, car le dépôt attend déjà des variables d'environnement mais ne fournit pas encore le support documentaire et opérationnel complet pour les fichiers `.env` et les autres fichiers de configuration.

Réponse courte à la question : **oui**, il manque aujourd'hui au moins un **`.env.example` documenté** et un **branchement homogène** des fichiers de configuration dans les scripts et `docker-compose`. En revanche, il ne faut **pas** multiplier des `.env` différents par service, car le CDC cible déjà une **source de vérité unique**.

Succès attendu :

- un emplacement officiel pour la configuration runtime est défini et documenté ;
- le dépôt contient un fichier d'exemple sans secret réel ;
- les scripts et le mode `docker-compose` consomment cette stratégie de façon cohérente ;
- les responsabilités restent claires entre :
  - configuration backend via `.env` ;
  - configuration navigateur locale via `Setup`/`localStorage` ;
  - configuration bundle future via `config/`.

## Analyse de l'état actuel

### 1. Faits observés dans le dépôt

- Aucun fichier `.env*` n'existe actuellement dans le dépôt.
- Le fichier [.gitignore](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/.gitignore#L35-L39) ignore déjà `.env` et variantes locales, ce qui confirme qu'un `.env` runtime est attendu mais non versionné.
- Le gateway Go lit explicitement un fichier `.env` à son démarrage via `Viper` dans [config.go](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/gateway_go/internal/config/config.go#L68-L103), puis applique aussi `AutomaticEnv()`.
- Le service Python ne lit pas de fichier `.env` directement ; il lit seulement l'environnement du processus via `getenv()` dans [config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py#L53-L101).
- Le frontend Web n'utilise pas `import.meta.env` ; sa configuration locale passe aujourd'hui par `localStorage` et `Setup`, comme visible dans [setup.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/setup.ts#L1-L27).
- `docker-compose` ne déclare ni `env_file`, ni section `environment`, malgré des services qui dépendent déjà d'URLs, secrets et choix de provider : [docker-compose.yml](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/docker-compose.yml#L1-L41).
- Les scripts `dev-brain.*` et `dev-gateway.*` ne chargent pas de `.env` eux-mêmes ; ils se contentent de changer de répertoire puis de lancer le process.

### 2. Intentions déjà fixées par le CDC et le backlog

- Le CDC dit explicitement : **une source de vérité unique** via `.env` lu au boot, pas de mutation runtime, pas de triple source `env + .env + singleton` : [CDC](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/cahier-des-charges.md#L530-L536).
- Le backlog contient déjà la tâche ouverte `Créer .env.example documenté` dans `M6.2` : [tasks.md](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/tasks.md#L305-L307).
- Le CDC prévoit plus tard une structure bundle `config/.env` pour la distribution packagée, mais cela relève d'une phase ultérieure de bundle/release, pas du fonctionnement développeur actuel : [CDC bundle](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/cahier-des-charges.md#L590-L599).

### 3. Problème réel à résoudre

Le projet a déjà une logique de configuration, mais elle est **incomplètement productisée** :

- Go sait lire `.env`, mais aucun exemple n'indique quoi y mettre ;
- Python attend des variables sans mécanisme standard de chargement depuis un `.env` commun ;
- Docker ne centralise pas encore les variables ;
- le Web mélange volontairement configuration navigateur et configuration backend, sans documentation de frontière explicite ;
- la stratégie `bundle/config/.env` du CDC n'est pas encore raccordée à la stratégie dev locale.

## Hypothèses et décisions

- **Décision principale** : conserver une **stratégie à `.env` unique au niveau `antaerus/`** pour le développement local et le lancement des services.
- **Décision secondaire** : ne pas introduire maintenant un `.env` distinct par service (`gateway_go/.env`, `brain_python/.env`, etc.), car cela contredirait la règle CDC de source unique.
- **Décision frontend** : ne pas basculer les secrets Web vers `Vite env`, car l'UI actuelle stocke ces valeurs en local navigateur via `Setup`, ce qui est cohérent avec le périmètre actuel.
- **Décision bundle** : réserver `antaerus/config/.env` au futur lot bundle/release, sans casser aujourd'hui la stratégie dev `antaerus/.env`.
- **Décision de sécurité** : ne jamais committer de vrai `.env`, seulement un `.env.example` documenté et éventuellement des exemples non sensibles de fichiers YAML.

## Changements proposés

### 1. Créer le contrat de configuration développeur

#### Fichiers à créer

- `antaerus/.env.example`

#### Action

- créer un fichier exemple central contenant toutes les variables réellement consommées aujourd'hui par :
  - `gateway_go`
  - `brain_python`
  - scripts de validation pertinents
- organiser les variables par sections lisibles :
  - environnement commun
  - gateway
  - brain / providers LLM
  - URLs inter-services
  - options facultatives

#### Pourquoi

- aujourd'hui le projet attend déjà ces variables, mais l'utilisateur n'a aucun contrat concret à copier/remplir.

### 2. Documenter clairement où va chaque type de configuration

#### Fichiers à modifier

- `antaerus/README.md`
- `antaerus/providers/brain_python/README.md`
- éventuellement `antaerus/interfaces/web/README.md`

#### Action

- ajouter une section "Configuration" expliquant :
  - où placer `antaerus/.env`
  - quand copier depuis `.env.example`
  - quelles variables sont backend/runtime
  - quelles valeurs restent côté navigateur dans `Setup`
- expliciter que :
  - `.env` = configuration des services backend et intégrations ;
  - `Setup/localStorage` = préférences locales du navigateur ;
  - `config/.env` = cible future du bundle, pas le mécanisme dev principal actuel.

#### Pourquoi

- aujourd'hui le manque n'est pas seulement technique, il est aussi documentaire.

### 3. Rendre le chargement `.env` homogène entre Go, Python et Docker

#### Fichiers à modifier

- `antaerus/docker-compose.yml`
- `antaerus/scripts/dev-brain.ps1`
- `antaerus/scripts/dev-brain.sh`
- éventuellement `antaerus/scripts/dev-gateway.ps1`
- éventuellement `antaerus/scripts/dev-gateway.sh`

#### Action

- définir un chargement cohérent du `.env` racine `antaerus/.env` :
  - pour `docker-compose`, via `env_file` ou `environment` explicite ;
  - pour les scripts locaux, soit en important le `.env`, soit en documentant que le gateway le lit directement et que Python a besoin de l'environnement process ;
- le point important est d'éviter un fonctionnement asymétrique où :
  - Go voit `.env`
  - mais Python non.

#### Pourquoi

- c'est aujourd'hui le principal trou opérationnel : le même fichier `.env` n'alimente pas encore uniformément tous les services.

### 4. Choisir la stratégie Python pour consommer le `.env`

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/config.py`
- éventuellement `antaerus/providers/brain_python/pyproject.toml`

#### Action

- adopter explicitement une des deux options suivantes, en restant aligné avec la source unique :
  - **Option recommandée** : charger `antaerus/.env` au boot côté Python avec une dépendance légère compatible `pydantic`/`python-dotenv` ;
  - **Option alternative** : laisser `config.py` inchangé et faire porter le chargement `.env` aux scripts/dev tooling.

#### Décision retenue pour l'exécution

- je recommande l'**option chargement Python au boot**, car elle réduit les écarts entre `python bootstrap.py`, `docker-compose` et les scripts shell/PowerShell.

#### Pourquoi

- cela rend `brain_python` autonome et prévisible, sans dépendre d'un shell externe correctement préparé.

### 5. Ajouter une validation minimale de cohérence de configuration

#### Fichiers à modifier

- `antaerus/interfaces/gateway_go/internal/config/config.go`
- éventuellement `antaerus/providers/brain_python/src/antaerus_brain/config.py`
- éventuellement tests ciblés associés

#### Action

- compléter la stratégie existante pour :
  - détecter l'absence de variables obligatoires quand un provider cloud est choisi ;
  - éventuellement avertir lorsqu'un conflit existe entre variables shell héritées et valeurs du `.env`, conformément au CDC ;
  - conserver des défauts sûrs pour le mode développement local.

#### Pourquoi

- le CDC prévoit explicitement un warning en cas de conflit shell / `.env`, et le dépôt n'en fournit pas encore la matérialisation.

### 6. Préparer le terrain pour les autres fichiers de configuration

#### Fichiers à créer ou réserver

- `antaerus/config/` uniquement si nécessaire pour documentation ou future bundle strategy
- `antaerus/config/tools.yaml.example` ou équivalent, selon l'avancement des lots `M3`

#### Action

- ne pas sur-ingénier maintenant ;
- documenter que les autres fichiers de configuration structurés concernent surtout les phases futures :
  - `tools.yaml` pour la whitelist CLI ;
  - `config/.env` pour le bundle packagé ;
  - éventuels manifests de release.

#### Pourquoi

- votre question vise aussi les "fichiers de configurations" au sens large, mais il faut distinguer :
  - ce qui manque **maintenant** pour développer ;
  - ce qui appartiendra aux phases futures.

## Fichiers concernés à l'exécution

- `antaerus/.env.example`
- `antaerus/docker-compose.yml`
- `antaerus/README.md`
- `antaerus/providers/brain_python/README.md`
- éventuellement `antaerus/interfaces/web/README.md`
- `antaerus/providers/brain_python/src/antaerus_brain/config.py`
- éventuellement `antaerus/providers/brain_python/pyproject.toml`
- éventuellement `antaerus/scripts/dev-brain.ps1`
- éventuellement `antaerus/scripts/dev-brain.sh`
- éventuellement `antaerus/scripts/dev-gateway.ps1`
- éventuellement `antaerus/scripts/dev-gateway.sh`
- éventuellement `tasks.md` si l'on souhaite tracer l'avancement de cette dette/documentation

## Hors périmètre volontaire

- migration immédiate du frontend vers `import.meta.env`
- création de plusieurs `.env` distincts par service
- stockage de vrais secrets dans le dépôt
- structure bundle complète `config/.env` de la release finale

## Vérifications

### Vérifications fonctionnelles

- `gateway_go` démarre avec `antaerus/.env` présent
- `brain_python` démarre avec le même `.env` sans injection manuelle supplémentaire
- `docker-compose up` voit la même configuration partagée
- les URLs inter-services (`ANTAERUS_BRAIN_URL`, `ANTAERUS_ENGINE_URL`, etc.) restent cohérentes

### Vérifications documentaires

- le README racine explique clairement où créer `.env`
- le README brain détaille les variables consommées
- le README web précise que ses préférences locales ne remplacent pas le `.env` backend

### Vérifications de sécurité

- `.env` réel reste ignoré par Git
- seul `.env.example` est versionné
- aucun secret réel n'apparaît dans la documentation

## Résultat attendu

À l'issue de cette mise à niveau, la configuration de `aNtaerus` sera lisible et cohérente :

- un **`.env` unique** au niveau `antaerus/` pour le runtime développeur ;
- un **`.env.example` documenté** pour onboarding rapide ;
- une consommation homogène par Go, Python et Docker ;
- une frontière claire entre **config backend** et **config navigateur locale** ;
- une base propre pour la future stratégie `config/.env` du bundle.
