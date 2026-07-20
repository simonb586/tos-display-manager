
-- Vérification v0.12.8
select column_name
from information_schema.columns
where table_schema='public' and table_name='infrastructures'
  and column_name in (
    'campagne_precedente','visuel_precedent','edt_precedent_associe',
    'legacy_campagnes_precedentes_quickbase','legacy_edt_precedent_quickbase'
  )
order by column_name;

select proname
from pg_proc
where proname in (
  'finaliser_installation_terrain_v01273',
  'finaliser_intervention_terrain_v01273'
);

select reference,type_operation,support_id,statut,etape,erreur,created_at
from public.terrain_operations
order by created_at desc
limit 50;

select support_id,campagne_actuelle,visuel_campagne,edt_associe,
       campagne_precedente,visuel_precedent,edt_precedent_associe,
       updated_at
from public.infrastructures
order by updated_at desc nulls last
limit 20;

select id,reference,support_id,type_enjeu,description,statut,photo_id,created_at
from public.enjeux_terrain
order by created_at desc
limit 20;
