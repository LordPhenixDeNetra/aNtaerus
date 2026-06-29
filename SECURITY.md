# Politique de sécurité

Merci de contribuer à la sécurité de `aNtaerus`.

## Signaler une vulnérabilité

Si vous découvrez :

- une fuite de secret
- une faille d'authentification
- une exposition de token ou de JWT
- une élévation de privilège
- une vulnérabilité de dépendance avec impact réel

merci de ne pas publier immédiatement tous les détails dans une issue publique.

Préférez un signalement privé aux mainteneurs du dépôt via GitHub avec :

- une description du problème
- les composants concernés
- les étapes de reproduction
- l'impact estimé
- un éventuel contournement connu

## Divulgation responsable

Nous encourageons :

- les signalements factuels
- une reproduction minimale
- la discrétion sur les secrets ou payloads sensibles
- un délai raisonnable de correction avant divulgation publique

## Secrets et configuration

Rappels importants :

- ne committez jamais un fichier `.env` réel
- ne loguez jamais des secrets en clair
- n'utilisez pas d'exemples contenant des clés plausibles

Référence technique :

- `antaerus/docs/security/SECRETS.md`

## Portée actuelle

Le projet couvre déjà plusieurs surfaces sensibles :

- gateway HTTP et WebSocket
- JWT de développement
- mémoire SQLite
- intégrations LLM et clés API
- scripts de validation et de smoke

## Bonnes pratiques pour les contributeurs

- relancez les tests de sécurité quand vous touchez aux secrets ou à la configuration
- documentez les nouveaux risques si vous ajoutez un provider, un secret ou une intégration
- respectez les conventions de masquage déjà présentes dans le code
