-- Phase 13.1-A6 — fichier local non exécuté. Brouillons PermissionConfig uniquement.
begin;
alter table public.relation_fields alter column role_permissions set default '{}'::jsonb, alter column role_permissions set not null;
comment on column public.relation_fields.role_permissions is 'Brouillon PermissionConfig 1.0.0; aucune autorité sur RLS ou les droits réels.';
do $$ begin
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_fields'::pg_catalog.regclass and conname='relation_fields_role_permissions_object_v0131a6_check') then
    alter table public.relation_fields add constraint relation_fields_role_permissions_object_v0131a6_check check(pg_catalog.jsonb_typeof(role_permissions)='object') not valid;
  end if;
  if exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v0131a5_check') then
    alter table public.relation_field_config_audit drop constraint relation_field_config_audit_type_v0131a5_check;
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.relation_field_config_audit'::pg_catalog.regclass and conname='relation_field_config_audit_type_v0131a6_check') then
    alter table public.relation_field_config_audit add constraint relation_field_config_audit_type_v0131a6_check check(configuration_type is null or configuration_type in('general','display','validation','permission')) not valid;
  end if;
end $$;

create or replace function public.normalize_permission_config_v0131a6(p_config jsonb) returns jsonb language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare v_key text;v_role text;v_rule jsonb;v_cap text;v_roles constant text[]:=array['Administrateur','Coordonnateur','Installateur','Client-Admin','Client'];v_general jsonb;v_role_rules jsonb;
begin
 if p_config is null or pg_catalog.jsonb_typeof(p_config)<>'object' then raise exception using message='PermissionConfig invalide.',detail='{"code":"invalid_payload"}';end if;
 for v_key in select pg_catalog.jsonb_object_keys(p_config) loop if v_key not in('generalRule','roleRules','priorityStrategy','conservativeDeny') then raise exception using message='Propriété inconnue.',detail=pg_catalog.jsonb_build_object('code','unknown_property','field',v_key)::text;end if;end loop;
 if coalesce(p_config->>'priorityStrategy','deny-wins')<>'deny-wins' or coalesce((p_config->>'conservativeDeny')::boolean,true)is not true then raise exception using message='deny-wins et conservativeDeny sont obligatoires.',detail='{"code":"unsafe_strategy"}';end if;
 v_general:=coalesce(p_config->'generalRule','null'::jsonb);v_role_rules:=coalesce(p_config->'roleRules','null'::jsonb);
 if v_general<>'null'::jsonb then
  if pg_catalog.jsonb_typeof(v_general)<>'object' then raise exception using message='Règle générale invalide.',detail='{"code":"invalid_general_rule"}';end if;
  for v_cap in select pg_catalog.jsonb_object_keys(v_general) loop if v_cap not in('visible','editable') or (v_general->v_cap<>'null'::jsonb and pg_catalog.jsonb_typeof(v_general->v_cap)<>'boolean') then raise exception using message='Capacité invalide.',detail='{"code":"invalid_rule"}';end if;end loop;
  v_general:=pg_catalog.jsonb_build_object('visible',coalesce(v_general->'visible','null'::jsonb),'editable',coalesce(v_general->'editable','null'::jsonb));
 end if;
 if v_role_rules<>'null'::jsonb then
  if pg_catalog.jsonb_typeof(v_role_rules)<>'object' then raise exception using message='Règles de rôles invalides.',detail='{"code":"invalid_role_rules"}';end if;
  for v_role,v_rule in select key,value from pg_catalog.jsonb_each(v_role_rules) loop
   if not(v_role=any(v_roles)) then raise exception using message='Rôle inconnu.',detail=pg_catalog.jsonb_build_object('code','unknown_role','field',v_role)::text;end if;
   if pg_catalog.jsonb_typeof(v_rule)<>'object' then raise exception using message='Règle de rôle invalide.',detail='{"code":"invalid_role_rule"}';end if;
   for v_cap in select pg_catalog.jsonb_object_keys(v_rule) loop if v_cap not in('visible','editable') or (v_rule->v_cap<>'null'::jsonb and pg_catalog.jsonb_typeof(v_rule->v_cap)<>'boolean') then raise exception using message='Capacité invalide.',detail='{"code":"invalid_rule"}';end if;end loop;
   v_role_rules:=pg_catalog.jsonb_set(v_role_rules,array[v_role],pg_catalog.jsonb_build_object('visible',coalesce(v_rule->'visible','null'::jsonb),'editable',coalesce(v_rule->'editable','null'::jsonb)),false);
  end loop;
 end if;
 return pg_catalog.jsonb_build_object('generalRule',v_general,'roleRules',v_role_rules,'priorityStrategy','deny-wins','conservativeDeny',true);
end $$;
alter function public.normalize_permission_config_v0131a6(jsonb) owner to postgres;
revoke all on function public.normalize_permission_config_v0131a6(jsonb) from public,anon,authenticated;

create or replace function public.save_relation_field_permission_draft_v0131a6(p_table_name text,p_field_name text,p_contract_version text,p_permission_config jsonb,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_old public.relation_fields%rowtype;v_old_config jsonb;v_new_config jsonb;v_changed text[]:=array[]::text[];v_key text;v_actor uuid:=auth.uid();v_role text;v_updated_at timestamptz;
begin
 v_role:=public.current_app_role();if v_actor is null then raise exception using message='Authentification requise.',detail='{"code":"unauthorized"}';end if;if v_role<>'Administrateur' then raise exception using message='Permission administrateur requise.',detail='{"code":"administrator_required"}';end if;
 if p_contract_version is distinct from '1.0.0' then raise exception using message='Version non supportée.',detail='{"code":"unsupported_contract_version"}';end if;if p_expected_updated_at is null then raise exception using message='Horodatage obligatoire.',detail='{"code":"invalid_payload","field":"expectedUpdatedAt"}';end if;
 select * into v_old from public.relation_fields where table_name=p_table_name and field_name=p_field_name for update;if not found then raise exception using message='Champ inconnu.',detail='{"code":"field_not_found"}';end if;if v_old.updated_at is distinct from p_expected_updated_at then raise exception using message='Brouillon obsolète.',detail='{"code":"stale_draft"}';end if;
 if coalesce(v_old.physical_is_primary_key,false)or coalesce(v_old.physical_is_foreign_key,false)or coalesce(v_old.physical_is_generated,false)or coalesce(v_old.physical_is_identity,false)or v_old.field_type='calculated'or lower(v_old.field_name)in('id','support_id','created_at','updated_at','deleted_at','auth_user_id','photo_principale_url','photo_miniature_url','visuel_actuel_cadre')or lower(v_old.field_name)like '%\_id' escape '\' then raise exception using message='Champ protégé.',detail='{"code":"field_protected"}';end if;
 v_new_config:=public.normalize_permission_config_v0131a6(p_permission_config);v_old_config:=public.normalize_permission_config_v0131a6(case when v_old.role_permissions='{}'::jsonb then '{}'::jsonb else v_old.role_permissions end);
 if v_old_config=v_new_config and v_old.configuration_status='draft' then return pg_catalog.jsonb_build_object('ok',true,'changed',false,'code','no_change','permissionConfig',v_old_config,'contractVersion','1.0.0','updatedAt',v_old.updated_at);end if;
 foreach v_key in array array['generalRule','roleRules','priorityStrategy','conservativeDeny'] loop if v_old_config->v_key is distinct from v_new_config->v_key then v_changed:=pg_catalog.array_append(v_changed,v_key);end if;end loop;
 update public.relation_fields set role_permissions=v_new_config,configuration_status='draft',updated_at=pg_catalog.now() where id=v_old.id returning updated_at into v_updated_at;
 insert into public.relation_field_config_audit(relation_field_id,table_name,field_name,old_values,new_values,changed_by,changed_at,configuration_status,audit_schema_version,configuration_type,contract_name,contract_version,changed_properties,actor_user_id,occurred_at,transaction_id,actor_app_role,event_type)values(v_old.id,v_old.table_name,v_old.field_name,pg_catalog.jsonb_build_object('permissionConfig',v_old_config,'configuration_status',v_old.configuration_status),pg_catalog.jsonb_build_object('permissionConfig',v_new_config,'configuration_status','draft'),v_actor,pg_catalog.now(),'draft','1.0.0','permission','PermissionConfig','1.0.0',v_changed,v_actor,pg_catalog.now(),pg_catalog.txid_current()::text,v_role,'permission_draft_saved');
 return pg_catalog.jsonb_build_object('ok',true,'changed',true,'code','saved','permissionConfig',v_new_config,'contractVersion','1.0.0','updatedAt',v_updated_at,'changedProperties',pg_catalog.to_jsonb(v_changed));
end $$;
alter function public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz) owner to postgres;
revoke all on function public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz) to authenticated;
comment on function public.save_relation_field_permission_draft_v0131a6(text,text,text,jsonb,timestamptz)is 'Sauvegarde un brouillon PermissionConfig 1.0.0; aucune activation ni autorité RLS.';
commit;
