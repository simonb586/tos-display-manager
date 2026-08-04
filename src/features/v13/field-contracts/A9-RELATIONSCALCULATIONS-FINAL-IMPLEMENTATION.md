# A9 — Relations et calculs : implémentation locale finale

**Statut : brouillons sans effet; relation_rules reste autoritaire**

## 1–3. Objectif, périmètre, contrats
RelationConfig 1.0.0 : physicalRelation, functionalRelation, sourceTable, sourceField, targetTable, targetField, cardinality, status, relationRulesCompatibility. CalculationConfig 1.0.0 : calculationType, dependencies, expression, nullHandling, cycleDetection.
## 4–7. Inventaire et autorité
RelationsStudio et relationService lisent/écrivent `relation_rules`, dont les chemins source/destination, état, confirmations et propagation pilotent les fonctions/triggers historiques. Les métadonnées physiques de relation_fields décrivent FK, unicité, génération et identité. A9 ne modifie rien de cet ensemble; `relation_rules` reste l’autorité.
## 8–14. Stockage, SQL, RPC, sécurité, concurrence, audit
Les JSONB existants `relation_config` et `calculation_config` sont réutilisés. Migration non exécutée; normaliseur SQL; RPC séparées `save_relation_field_relation_draft_v0131a9` et `save_relation_field_calculation_draft_v0131a9`, SECURITY DEFINER, postgres, pg_catalog, authenticated seulement après contrôles, verrou et stale_draft. Audits communs relation/calculation, transactionnels.
## 15–23. Normalisation, services, interface, éditeurs, dépendances, cycles, diagnostics, aperçu
Le modèle pur impose draft/legacy-authoritative, cardinalités fermées, types arithmetic/concat/coalesce, null handling fermé et arbres JSON literal/field/operation avec opérateurs add, subtract, multiply, divide, concat, coalesce. Graphe, cycles et ordre topologique sont simulés sans exécution. Deux services RPC sans retry/repli. L’onglet fournit sous-vues, diagnostics et aperçu fictif.
## 24–28. Accessibilité, no_change, stale_draft, tests, non-consommation
Labels, fieldsets, clavier, ARIA, 44 px et responsive. Comparaison canonique/no_change, stale_draft sans fusion. Tests statiques couvrent cycles, expressions, SQL et isolation. Studio, relationService, triggers, relation_rules et métiers ne consomment pas A9.
## 29–32. Build, risques, validations, A10
Build inclus au check. Restent validation PostgreSQL manuelle, comparaison réelle aux règles/contraintes, concurrence et navigateur. Ne pas commencer A10 sans autorisation explicite.
