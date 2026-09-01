-- Strictement READ ONLY — exécuter avant et après V1.3.7.
select id,nom_client,statut from public.clients where id in(1,2) order by id;
select client_id,count(*) infrastructures,count(*)filter(where latitude is not null and longitude is not null) cartographiables from public.infrastructures group by client_id order by client_id;
select client_id,count(*) total,count(*)filter(where client_published) visibles from public.campagnes_maitres group by client_id order by client_id;
select c.client_id,count(*) total,count(*)filter(where p.client_visible) visibles from public.support_photos p join public.campagnes_maitres c on c.id=p.campagne_id group by c.client_id order by c.client_id;
select c.client_id,count(*) total,count(*)filter(where e.client_visible) visibles from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id group by c.client_id order by c.client_id;
select client_id,count(*) total,count(*)filter(where client_visible) visibles from public.activity_events group by client_id order by client_id;
select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('client_portal_list_v1362','admin_preview_client_portal_context_v1362');
