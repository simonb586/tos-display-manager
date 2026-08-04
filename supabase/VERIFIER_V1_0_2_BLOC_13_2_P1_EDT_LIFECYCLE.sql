-- READ ONLY — vérification Bloc 13.2-P1.
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and ((table_name='suivi_des_edt' and column_name in ('campagne_id','lifecycle_status','retrait_date_proposee','lifecycle_closed_at','lifecycle_closed_by','lifecycle_exception')) or (table_name='edt_phases' and column_name in ('phase_type','closed_at','closed_by','report_ready_at','commentaire','anomalies','photo_exception','reopened_at','reopened_by','reopen_reason')) or table_name='edt_phase_reports') order by table_name,ordinal_position;

select routine_name from information_schema.routines where routine_schema='public' and routine_name in ('initialiser_cycle_edt_v132p1','transition_phase_edt_v132p1','planifier_retrait_edt_v132p1','fermer_edt_v132p1','marquer_rapport_phase_envoye_v132p1','tdm_edt_audit_v132p1') order by routine_name;

select e.id,e.no_edt,e.lifecycle_status,e.campagne_id,c.nom_campagne,c.date_fin,e.retrait_date_proposee from public.suivi_des_edt e left join public.campagnes_maitres c on c.id=e.campagne_id where e.lifecycle_status<>'brouillon' and (e.campagne_id is null or c.date_fin is null) order by e.id;

select edt_id,phase_type,count(*) from public.edt_phases where phase_type is not null group by edt_id,phase_type having count(*)>1;

select e.id,e.no_edt,i.statut installation_statut,r.statut retrait_statut,e.lifecycle_status from public.suivi_des_edt e left join public.edt_phases i on i.edt_id=e.id and i.phase_type='installation' left join public.edt_phases r on r.edt_id=e.id and r.phase_type='retrait' where e.lifecycle_status='ferme' and (i.statut is distinct from 'fermee' or r.statut is distinct from 'ferme');

select phase_id,version,count(*) from public.edt_phase_reports group by phase_id,version having count(*)>1;

select entity_reference,action,created_at,user_id,details from public.operations_history where entity_type='edt_lifecycle' order by created_at desc limit 100;

select schemaname,tablename,policyname,cmd from pg_policies where schemaname='public' and tablename='edt_phase_reports' order by policyname;
