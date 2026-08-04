# Bloc 13.1.1 — Consolidation finale

## 1. Objectif et périmètre
Revue statique non destructive de A1 à A10, sans fonctionnalité, SQL exécuté, réseau, activation ou déploiement.

## 2. État A1–A10 et inventaire
A1 fournit catalogue, métadonnées et stockages; A2 la consultation; A3 le brouillon général; A3.2 huit contrats gelés; A4–A9 leurs modèles, services RPC, onglets, migrations et vérificateurs; A10 fusion, projection, historique, diagnostics, snapshot et activation désactivée. Les composants administratifs ne sont consommés que par le gestionnaire; les services d’écriture appellent leurs RPC; les modules purs n’ont aucun réseau. Tous restent gelés.

## 3. Matrice des contrats
Tous sont en version 1.0.0. Display : showInGrid/showInForm/showIn360/displayOrder/readonlyOverride. Validation : requiredOverride, longueurs, bornes, valeurs et messages. Permission : generalRule/roleRules/deny-wins/conservativeDeny. Terrain : visibilité, readonly, rôles, section, ordre, champs critiques. ImportExport : disponibilités, noms, alias, défaut, version d’échange. Relation : physique/fonctionnelle, chemins, cardinalité, draft, legacy-authoritative. Calculation : type, dépendances, arbre, null, cycle obligatoire. Activation : statut, versions, acteur/date/portée. `null` hérite; `false`, `0` et tableaux vides restent significatifs. Aucun contrat n’est actif.

## 4. Normalisation et duplications
Listes blanches, comparaison JSON canonique, contrôles de types, protections et erreurs sont répétés. Isolation par contrat : souhaitable. Vérification Administrateur, expected_updated_at, stale_draft et décodage d’erreur : duplication acceptable mais candidate à une petite bibliothèque après préproduction. Normaliseurs SQL/JS parallèles : risque de divergence élevé; ne pas centraliser avant validation réelle. Un moteur universel est déconseillé.

## 5. Services
Les services A4–A9 utilisent le client central et leur RPC, sans retry ni écriture directe. Les réponses convergent sur changed/updatedAt mais contractVersion et exposition explicite de code varient. Ne pas modifier avant tests PostgreSQL; documenter une enveloppe commune future.

## 6. Audit
La table commune porte identités, table/champ, ancien/nouveau, propriétés, statut, versions, date et transaction. Les migrations remplacent successivement la contrainte CHECK des types. Défaut bloquant : A8 limite la contrainte finale à general/display/validation/permission/terrain/import_export; A9 écrit relation/calculation sans l’étendre. A9 échouerait à l’audit et annulerait sa transaction. Une migration corrective additive est requise avant A9. Vérifier aussi request_id/source administrative selon le schéma réel.

## 7. Migrations et ordre
Ordre : précheck; A1/vérificateur; synchronisation seulement si autorisée; A3/vérificateur; A4; A5; A6; A7; A8, chacun suivi de son vérificateur; STOP; correctif d’audit approuvé; A9/vérificateur; postcheck. A10 n’a aucune migration. Risques : dépendance aux objets historiques, CHECK `NOT VALID`, remplacement de contraintes, privilèges, données existantes, rollback incomplet et exécution partielle. Les migrations ne contiennent pas de destruction métier, RLS ou SQL dynamique A13.1 détecté.

## 8. Précontrôles, postcontrôles et rollback
Le paquet `supabase/preproduction-v13.1` contient uniquement documentation et requêtes de lecture. Les compteurs relation_fields/audit/relation_rules doivent rester comparables. Tout écart, privilège inattendu, fonction absente ou erreur est NO-GO. Le rollback repose sur transaction, sauvegarde et migration corrective additive; aucun rollback global automatique n’est déclaré sûr.

## 9. Non-consommation et absence d’activation
Les consommateurs métier contrôlés ne référencent pas les configurations A7–A10 ni le résolveur. A10 retourne consumable=false/theoretical-only; snapshots persisted=false/activationAllowed=false; le bouton Activer est disabled sans handler. Aucun service/RPC/trigger d’activation n’existe.

## 10. Interface et accessibilité
Ordre : Général, Affichage, Validation, Permissions, Mobile/Terrain, Import/Export, Relations et calculs, Historique, Diagnostics, Activation. Les vues d’écriture utilisent brouillon, annulation et sauvegarde; les trois dernières sont théoriques/lecture seule. Revue statique favorable pour labels, fieldsets, alertes, focus visible, 44 px et responsive. Restent obligatoires : clavier complet, NVDA, JAWS, VoiceOver, zoom 200 %, contraste, mobile, piège/inert/retour de focus et annonces.

## 11. Performances et bundle
Dernier build observé avant consolidation : chunk principal environ 9,815 MB minifié et 757 kB gzip; CSS environ 116 kB. Excel/PDF/html2canvas sont les principaux chunks identifiables, avec Excel/exports intégrés au principal. Le gestionnaire ajoute de nombreux onglets statiquement importés. Lazy loading administratif est recommandé, mais non appliqué car il modifierait l’architecture gelée et nécessite une validation UI dédiée. Aucune dépendance ajoutée ou remplacée.

## 12. Doublons, dettes et versions
`src/src`, copies SQL, scripts historiques, `.bak` éventuels et racine parente sont à conserver sans décision utilisateur. Classer `src/src` et migrations historiques comme risque élevé/archivage futur; dist et dépendances doivent être revus séparément. package.json vaut 0.6.3 tandis que les contrats valent 1.0.0 et les phases 13.1 : ce sont des axes distincts. Stratégie recommandée : SemVer application, version immuable par contrat, identifiant de phase dans scripts/RPC/migrations, registre de compatibilité documenté.

## 13. Tests, anomalies et corrections
Ajout d’un vérificateur global et du paquet de préproduction. Aucun fichier gelé modifié. Anomalie bloquante audit A9 documentée, non corrigée. Aucune optimisation fonctionnelle appliquée. Les suites et le build déterminent le verdict final.

## 14. Risques, décisions et recommandation
Risques : contrainte audit A9, validation SQL jamais réelle, rollback incomplet, divergences JS/SQL, accessibilité non exécutée et bundle lourd. Décisions requises : autoriser ou non une migration corrective additive A9; définir sauvegarde/rollback et environnement de préproduction; autoriser ultérieurement une optimisation lazy-loading. Verdict recommandé : **non prêt** tant que le correctif audit A9 n’est pas approuvé et validé; ensuite prêt sous conditions pour préproduction, jamais pour activation.
