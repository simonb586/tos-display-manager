# A6 — PermissionConfig : implémentation locale finale

**Statut : code local finalisé; brouillon sans effet immédiat**

## 1. Objectif
Préparer des restrictions UI futures par rôle, sans accorder ni retirer aucun droit réel.

## 2. Périmètre
Modèle pur, stockage préparé, RPC, service, interface administrative, simulation, tests et documentation. Aucune activation.

## 3. Contrat
Le contrat gelé `PermissionConfig` 1.0.0 utilise exclusivement `generalRule`, `roleRules`, `priorityStrategy` et `conservativeDeny`. Les règles utilisent `visible` et `editable`, booléens ou `null`.

## 4. Rôles canoniques
La taxonomie commune relevée localement dans `RoleVisibilityAdmin`, `UserProvisioningPanel`, `RelationsStudio`, `AdminPanel` et `main.jsx` est : Administrateur, Coordonnateur, Installateur, Client-Admin et Client. Un rôle inconnu est conservé pour diagnostic côté JavaScript et refusé par la RPC.

## 5. Stratégie deny-wins
`priorityStrategy` est immuablement `deny-wins`; `conservativeDeny` est immuablement `true`. Aucun refus général ne peut être contourné par une règle de rôle.

## 6. Résolution
La simulation applique : protection physique, refus serveur, refus général, refus du rôle, autorisation générale ou spécifique, puis héritage conservateur. Une autorisation simulée ne prouve jamais une autorisation serveur.

## 7. Stockage
La colonne existante `public.relation_fields.role_permissions` est réutilisée en JSONB. `{}` distingue l’absence de brouillon; la forme canonique explicite les valeurs héritées. `configuration_status` est forcé à `draft`.

## 8. Migration
`supabase/V0_13_1_A6_PERMISSION_DRAFT.sql` est additive, locale et non exécutée. Elle consolide la colonne existante, étend la contrainte d’audit et prépare deux fonctions A6.

## 9. RPC
`public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz)` verrouille la ligne, normalise, détecte la concurrence et écrit uniquement le brouillon.

## 10. Sécurité
RPC `SECURITY DEFINER`, propriétaire `postgres`, `search_path=pg_catalog`, objets qualifiés, PUBLIC et anon révoqués, authenticated autorisé après `auth.uid()` et `current_app_role()='Administrateur'`. Aucun SQL dynamique, RLS ou rôle créé.

## 11. Concurrence
`p_expected_updated_at` est obligatoire; la ligne est verrouillée par `SELECT ... FOR UPDATE`.

## 12. Audit
L’audit commun `public.relation_field_config_audit` reçoit `configuration_type=permission`, `contract_name=PermissionConfig`, version 1.0.0 et `event_type=permission_draft_saved` dans la transaction d’écriture.

## 13. Normalisation
JavaScript et SQL refusent les propriétés inconnues, imposent les deux capacités tri-état et produisent une forme stable. Le modèle JavaScript expose aussi comparaison, `no_change`, contradictions et raisons de décision.

## 14. Service
`fieldCatalogPermissionWriteService.js` utilise le client central et une seule RPC, sans retry, écriture directe ou repli.

## 15. Interface
L’onglet administratif Permissions affiche la bannière de brouillon, l’avertissement RLS, les règles générales, la matrice et uniquement Annuler/Enregistrer le brouillon.

## 16. Matrice
Chaque rôle canonique dispose de choix Hériter, Autoriser et Refuser pour visibilité et modification. Les rôles inconnus historiques produisent un diagnostic.

## 17. Prévisualisation
La projection est locale, fictive et sans service. Elle affiche décisions et codes de raison pour visibilité et modification.

## 18. Accessibilité
Les groupes utilisent `fieldset`/`legend`, des labels explicites, des contrôles de 44 px, des états `alert`/`status`, un focus visible et une disposition responsive. Le dialogue de changements non sauvegardés existant est réutilisé.

## 19. no_change
Le hook court-circuite localement une configuration inchangée. La RPC retourne aussi `no_change` sans UPDATE ni audit après comparaison canonique.

## 20. stale_draft
Un horodatage différent déclenche `stale_draft`; les changements locaux restent intacts et aucun fusionnement automatique n’est effectué.

## 21. Tests
`verify_field_catalog_permissions_v0131a6.mjs` couvre contrat, rôles, résolution, sécurité SQL, service, UI, interdictions et non-consommation.

## 22. Non-consommation
Le résolveur A6 n’est référencé par aucune surface métier. L’unique branchement est l’onglet du catalogue administratif. Authentification, RoleVisibilityAdmin, services métier, Terrain, fiche 360, Relations Studio, grilles, formulaires, imports et exports restent inchangés.

## 23. Build
Le build Vite fait partie de `npm run check`. L’avertissement historique de taille du bundle reste hors périmètre.

## 24. Risques résiduels
Le SQL n’étant pas exécuté, sa compatibilité réelle avec une préproduction reste à vérifier manuellement. Une taxonomie de rôles divergente dans une future version devra être traitée par une nouvelle version explicite.

## 25. Validations manuelles
Après autorisation distincte : revue SQL, exécution manuelle en SQL Editor sur préproduction, vérificateur SQL non mutatif, essais navigateur clavier/lecteur d’écran/responsive et scénarios multi-administrateurs.

## 26. Recommandation pour A7
Ne pas commencer A7 sans autorisation explicite. A6 doit rester déclarative et non consommée jusqu’à une activation séparée en A10.
