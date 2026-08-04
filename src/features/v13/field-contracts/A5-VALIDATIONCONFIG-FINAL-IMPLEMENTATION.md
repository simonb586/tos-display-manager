# 13.1-A5 — Implémentation finale de ValidationConfig 1.0.0

**Statut : implémentation locale terminée — approbation requise**

## 1. Objectif

Fournir un module administratif complet permettant de préparer et sauvegarder
des brouillons `ValidationConfig 1.0.0`, sans les activer ni les consommer dans
une surface métier.

## 2. Périmètre

A5 comprend une migration additive non exécutée, un normaliseur SQL, une RPC
administrative, l’audit commun enrichi, un normaliseur client pur, un service,
un hook local, un onglet Validation, une prévisualisation fictive, un
vérificateur SQL non mutatif et une suite locale globale.

A6, l’activation et les consommateurs métier sont exclus.

## 3. Architecture

```text
FieldCatalogValidationTab
  ├─ useFieldValidationDraft
  │   ├─ normalizeValidationConfig
  │   └─ fieldCatalogValidationWriteService
  │        └─ RPC save_relation_field_validation_draft_v0131a53
  └─ FieldValidationAdminPreview (fictif et local)

RPC
  ├─ verrou relation_fields FOR UPDATE
  ├─ contrôle expected_updated_at
  ├─ normalize_validation_config_v0131a5
  ├─ no_change sans écriture
  └─ UPDATE validation_rules + audit commun atomique
```

## 4. Fichiers créés

- `supabase/V0_13_1_A5_VALIDATION_DRAFT.sql`;
- `supabase/VERIFIER_V0_13_1_A5_VALIDATION_DRAFT.sql`;
- `src/lib/fieldCatalogValidationDraft.js`;
- `src/services/fieldCatalogValidationWriteService.js`;
- `src/hooks/useFieldValidationDraft.js`;
- `src/components/field-catalog/FieldCatalogValidationTab.jsx`;
- `src/components/field-catalog/validation/FieldValidationAdminPreview.jsx`;
- `src/features/v13/field-catalog-validation.css`;
- `scripts/verify_field_catalog_validation_v0131a5.mjs`;
- le présent document.

## 5. Fichiers modifiés

- `src/components/field-catalog/tabRegistry.js`;
- `package.json`.

Les contrats A3.2, DisplayConfig et les fichiers A1 à A4.5 gelés n’ont pas été
modifiés.

## 6. Stockage

- table : `public.relation_fields`;
- colonne existante : `validation_rules jsonb NOT NULL DEFAULT '{}'`;
- clé interne : `id`;
- identité logique vérifiée : `(table_name, field_name)`;
- statut : `configuration_status`, hors ValidationConfig.

`{}` signifie aucune configuration préparée. La forme canonique entièrement
`null` signifie brouillon explicitement hérité. Aucune seconde colonne
ValidationConfig n’est créée.

## 7. Forme canonique

```json
{
  "requiredOverride": null,
  "minimumLength": null,
  "maximumLength": null,
  "minimumValue": null,
  "maximumValue": null,
  "allowedValues": null,
  "errorMessages": null
}
```

Les sept clés sont toujours produites. `false` et `0` sont préservés. La version
est transmise à la RPC et enregistrée dans l’audit, pas dans `validation_rules`.

## 8. Migration

La migration locale :

- consolide le défaut et la nullabilité existants de `validation_rules`;
- ajoute une CHECK minimale sur le type objet;
- ajoute `actor_app_role` et `event_type` à l’audit commun;
- remplace la contrainte de type d’audit par une version acceptant
  `general`, `display` et `validation`;
- crée le normaliseur et la RPC versionnés;
- configure propriétaire et privilèges;
- ne modifie aucune table métier, donnée historique ou politique RLS.

Elle n’a pas été exécutée. Le remplacement de la CHECK d’audit ne supprime
aucune donnée; il étend seulement son domaine autorisé.

## 9. Fonctions SQL

`public.normalize_validation_config_v0131a5(jsonb) returns jsonb` :

- `IMMUTABLE`;
- `SECURITY INVOKER`;
- `search_path=pg_catalog`;
- liste blanche;
- sept clés canoniques;
- validation des types et conflits;
- contrôle de `allowedValues` et `errorMessages`;
- aucune table, écriture ou SQL dynamique.

## 10. RPC

```text
public.save_relation_field_validation_draft_v0131a53(
  text,
  text,
  text,
  jsonb,
  timestamptz
) returns jsonb
```

Paramètres : table logique, champ, version, configuration et
`p_expected_updated_at`.

Résultats : `saved` ou `no_change`. Les erreurs contrôlées utilisent un message
système et un détail JSON avec code machine.

## 11. Sécurité

- `SECURITY DEFINER`;
- propriétaire `postgres`;
- `SET search_path = pg_catalog`;
- objets applicatifs qualifiés `public.`;
- `PUBLIC` et `anon` révoqués;
- `authenticated` seul autorisé;
- `auth.uid()` obligatoire;
- rôle `Administrateur` obligatoire;
- écritures limitées à `relation_fields` et
  `relation_field_config_audit`;
- aucun SQL dynamique;
- aucune cible arbitraire.

## 12. Concurrence

La ligne est chargée `FOR UPDATE`. `p_expected_updated_at` est obligatoire.
Après verrouillage, toute divergence produit `stale_draft` avant normalisation,
UPDATE ou audit.

Le client conserve alors ses modifications, ne fusionne et ne retente rien
automatiquement. Un rechargement explicite est requis.

## 13. Normalisation cliente

Le module pur :

- refuse toute propriété inconnue;
- conserve les sept clés;
- préserve `false` et `0`;
- compte les points de code avec `Array.from`;
- refuse notation scientifique, chaînes numériques, nombres non finis,
  longueurs négatives/décimales et conflits;
- valide taille, types, ordre et doublons de `allowedValues`;
- normalise les espaces extérieurs des messages;
- refuse message vide, trop long, HTML, JavaScript et interpolation;
- ne mute pas l’entrée et ne contient aucun réseau.

## 14. Service

Le service appelle une seule fois la RPC centralisée et transmet les cinq
paramètres. Il ne contient ni retry, `.from().update()`, insert, upsert ou
écriture directe de repli. Il conserve les codes contrôlés, notamment
`stale_draft`.

## 15. Interface

L’onglet Validation permet :

- Exigence : Hériter, Requis, Non requis;
- longueurs minimale et maximale;
- bornes numériques;
- ajout, suppression, typage et réorganisation de valeurs permises;
- six messages fonctionnels;
- compteurs de valeurs et points de code;
- Annuler et Enregistrer le brouillon.

Une règle stockée incompatible reste visible. Les champs protégés sont affichés
en lecture seule avec leurs raisons. `technical_name_locked` seul ne bloque pas
l’onglet.

## 16. Compatibilité par type

- texte : required, longueurs, valeurs permises, messages;
- nombre/currency : required, bornes, valeurs permises, messages;
- booléen/sélections : required, valeurs permises, messages;
- date/datetime : required et messages;
- relation/fichier/photo : compatibilité restrictive;
- calculé, système, virtuel ou protégé : lecture seule.

Le serveur demeure l’autorité finale et refuse toute propriété incompatible.

## 17. Prévisualisation

L’aperçu utilise seulement des données fictives : `Exemple de valeur`,
`ABC-123`, `1250` et valeurs administratives courantes. Il montre exigence,
longueurs, bornes, choix et message. Il n’appelle aucun service et ne modifie
pas le brouillon.

## 18. Accessibilité

- labels, fieldset/legend réutilisé pour l’exigence;
- descriptions conditionnelles sans identifiant absent;
- `aria-invalid`;
- erreur principale focalisée;
- `role=alert` pour erreur et `stale_draft`;
- focus visible;
- boutons d’au moins 44 px;
- éléments protégés désactivés;
- disposition responsive à 700 px et 420 px;
- dialogue de navigation non sauvegardée réutilisé du drawer.

Restent à vérifier dans un navigateur réel : parcours clavier complet,
lecteur d’écran, contraste, zoom 200 %, responsive réel et retour du focus du
dialogue.

## 19. `no_change`

Le hook compare localement les formes canoniques et évite la RPC. Le serveur
recalcule toujours `no_change` après verrouillage pour les appels reçus.

Si identique et déjà `draft` :

- aucun UPDATE;
- aucun audit;
- `updated_at` inchangé;
- réponse `changed=false`, `code=no_change`.

## 20. `stale_draft`

Un horodatage absent est refusé localement et par la RPC. Un horodatage obsolète
produit `stale_draft`, sans écriture ni audit. Le hook conserve `initial`,
`draft` et les saisies, focalise l’alerte et demande un rechargement manuel.

## 21. Audit

Infrastructure unique : `public.relation_field_config_audit`.

Événement :

- `configuration_type='validation'`;
- `event_type='validation_draft_saved'`;
- acteur et `actor_app_role`;
- champ stable;
- configurations avant/après;
- version `1.0.0`;
- propriétés modifiées;
- statut `draft`;
- date serveur et transaction.

L’UPDATE et l’INSERT sont atomiques. Aucun audit n’est produit pour erreur,
`stale_draft` ou `no_change`.

## 22. Tests

La suite `test:bloc13.1a5` couvre :

- toutes les propriétés et valeurs limites;
- Unicode;
- nombres non finis et notation invalide;
- limites 100/500/65 536;
- doublons stricts et ordre;
- clés et contenu de messages;
- protections et types;
- forme et sécurité SQL;
- signature, concurrence, audit et `no_change`;
- service unique et absence de repli;
- états du hook;
- interface, prévisualisation et accessibilité déclarative;
- absence d’actions interdites;
- non-consommation métier.

Les suites A1 à A4.5 et les Blocs 13.2/13.3 restent incluses dans `npm run check`.

## 23. Non-consommation

Les vérifications excluent tout branchement dans `EditableField`,
`universalEditorService`, `TerrainApp`, `Support360Panel`,
`RelationsStudio`, `relationService` et `main.jsx`. Aucun comportement métier
ne lit les sept propriétés.

## 24. Résultat du build

Le build Vite local réussit. L’échec initial dans `npm run check` est uniquement
la restriction de lecture du bac à sable sur le répertoire parent; le build
relancé avec cette restriction locale levée réussit. L’avertissement historique
de taille de chunk reste non bloquant et hors périmètre.

## 25. Risques résiduels

- migration et normaliseur SQL non validés sur PostgreSQL réel;
- compatibilité Unicode client/PostgreSQL à confirmer;
- contenu historique de `validation_rules` à inventorier;
- comportement PostgREST des détails d’erreur à confirmer;
- expérience clavier/lecteur d’écran à tester réellement;
- `field_type` absent provoque un refus conservateur côté serveur;
- aucune activation ni évaluation de valeur métier n’est testée ou prévue.

## 26. Validations manuelles restantes

Avant toute préproduction :

1. confirmer l’environnement et le point de restauration;
2. inventorier `validation_rules` en lecture seule;
3. appliquer la migration uniquement après autorisation;
4. exécuter le vérificateur A5;
5. vérifier propriétaires, ACL, search_path et contraintes;
6. tester Administrateur, non-administrateur et concurrence réelle;
7. tester rollback d’audit;
8. valider clavier, lecteur d’écran, zoom et mobile;
9. confirmer qu’aucune table métier/RLS n’a changé.

## 27. Garanties d’isolation

- migration non exécutée;
- aucun SQL envoyé à un environnement;
- aucun projet Supabase contacté;
- aucun déploiement ou synchronisation;
- aucune table métier ou RLS modifiée;
- aucun retry ou fallback direct;
- aucune expression configurable;
- aucune activation;
- DisplayConfig inchangé.

## 28. Recommandation pour A6

Ne pas commencer A6 automatiquement. A5 doit d’abord être approuvée au niveau
du code local, puis validée en préproduction sous protocole contrôlé. A6 devra
faire l’objet d’une spécification distincte des permissions et ne devra pas
transformer implicitement les brouillons A5 en règles actives.
