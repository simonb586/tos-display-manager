# Rapport — LOT B — Assistant d’automatisation

Date : 23 juillet 2026
Branche : `bloc-13-moteur-edt`
Commit de départ : `c4a16fa9f0ff808517e823270ead41f76888a70a`

## Résultat

Le module administrateur « Assistant d’automatisation » remplace l’entrée directe
« Studio des relations » dans la navigation.

Le Mode simple est affiché par défaut et permet :

- création et modification d’un brouillon;
- déclencheurs multiples;
- emplacements multiples;
- sélection des modules;
- chargement dynamique des champs du schéma autorisé;
- provenance et action pour chaque champ;
- conditions et condition personnalisée;
- actions suivant l’opération;
- destinataires des notifications;
- état et priorité;
- aperçu JSON structuré;
- liste en cartes;
- duplication, validation/activation, désactivation et suppression.

Le Mode avancé rend le composant `RelationsStudio` existant. Ses fonctions n’ont
pas été retirées.

## Sécurité et absence d’exécution

Le Mode simple écrit uniquement dans `automation_definitions`.

Le service ne référence pas :

- `relation_rules`;
- `executeRelationRule`;
- `installRelationTriggers`.

Choisir « Active » dans le formulaire enregistre d’abord `pending_validation`.
L’activation exige la RPC administrateur `approve_automation_definition_v0131`.
Toute modification du nom, de la priorité ou de la définition révoque
l’approbation et remet une automatisation active à valider.

Les droits de mise à jour directs n’incluent pas `approved_by` et `approved_at`.

## Nouveaux composants

- `src/components/AutomationAssistant.jsx`

Ce composant contient la coquille Simple/Avancé, le formulaire, les cartes et les
contrôles de cycle de vie.

## Nouveaux services et catalogues

- `src/services/automationService.js`
- `src/config/automationCatalog.js`

## Migration SQL préparée

- `supabase/V0_13_1_AUTOMATION_ASSISTANT.sql`
- `supabase/VERIFIER_V0_13_1_AUTOMATION_ASSISTANT.sql`

La migration crée :

- `automation_definitions`;
- politiques RLS administrateur;
- permissions de colonnes;
- trigger de révocation d’approbation;
- RPC d’approbation explicite.

Elle ne crée aucun déclencheur vers une table métier et ne traduit aucune
configuration vers le Studio des relations.

Les SQL n’ont pas été exécutés sur Supabase.

## Fichiers modifiés

- `src/main.jsx`

## Fichiers créés

- `src/components/AutomationAssistant.jsx`
- `src/config/automationCatalog.js`
- `src/services/automationService.js`
- `src/features/v13/automation-assistant.css`
- `scripts/verifier_automation_assistant_v0131.mjs`
- `supabase/V0_13_1_AUTOMATION_ASSISTANT.sql`
- `supabase/VERIFIER_V0_13_1_AUTOMATION_ASSISTANT.sql`
- `captures/lot-b-preview.html`
- `captures/lot-b-assistant-preview.png`
- `RAPPORT_LOT_B_ASSISTANT_AUTOMATISATION.md`

## Tests exécutés

Commande :

```text
node scripts/verifier_automation_assistant_v0131.mjs
```

Résultat : `OK: 17 vérifications de l’Assistant réussies.`

Les tests contrôlent :

- unicité des clés de tous les catalogues;
- présence des libellés;
- valeurs initiales du brouillon;
- absence de dépendance du service envers le moteur exécutable de relations.

`git diff --check` ne relève aucune erreur.

Le vérificateur SQL est préparé, mais n’a pas été exécuté.

## Build

Commande :

```text
npm.cmd run build
```

Résultat : succès.

- Vite 6.4.3;
- 2 000 modules transformés;
- durée : 51,57 secondes.

Avertissement non bloquant connu : le fragment JavaScript principal dépasse 500 kB.

## Captures

- `captures/lot-b-assistant-preview.png`

La capture est un aperçu local hors données construit avec les styles et la structure
du nouveau module. Elle ne contourne pas l’authentification et n’utilise aucun compte,
secret ou contenu de production.

La capture réelle authentifiée devra être réalisée en Preview après installation de
la migration et avec un compte administrateur de test.

## Risques et problèmes connus

- L’interface nécessite la table `automation_definitions`; la migration doit être
  installée dans l’environnement ciblé avant le code applicatif.
- Le catalogue des champs dépend de `list_public_schema_fields`.
- Les modules Tableau de bord, Rapports, Notifications et Autre restent documentaires
  et n’exposent aucun champ SQL.
- Le Mode simple ne valide pas encore chaque clé JSON côté base avec un schéma JSON
  exhaustif; il applique des contraintes structurelles et des catalogues côté client.
- Aucune notification n’est envoyée et aucune action métier n’est exécutée.
- La taille du fragment principal reste élevée; un chargement différé du Studio et
  de l’Assistant pourra être ajouté plus tard.

## Contraintes respectées

- travail uniquement dans `tos-display-manager-stable`;
- branche `bloc-13-moteur-edt`;
- aucune modification de `.env.local`;
- aucun secret lu ou modifié;
- aucun push, merge ou déploiement;
- aucune migration exécutée;
- aucune base de production modifiée;
- aucune règle activée automatiquement.
