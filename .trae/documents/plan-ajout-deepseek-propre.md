# Plan d'exécution — Ajouter DeepSeek proprement

## Résumé

Objectif : ajouter `DeepSeek` comme provider LLM de première classe dans `aNtaerus`, de manière propre, cohérente et testée, sans modifier le provider par défaut actuel.

Décisions verrouillées :

- périmètre : **complet**
- usage : **optionnel**

Succès attendu :

- `DeepSeek` devient un provider reconnu par le brain Python ;
- il apparaît dans l'UI `Setup` et dans les providers exposés par l'API ;
- le projet dispose d'une configuration `.env.example` claire pour l'utiliser ;
- les tests Python et web impactés couvrent le nouveau provider ;
- `ollama` reste le provider par défaut du projet.

## Analyse de l'état actuel

### Backend Python

- Le type `ProviderName` n'accepte aujourd'hui que `anthropic`, `openai`, `mistral`, `ollama` dans [llm/__init__.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py#L7-L24).
- La factory ne sait instancier que ces quatre providers dans [factory.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/llm/factory.py#L9-L40).
- La configuration ne contient aucune clé ni modèle DeepSeek, et la validation des providers supportés l'interdit explicitement dans [config.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/config.py#L12-L142).
- L'endpoint `GET /llm/providers` n'expose que quatre providers dans [api/llm.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/src/antaerus_brain/api/llm.py#L16-L27).

### Frontend Web

- Le type `ProviderName` côté web n'accepte lui aussi que quatre providers dans [setup.ts](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/lib/setup.ts#L1-L27).
- `Setup.tsx` affiche exactement quatre providers dans la liste et trois champs de clés API locales dans [Setup.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/pages/Setup.tsx#L10-L190).
- `Chat.tsx` affiche le provider local par défaut et interroge l'API `/llm/providers`, mais ne semble pas imposer d'autre logique spécifique par provider dans [Chat.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/pages/Chat.tsx#L38-L220).

### Configuration

- Le fichier [.env.example](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/.env.example#L41-L62) documente actuellement `anthropic`, `openai`, `mistral` et `ollama`, mais rien pour `DeepSeek`.

### Tests existants

- Les tests Python de factory et d'API supposent actuellement 4 providers dans :
  - [test_llm_factory.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/tests/test_llm_factory.py)
  - [test_llm_api.py](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/providers/brain_python/tests/test_llm_api.py)
- Les tests web mockent encore `defaultProvider: "ollama"` et des listes vides ou implicites, notamment dans :
  - [App.test.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/App.test.tsx)
  - [Chat.test.tsx](file:///n:/OneDrive%20-%20Universit%C3%A9%20Cheikh%20Anta%20DIOP%20de%20DAKAR/PycharmProjects/aNtaerus/antaerus/interfaces/web/src/pages/Chat.test.tsx)

## Hypothèses et décisions

- `DeepSeek` sera ajouté comme **provider cloud officiel**, au même niveau que `anthropic`, `openai` et `mistral`.
- Le provider par défaut du projet reste `ollama`.
- Le modèle par défaut recommandé sera un modèle `DeepSeek` explicite via `litellm`, par exemple `deepseek/deepseek-chat`, sauf si le code existant ou la validation révèle une meilleure convention déjà en usage.
- L'ajout doit couvrir :
  - backend Python ;
  - `.env.example` ;
  - UI `Setup` ;
  - endpoint `/llm/providers` ;
  - tests impactés.
- Le support `DeepSeek` ne doit pas casser les quatre providers déjà présents.

## Changements proposés

### 1. Étendre les types et contrats Python du provider

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/config.py`

#### Action

- ajouter `deepseek` au `Literal` `ProviderName` ;
- étendre `Settings` avec :
  - `deepseek_api_key`
  - `deepseek_model`
- accepter `deepseek` dans la validation `_require_supported_provider()` ;
- ajouter la validation de clé obligatoire quand `default_provider == "deepseek"`.

#### Pourquoi

- c'est le socle nécessaire pour reconnaître DeepSeek comme provider supporté par le brain.

### 2. Étendre la factory LLM côté brain

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/llm/factory.py`

#### Action

- ajouter une branche `deepseek` qui instancie `CloudLLMClient` ;
- utiliser :
  - `provider_name="deepseek"`
  - `api_key=settings.deepseek_api_key`
  - `default_model=settings.deepseek_model`
  - `timeout_seconds=settings.llm_timeout_seconds`

#### Pourquoi

- le projet utilise déjà `CloudLLMClient` pour les providers cloud compatibles avec `litellm`, ce qui évite une nouvelle classe spécifique inutile.

### 3. Exposer DeepSeek dans l'API backend

#### Fichiers à modifier

- `antaerus/providers/brain_python/src/antaerus_brain/api/llm.py`

#### Action

- inclure `deepseek` dans la liste renvoyée par `GET /llm/providers` ;
- exposer son modèle configuré dans la même structure que les autres providers.

#### Pourquoi

- le frontend et les outils de dev s'appuient déjà sur cette route pour connaître les providers disponibles.

### 4. Ajouter la configuration DeepSeek au `.env.example`

#### Fichiers à modifier

- `antaerus/.env.example`

#### Action

- documenter :
  - `ANTAERUS_BRAIN_DEEPSEEK_MODEL`
  - `ANTAERUS_DEEPSEEK_API_KEY`
- conserver `ANTAERUS_BRAIN_DEFAULT_PROVIDER=ollama` par défaut ;
- faire apparaître `DeepSeek` dans la section des clés cloud facultatives.

#### Pourquoi

- l'utilisateur doit pouvoir activer DeepSeek sans deviner les variables à renseigner.

### 5. Étendre le type et le stockage de configuration côté web

#### Fichiers à modifier

- `antaerus/interfaces/web/src/lib/setup.ts`
- éventuellement `antaerus/interfaces/web/src/lib/storage.ts`
- éventuellement `antaerus/interfaces/web/src/store/useAppStore.ts`

#### Action

- ajouter `deepseek` au type `ProviderName` ;
- ajouter `deepseekApiKey` à `LocalSetupConfig` ;
- l'inclure dans `DEFAULT_SETUP_CONFIG` ;
- vérifier que le stockage local reste compatible avec les anciennes configs locales sans casser les valeurs existantes.

#### Pourquoi

- l'UI `Setup` repose sur cette structure pour persister et réhydrater les préférences locales.

### 6. Exposer DeepSeek dans le `Setup` React

#### Fichiers à modifier

- `antaerus/interfaces/web/src/pages/Setup.tsx`

#### Action

- ajouter `deepseek` à `providerOptions` ;
- ajouter un champ `ApiKeyInput` pour la clé `DeepSeek` ;
- conserver le comportement actuel du wizard :
  - stockage local navigateur
  - aucune promotion automatique en provider par défaut.

#### Pourquoi

- le périmètre décidé est “complet”, donc DeepSeek doit être visible et sélectionnable dans l'UI de configuration.

### 7. Vérifier l'impact sur le chat et les providers affichés

#### Fichiers à vérifier ou ajuster

- `antaerus/interfaces/web/src/pages/Chat.tsx`
- `antaerus/interfaces/web/src/lib/api.ts`

#### Action

- confirmer qu'aucun code supplémentaire n'est nécessaire côté `Chat` au-delà de la récupération des providers exposés par l'API ;
- ajuster uniquement si un typage ou un rendu repose encore sur la liste fermée des quatre providers.

#### Pourquoi

- éviter des modifications inutiles si le composant est déjà générique.

### 8. Mettre à jour les tests Python

#### Fichiers à modifier

- `antaerus/providers/brain_python/tests/test_llm_factory.py`
- `antaerus/providers/brain_python/tests/test_llm_api.py`
- éventuellement `antaerus/providers/brain_python/tests/test_chat_session.py`
- éventuellement `antaerus/providers/brain_python/tests/test_secrets.py`

#### Action

- étendre les fixtures `Settings` pour contenir `deepseek_api_key` et `deepseek_model` ;
- vérifier que `create_llm_client(settings, "deepseek")` renvoie bien `CloudLLMClient` ;
- mettre à jour le test de l'endpoint `/llm/providers` pour attendre 5 providers ;
- vérifier que le masquage/typage des secrets reste cohérent pour la nouvelle clé.

#### Pourquoi

- les tests existants sont actuellement calés sur 4 providers et échoueront sinon.

### 9. Mettre à jour les tests web ciblés

#### Fichiers à modifier

- `antaerus/interfaces/web/src/App.test.tsx`
- `antaerus/interfaces/web/src/pages/Chat.test.tsx`
- éventuellement ajouter ou adapter un test de `Setup.tsx` si l'exposition de `DeepSeek` doit être verrouillée visuellement

#### Action

- mettre à jour les mocks de providers si nécessaire ;
- vérifier que le `Setup` accepte `deepseek` dans la liste sans casser le rendu ;
- vérifier que les valeurs par défaut restent `ollama`.

#### Pourquoi

- garantir que l'ajout du provider n'introduit pas de régression dans l'UI.

### 10. Documentation légère et validation finale

#### Fichiers à modifier

- `antaerus/providers/brain_python/README.md`
- `antaerus/interfaces/web/README.md`
- éventuellement `tasks.md` si l'avancement correspondant mérite d'être noté

#### Action

- mentionner `DeepSeek` dans la liste des providers supportés ;
- documenter les nouvelles variables de configuration ;
- ne pas transformer cette tâche en refonte documentaire large.

#### Pourquoi

- un provider nouveau sans documentation minimale crée de la friction d'usage.

## Fichiers concernés à l'exécution

- `antaerus/providers/brain_python/src/antaerus_brain/llm/__init__.py`
- `antaerus/providers/brain_python/src/antaerus_brain/llm/factory.py`
- `antaerus/providers/brain_python/src/antaerus_brain/config.py`
- `antaerus/providers/brain_python/src/antaerus_brain/api/llm.py`
- `antaerus/providers/brain_python/tests/test_llm_factory.py`
- `antaerus/providers/brain_python/tests/test_llm_api.py`
- `antaerus/providers/brain_python/tests/test_chat_session.py`
- `antaerus/providers/brain_python/tests/test_secrets.py`
- `antaerus/.env.example`
- `antaerus/interfaces/web/src/lib/setup.ts`
- `antaerus/interfaces/web/src/pages/Setup.tsx`
- `antaerus/interfaces/web/src/App.test.tsx`
- `antaerus/interfaces/web/src/pages/Chat.test.tsx`
- éventuellement `antaerus/interfaces/web/src/lib/api.ts`
- `antaerus/providers/brain_python/README.md`
- `antaerus/interfaces/web/README.md`
- éventuellement `tasks.md`

## Hors périmètre volontaire

- changer le provider par défaut du projet
- ajouter un support multi-endpoint générique de type “OpenAI-compatible base URL”
- modifier la logique métier du streaming ou de l'historique
- brancher une clé DeepSeek du navigateur directement vers le backend
- refondre le système de `Setup` au-delà du provider additionnel

## Vérifications

### Python

- `python -m ruff check .`
- `python -m mypy src tests`
- `python -m pytest tests`

### Web

- `npm run lint`
- `npm run check`
- `npm run test`
- `npm run build`

### Contrôles attendus

- `deepseek` est accepté comme provider par la config du brain ;
- `/llm/providers` retourne désormais 5 providers ;
- `Setup` permet de sélectionner `deepseek` et de saisir sa clé locale ;
- `ollama` reste le défaut dans `DEFAULT_SETUP_CONFIG` et dans `.env.example` ;
- les providers historiques continuent de fonctionner inchangés.

## Résultat attendu

À l'issue de cette tâche, `aNtaerus` supporte proprement `DeepSeek` comme provider cloud optionnel :

- configurable par `.env` ;
- visible dans l'API et l'UI ;
- testé côté Python et frontend ;
- sans casser le flux actuel centré sur `ollama`.
