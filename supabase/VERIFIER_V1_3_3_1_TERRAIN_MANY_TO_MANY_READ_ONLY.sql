-- READ ONLY: exécuter après la migration v1.3.3.1.
select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,
  p.proconfig,has_function_privilege('anon',p.oid,'execute') anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'terrain_visual_is_eligible_v1331','lister_visuels_installation_terrain_v1331','finaliser_installation_terrain_v1331'
) order by p.proname;

select indexname,indexdef from pg_indexes
where schemaname='public' and tablename='edt_supports' order by indexname;

select support_id,count(distinct edt_id) edt_count
from public.edt_supports group by support_id having count(distinct edt_id)>1
order by edt_count desc,support_id limit 25;

select i.support_id,i.client_id infrastructure_client,e.id edt_id,e.no_edt,e.client_id edt_client,
  ep.id phase_id,ep.phase_type,c.id campaign_id,c.nom_campagne,c.business_context,c.client_id campaign_client
from public.infrastructures i
join public.edt_supports es on es.support_id=i.support_id
join public.edt_phases ep on ep.id=es.phase_id and ep.edt_id=es.edt_id
join public.suivi_des_edt e on e.id=ep.edt_id
join public.campagnes_maitres c on c.id=e.campagne_id
where i.support_id='VH-VAUD-16' and e.no_edt='EDT-TOS-47-H';

select v.id,v.nom_visuel,c.nom_campagne,c.business_context,v.is_out_of_frame,
  v.client_id visual_client,c.client_id campaign_client
from public.campagne_visuels_formats v join public.campagnes_maitres c on c.id=v.campagne_id
where c.nom_campagne='Civisme' and v.nom_visuel='Voix cell - train';
