# Checklist GO / NO-GO

Toute case obligatoire non cochée impose **NO-GO**.

## Environnement

- [ ] Project Ref de préproduction consigné hors de ce paquet.
- [ ] Project URL de préproduction consignée hors de ce paquet.
- [ ] Confirmation écrite exacte : « Cet environnement n’est pas la production. »
- [ ] Production formellement exclue.
- [ ] Méthode d’accès autorisée et opérateur identifié.
- [ ] Sauvegarde, branche isolée ou point de restauration exploitable confirmé et testé.

## Précontrôle

- [ ] Aucune anomalie bloquante; données historiques et audit compatibles.
- [ ] RLS, triggers et tables métier inventoriés.
- [ ] Compteurs, objets JSON, statuts et `updated_at` archivés.

## Migrations

- [ ] Chaque migration et empreinte approuvée; ordre officiel respecté.
- [ ] Arrêt et revue après chaque vérificateur.
- [ ] C1 placé après A8 et avant A9.
- [ ] Anciennes lignes inspectées; état `NOT VALID` compris.
- [ ] Validation C1 autorisée séparément, ou explicitement différée.

## Sécurité

- [ ] Propriétaires, `search_path`, `PUBLIC`, `anon`, `authenticated` et rôle Administrateur conformes.
- [ ] Aucun SQL dynamique ni écriture métier inattendue.
- [ ] RLS et triggers métier identiques au précontrôle.

## Fonctionnel

- [ ] `saved`, `no_change`, `stale_draft`, audit et concurrence conformes.
- [ ] Champs protégés et erreurs contrôlées conformes.

## Non-consommation

- [ ] Aucun effet métier, consommateur, déploiement ou activation.

## Verdict final

- [ ] GO — toutes les conditions sont satisfaites sans réserve.
- [ ] GO avec réserves — réserves écrites, non bloquantes et acceptées.
- [ ] NO-GO — au moins une condition obligatoire manque ou une divergence existe.

Décision, date, opérateur, réviseur et réserves : ______________________________
