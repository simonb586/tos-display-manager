-- Vérificateur v0.12.9 Lots 1 + 2
select 'edt_supports' objet, to_regclass('public.edt_supports') is not null ok
union all select 'relation_execution_logs',to_regclass('public.relation_execution_logs') is not null
union all select 'fonction tableau EDT',to_regprocedure('public.tableau_bord_edt_v0129(bigint)') is not null
union all select 'fonction exécution relation',to_regprocedure('public.executer_relation_rule_v0129(bigint,jsonb,boolean,uuid)') is not null
union all select 'installateur déclencheurs',to_regprocedure('public.installer_declencheurs_relations_v0129()') is not null;

select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and table_name in ('suivi_des_edt','relation_rules','relation_execution_logs')
order by table_name,ordinal_position;

select id,source_table,source_field,destination_table,destination_field,enabled,propagation_mode,condition_json,last_error
from public.relation_rules order by id;
