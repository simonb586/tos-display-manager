-- Vérification v0.12.9 Lot 1 — Moteur EDT Enterprise
select to_regclass('public.edt_supports') as edt_supports_table;

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='edt_supports'
order by ordinal_position;

select proname
from pg_proc
where pronamespace='public'::regnamespace
  and proname in (
    'refresh_edt_enterprise',
    'assigner_supports_edt_v0129',
    'retirer_support_edt_v0129',
    'tableau_bord_edt_v0129'
  )
order by proname;

select * from public.tableau_bord_edt_v0129(null) limit 25;

select e.no_edt, es.support_id, es.statut, es.progression, es.assigne_a,
       p.nom as phase, bt.no_bt, i.prochain_edt_cible
from public.edt_supports es
join public.suivi_des_edt e on e.id=es.edt_id
left join public.edt_phases p on p.id=es.phase_id
left join public.bons_de_travail bt on bt.id=es.bon_de_travail_id
left join public.infrastructures i on i.support_id=es.support_id
order by es.updated_at desc
limit 50;
