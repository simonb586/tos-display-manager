-- TOS Display Manager — Sprint 7.1
-- Index de base pour accélérer les recherches à grande échelle.
-- Ce script ne supprime aucune donnée.

create index if not exists infrastructures_support_id_search_idx
on public.infrastructures (support_id);

create index if not exists infrastructures_site_search_idx
on public.infrastructures (site);

create index if not exists infrastructures_campagne_search_idx
on public.infrastructures (campagne_actuelle);

create index if not exists liste_des_arrets_no_arret_search_idx
on public.liste_des_arrets (no_arret);

create index if not exists liste_des_arrets_emplacement_search_idx
on public.liste_des_arrets (emplacement_visibilite);
