-- Bloc 2 — Index de recherche
-- À exécuter dans Supabase SQL Editor si la recherche devient lente.
-- Ce script est sécuritaire : il ne supprime aucune donnée.

create index if not exists infrastructures_support_id_idx
on infrastructures (support_id);

create index if not exists infrastructures_site_idx
on infrastructures (site);

create index if not exists liste_des_arrets_no_arret_idx
on liste_des_arrets (no_arret);

create index if not exists suivi_des_edt_no_edt_idx
on suivi_des_edt (no_edt);
