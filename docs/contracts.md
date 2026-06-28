# Contrats De Fondation

Les contrats de cette phase définissent trois objets JSON partagés :

- `service-health.schema.json` : santé d'un service individuel
- `service-capabilities.schema.json` : capacités déclarées d'un service
- `system-status.schema.json` : agrégation retournée par le gateway

## Principes

- les réponses sont sérialisées en JSON
- la source de vérité du dashboard est le `gateway_go`
- `brain_python` et `engine_rust` exposent leurs états et capacités via HTTP
- le frontend ne contacte pas directement Python ou Rust

## Services Référencés

- `web`
- `gateway_go`
- `brain_python`
- `engine_rust`

## Évolution Prévue

Ces schémas servent de base légère pour la phase fondation. Ils pourront évoluer plus tard vers :

- Protobuf pour `gRPC`
- événements WebSocket métier
- contrats de configuration et d'authentification
