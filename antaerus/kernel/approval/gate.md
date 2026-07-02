# Gate Composite

Le gate composite evalue au minimum :

- le risque
- la categorie
- le niveau d'autonomie

Decision minimale :

- `allow`
- `review`
- `deny`

## Politique actuellement implémentée

La version exécutable du gate est matérialisée côté `brain_python` dans `antaerus/providers/brain_python/src/antaerus_brain/approval/gate.py`.

Règles actuellement codées :

- tout tool avec `autonomy_level >= 4` retourne `review`
- tout tool de catégorie `rust-sandbox` avec `autonomy_level >= 3` retourne `allow` avec audit obligatoire
- tous les autres tools retournent `allow` par défaut
- pour les tools non `rust-sandbox`, l'audit est requis quand `autonomy_level >= 3`

## Audit

L'audit append-only est matérialisé dans `antaerus/providers/brain_python/src/antaerus_brain/approval/audit.py`.

Chaque ligne JSONL enregistre :

- l'horodatage UTC
- le `sessionId`
- le nom du tool
- les arguments soumis
- la décision du gate

Chemin cible :

- `memory_data/audit/tool_execution_audit.jsonl` ou son équivalent dérivé du répertoire mémoire configuré

## Portée M3.3

- le gate s'applique dans la boucle tool-aware de `POST /llm/session-stream`
- `filesystem` et `cli` sont les premiers tools réellement branchés à cette politique via le proxy HTTP vers `engine_rust`
- aucun workflow d'approbation humaine interactif n'est encore branché dans ce lot; `review` reste une décision exécutable mais non encore exposée à une UI dédiée
