# Rapport d’exécution — Lot D : moteur EDT

## Résultat

Le moteur EDT v0.13.0 est préparé autour de `edt_supports` comme source de vérité des affectations opérationnelles. Le lot couvre le cycle de vie, l’intégrité EDT–BT, les recalculs, les diagnostics, la réparation en dry-run et un vérificateur SQL transactionnel autonome.

Aucune migration n’a été exécutée et aucune base Supabase n’a été modifiée.

## État initial et causes corrigées

Les deux fichiers préparés ont été revus :

- `supabase/V0_13_0_SECURISATION_SYNC_EDT_BT.sql`
- `supabase/VERIFIER_V0_13_0_SYNC_EDT_BT.sql`

Constats principaux :

- les triggers v0.12.9 pouvaient effectuer des mises à jour croisées inutiles;
- un lien `bons_de_travail.edt_support_id` incohérent pouvait écrire l’état du mauvais support;
- `edt_supports` constituait déjà le registre central, mais son cycle de vie n’était pas normalisé;
- un EDT terminé pouvait rester « Terminé » après la réouverture d’un support;
- `date_fin` pouvait rester renseignée après cette réouverture;
- aucun diagnostic consolidé ne listait les liens asymétriques, identités divergentes, BT manquants ou phases hors EDT;
- aucun dry-run applicatif explicite n’était disponible avant réparation.

## Architecture livrée

### Cycle de vie

Le trigger `normaliser_edt_support_v013` normalise avant écriture :

- progression bornée entre 0 et 100;
- progression à 100 et `completed_at` pour un support terminé;
- statut et indicateur de blocage cohérents;
- remise à zéro de `completed_at` après réouverture;
- validation qu’une phase appartient au même EDT;
- statuts canoniques `Planifié`, `En cours`, `Bloqué`, `Terminé`, `Annulé`.

### Intégrité EDT–BT

La synchronisation BT vers affectation refuse désormais un triplet incohérent :

- `edt_support_id`;
- `edt_id`;
- `support_id`.

La propagation utilise `IS DISTINCT FROM` afin de converger sans boucle d’écriture.

### Recalculs

`refresh_edt_enterprise` est redéfini pour recalculer depuis `edt_supports` :

- compteurs de supports;
- progression des phases;
- progression EDT;
- statut EDT;
- blocage;
- fermeture et réouverture;
- `date_fin`;
- `derniere_synchro`.

Les affectations annulées ne participent pas aux métriques actives.

### Diagnostics

La RPC de lecture `diagnostiquer_integrite_edt_v013` détecte :

- `BT_MANQUANT`;
- `LIEN_BT_ASYMETRIQUE`;
- `IDENTITE_BT_INCOHERENTE`;
- `ETAT_BT_DIVERGENT`;
- `PHASE_HORS_EDT`.

### Réparation contrôlée

`reparer_integrite_edt_v013` :

- utilise `p_apply = false` par défaut;
- retourne les actions proposées sans écriture en dry-run;
- exige explicitement le rôle Administrateur si `p_apply = true`;
- réaligne les BT depuis `edt_supports`;
- relance ensuite les recalculs EDT.

L’application React n’appelle que `p_apply: false`. Aucun bouton d’application réelle n’est exposé.

### Interface

Un panneau « Intégrité EDT–BT » est intégré au moteur EDT pour les gestionnaires :

- lancement manuel du diagnostic;
- tableau triable des incohérences;
- simulation de réparation;
- confirmation visible qu’aucune écriture n’a été réalisée.

Le chargement n’est pas automatique, ce qui évite une erreur lors d’un déploiement applicatif précédant la migration.

## Fichiers du lot D

### Modifiés

- `supabase/V0_13_0_SECURISATION_SYNC_EDT_BT.sql`
- `supabase/VERIFIER_V0_13_0_SYNC_EDT_BT.sql`
- `src/services/operationsService.js`
- `src/components/EdtEnterprisePanel.jsx`
- `src/features/v11/bloc-11-operations.css`

### Créés

- `src/components/EdtIntegrityDiagnostics.jsx`
- `scripts/verifier_moteur_edt_v013.mjs`
- `captures/lot-d-edt-engine-preview.html`
- `captures/lot-d-edt-engine-preview.png`
- `RAPPORT_LOT_D_MOTEUR_EDT.md`

## Nouveaux composants et services

- composant `EdtIntegrityDiagnostics`;
- service `diagnoseEdtIntegrity`;
- service `previewEdtRepair`.

## Migrations SQL

Une migration existante a été complétée :

- `V0_13_0_SECURISATION_SYNC_EDT_BT.sql`.

Le vérificateur associé reste entièrement transactionnel et se termine par `ROLLBACK`. Il peut consommer des valeurs de séquences, mais ne doit laisser aucune ligne métier.

## Tests et build

- vérifications statiques moteur EDT : **20/20**;
- régression tri : **11/11**;
- régression Assistant : **17/17**;
- régression visuels terrain : **11/11**;
- total local : **59/59**;
- `npm.cmd run build` : **réussi**, 2006 modules transformés;
- `git diff --check` : aucune erreur.

Le test SQL transactionnel n’a pas été exécuté contre Supabase, conformément à la consigne. Sa syntaxe et ses invariants ont été contrôlés localement par le script statique, mais la validation PostgreSQL réelle reste obligatoire avant production.

## Risques

### Base et données historiques

- Des valeurs historiques non canoniques peuvent être normalisées à leur prochaine modification.
- Le diagnostic doit être exécuté avant toute réparation active.
- Un dry-run peut révéler des BT manquants; la fonction de réparation actuelle réaligne les BT existants mais ne crée volontairement pas les BT absents.
- L’exécution du vérificateur transactionnel avance potentiellement certaines séquences malgré le `ROLLBACK`.
- Les types historiques de dates et les statuts accentués doivent être confirmés dans l’environnement cible.

### Dépendances avec le lot A

- La fin d’installation terrain peut mettre à jour un BT et donc l’affectation EDT liée.
- Le triplet BT–EDT–support doit être valide avant cette propagation.
- Les visuels restent indépendants du recalcul, mais une erreur d’installation ne doit pas fermer un support EDT.

### Dépendances avec le lot B

- Une automatisation future ne doit jamais écrire directement les agrégats de `suivi_des_edt`.
- Elle doit cibler `edt_supports` ou une RPC métier validée, puis laisser le moteur recalculer.
- L’Assistant demeure documentaire : aucune règle n’exécute cette réparation.

### Dépendances avec le lot C

- Le tableau de diagnostic utilise le moteur de tri local.
- Le tri ne change aucune donnée et n’influence pas l’ordre des réparations SQL.

## Ordre de déploiement recommandé

1. Sauvegarde et relevé des versions des fonctions/triggers actuellement présents.
2. Exécution en préproduction de `V0_13_0_SECURISATION_SYNC_EDT_BT.sql`.
3. Exécution en préproduction de `VERIFIER_V0_13_0_SYNC_EDT_BT.sql`.
4. Diagnostic global avec `diagnostiquer_integrite_edt_v013(null)`.
5. Dry-run global avec `reparer_integrite_edt_v013(null, false)`.
6. Revue humaine des anomalies et décision explicite avant toute réparation active.
7. Déploiement de l’application v0.13.0.
8. Tests d’acceptation EDT, BT, terrain et permissions.
9. Répétition contrôlée en production durant une fenêtre de maintenance.

## Problèmes connus

- Aucune exécution PostgreSQL réelle n’a été autorisée durant ce lot.
- La création automatique d’un BT manquant n’est pas réalisée par la réparation v0.13.0.
- L’application ne propose volontairement aucune réparation active.
- Le build conserve l’avertissement existant sur la taille du bundle principal.

## Capture

`captures/lot-d-edt-engine-preview.png` est un aperçu statique local. Les données affichées sont fictives et aucune connexion à la production n’a été utilisée.

## Contraintes respectées

- dépôt `tos-display-manager-stable`;
- branche `bloc-13-moteur-edt`;
- aucun changement à `.env.local`;
- aucun secret ou changement de dépendance;
- aucune migration exécutée;
- aucune écriture en production;
- aucun commit, push, merge ou déploiement Vercel.
