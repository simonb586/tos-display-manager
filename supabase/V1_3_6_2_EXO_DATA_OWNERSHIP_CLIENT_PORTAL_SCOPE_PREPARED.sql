-- PREPARATION UNIQUEMENT - V1.3.6.2 - NE PAS EXECUTER AVANT APPROBATION.
-- Migration additive et transactionnelle. Aucun identifiant EXO n'est code en dur.
begin;

do $$
declare v_exo_count integer; v_exo_id bigint;
begin
  select count(*),min(id) into v_exo_count,v_exo_id
  from public.clients
  where regexp_replace(translate(lower(trim(nom_client)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g')='exo';
  if v_exo_count=0 then raise exception 'V1362_EXO_ABSENT'; end if;
  if v_exo_count>1 then raise exception 'V1362_EXO_MULTIPLE: % clients',v_exo_count; end if;

  -- Racines et objets autonomes: client direct. Les descendants restent derivables,
  -- mais la colonne explicite permet le diagnostic et bloque les futurs orphelins.
  alter table public.infrastructures add column if not exists client_id bigint references public.clients(id) on delete restrict;
  alter table public.campagnes_supports add column if not exists client_id bigint references public.clients(id) on delete restrict;
  alter table public.campagne_visuels_formats add column if not exists client_id bigint references public.clients(id) on delete restrict;
  alter table public.support_photos add column if not exists client_id bigint references public.clients(id) on delete restrict;
  alter table public.suivi_des_edt add column if not exists client_id bigint references public.clients(id) on delete restrict;
  alter table public.edt_phases add column if not exists client_id bigint references public.clients(id) on delete restrict;
  alter table public.enjeux_terrain add column if not exists client_id bigint references public.clients(id) on delete restrict;
  alter table public.bons_de_travail add column if not exists client_id bigint references public.clients(id) on delete restrict;
  alter table public.requetes_clients add column if not exists client_id bigint references public.clients(id) on delete restrict;

  -- Toute attribution explicite actuelle differente d'EXO est une contradiction.
  if exists(select 1 from public.campagnes_maitres where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.infrastructures where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.campagnes_supports where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.campagne_visuels_formats where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.support_photos where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.suivi_des_edt where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.edt_phases where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.enjeux_terrain where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.bons_de_travail where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.requetes_clients where client_id is not null and client_id<>v_exo_id)
    or exists(select 1 from public.communications_finales where client_id is not null and client_id<>v_exo_id)
    or exists(
      select 1 from public.activity_events a
      where nullif(trim(a.client_id),'') is not null and (
        (trim(a.client_id)~'^[0-9]+$' and trim(a.client_id)::bigint<>v_exo_id)
        or (trim(a.client_id)!~'^[0-9]+$' and (
          select count(*)<>1 or min(c.id)<>v_exo_id from public.clients c
          where regexp_replace(translate(lower(trim(c.nom_client)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g')
              =regexp_replace(translate(lower(trim(a.client_id)),'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ','aaaaaaceeeeiiiinooooouuuuyy'),'[^a-z0-9]+','','g')
        ))
      )
    )
  then raise exception 'V1362_EXISTING_OTHER_CLIENT_CONTRADICTION'; end if;

  -- Une relation enfant/parent contradictoire est refusee avant toute reecriture.
  if exists(select 1 from public.campagnes_supports x join public.campagnes_maitres c on c.id=x.campagne_id where x.client_id is not null and c.client_id is not null and x.client_id<>c.client_id)
    or exists(select 1 from public.support_photos x join public.campagnes_maitres c on c.id=x.campagne_id where x.client_id is not null and c.client_id is not null and x.client_id<>c.client_id)
    or exists(select 1 from public.suivi_des_edt x join public.campagnes_maitres c on c.id=x.campagne_id where x.client_id is not null and c.client_id is not null and x.client_id<>c.client_id)
    or exists(select 1 from public.edt_phases x join public.suivi_des_edt e on e.id=x.edt_id where x.client_id is not null and e.client_id is not null and x.client_id<>e.client_id)
  then raise exception 'V1362_AMBIGUOUS_PARENT_CLIENT'; end if;

  -- Backfill contractuel: uniquement NULL -> EXO; aucune valeur non NULL n'est ecrasee.
  update public.campagnes_maitres set client_id=v_exo_id where client_id is null;
  update public.infrastructures set client_id=v_exo_id where client_id is null;
  update public.campagnes_supports set client_id=v_exo_id where client_id is null;
  update public.campagne_visuels_formats set client_id=v_exo_id where client_id is null;
  update public.support_photos set client_id=v_exo_id where client_id is null;
  update public.suivi_des_edt set client_id=v_exo_id where client_id is null;
  update public.edt_phases set client_id=v_exo_id where client_id is null;
  update public.enjeux_terrain set client_id=v_exo_id where client_id is null;
  update public.bons_de_travail set client_id=v_exo_id where client_id is null;
  update public.requetes_clients set client_id=v_exo_id where client_id is null;
  update public.communications_finales set client_id=v_exo_id where client_id is null;
  -- Les valeurs historiques non vides sont preservees; seules NULL/vides sont canonisees.
  update public.activity_events set client_id=v_exo_id::text where nullif(trim(client_id),'') is null;
end$$;

create or replace function public.require_direct_client_v1362()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.client_id is null then raise exception 'CLIENT_REQUIRED' using errcode='23502'; end if;
  return new;
end$$;

create or replace function public.inherit_campaign_client_v1362()
returns trigger language plpgsql set search_path='' as $$
declare v_client bigint;
begin
  select client_id into v_client from public.campagnes_maitres where id=new.campagne_id;
  if v_client is null then raise exception 'CAMPAIGN_CLIENT_REQUIRED' using errcode='23502'; end if;
  if new.client_id is not null and new.client_id<>v_client then raise exception 'CROSS_CLIENT_ASSIGNMENT_DENIED' using errcode='42501'; end if;
  new.client_id:=v_client; return new;
end$$;

create or replace function public.inherit_edt_client_v1362()
returns trigger language plpgsql set search_path='' as $$
declare v_client bigint;
begin
  select client_id into v_client from public.suivi_des_edt where id=new.edt_id;
  if v_client is null then raise exception 'EDT_CLIENT_REQUIRED' using errcode='23502'; end if;
  if new.client_id is not null and new.client_id<>v_client then raise exception 'CROSS_CLIENT_ASSIGNMENT_DENIED' using errcode='42501'; end if;
  new.client_id:=v_client; return new;
end$$;

drop trigger if exists campagnes_require_client_v1362 on public.campagnes_maitres;
create trigger campagnes_require_client_v1362 before insert or update of client_id on public.campagnes_maitres for each row execute function public.require_direct_client_v1362();
drop trigger if exists infrastructures_require_client_v1362 on public.infrastructures;
create trigger infrastructures_require_client_v1362 before insert or update of client_id on public.infrastructures for each row execute function public.require_direct_client_v1362();
drop trigger if exists communications_require_client_v1362 on public.communications_finales;
create trigger communications_require_client_v1362 before insert or update of client_id on public.communications_finales for each row execute function public.require_direct_client_v1362();
drop trigger if exists campagnes_supports_inherit_client_v1362 on public.campagnes_supports;
create trigger campagnes_supports_inherit_client_v1362 before insert or update of campagne_id,client_id on public.campagnes_supports for each row execute function public.inherit_campaign_client_v1362();
drop trigger if exists visuels_inherit_client_v1362 on public.campagne_visuels_formats;
create trigger visuels_inherit_client_v1362 before insert or update of campagne_id,client_id on public.campagne_visuels_formats for each row execute function public.inherit_campaign_client_v1362();
drop trigger if exists photos_inherit_client_v1362 on public.support_photos;
create trigger photos_inherit_client_v1362 before insert or update of campagne_id,client_id on public.support_photos for each row when(new.campagne_id is not null) execute function public.inherit_campaign_client_v1362();
drop trigger if exists edt_inherit_client_v1362 on public.suivi_des_edt;
create trigger edt_inherit_client_v1362 before insert or update of campagne_id,client_id on public.suivi_des_edt for each row when(new.campagne_id is not null) execute function public.inherit_campaign_client_v1362();
drop trigger if exists edt_phases_inherit_client_v1362 on public.edt_phases;
create trigger edt_phases_inherit_client_v1362 before insert or update of edt_id,client_id on public.edt_phases for each row execute function public.inherit_edt_client_v1362();

create index if not exists infrastructures_client_support_v1362_idx on public.infrastructures(client_id,support_id);
create index if not exists campagnes_supports_client_campaign_v1362_idx on public.campagnes_supports(client_id,campagne_id,support_id);
create index if not exists support_photos_client_campaign_v1362_idx on public.support_photos(client_id,campagne_id,prise_le desc);
create index if not exists suivi_edt_client_campaign_v1362_idx on public.suivi_des_edt(client_id,campagne_id,id);
create index if not exists enjeux_client_support_v1362_idx on public.enjeux_terrain(client_id,support_id,created_at desc);

create or replace function public.client_ownership_summary_v1362(p_domain text default null)
returns table(client_id bigint,client_name text,domain text,total bigint,assigned bigint,without_client bigint,ambiguous bigint,other_client bigint)
language sql stable security definer set search_path='' as $$
  with domains as (
    select i.client_id,'infrastructures'::text domain,count(*) total,count(*) filter(where i.client_id is not null) assigned,0::bigint ambiguous from public.infrastructures i group by i.client_id
    union all select c.client_id,'campaigns',count(*),count(*) filter(where c.client_id is not null),0 from public.campagnes_maitres c group by c.client_id
    union all select p.client_id,'photos',count(*),count(*) filter(where p.client_id is not null),count(*) filter(where p.client_id is distinct from c.client_id) from public.support_photos p left join public.campagnes_maitres c on c.id=p.campagne_id group by p.client_id
    union all select e.client_id,'edt',count(*),count(*) filter(where e.client_id is not null),count(*) filter(where e.client_id is distinct from c.client_id) from public.suivi_des_edt e left join public.campagnes_maitres c on c.id=e.campagne_id group by e.client_id
    union all select x.client_id,'issues',count(*),count(*) filter(where x.client_id is not null),0 from public.enjeux_terrain x group by x.client_id
    union all select r.client_id,'requests',count(*),count(*) filter(where r.client_id is not null),0 from public.requetes_clients r group by r.client_id
  ), me as (select u.role from public.utilisateurs u where u.auth_user_id=auth.uid() and u.statut='Actif')
  select d.client_id,c.nom_client,d.domain,sum(d.total),sum(d.assigned),sum(d.total-d.assigned),sum(d.ambiguous),0::bigint
  from domains d left join public.clients c on c.id=d.client_id
  where exists(select 1 from me where role='Administrateur') and (p_domain is null or d.domain=p_domain)
  group by d.client_id,c.nom_client,d.domain order by d.domain,c.nom_client nulls last;
$$;
revoke all on function public.client_ownership_summary_v1362(text) from public,anon;
grant execute on function public.client_ownership_summary_v1362(text) to authenticated;

create or replace function public.admin_transfer_data_client_v1362(p_domain text,p_entity_id text,p_new_client_id bigint,p_confirmation boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_old bigint;v_changed integer;
begin
  if v_actor is null or not exists(select 1 from public.utilisateurs where auth_user_id=v_actor and statut='Actif' and role='Administrateur') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if not coalesce(p_confirmation,false) then raise exception 'TRANSFER_CONFIRMATION_REQUIRED'; end if;
  if not exists(select 1 from public.clients where id=p_new_client_id) then raise exception 'TARGET_CLIENT_NOT_FOUND'; end if;
  if p_domain='infrastructures' then
    select client_id into v_old from public.infrastructures where support_id=p_entity_id for update;
    if exists(select 1 from public.campagnes_supports cs join public.campagnes_maitres c on c.id=cs.campagne_id where cs.support_id=p_entity_id and c.client_id<>p_new_client_id) then raise exception 'TRANSFER_DEPENDENCY_CONFLICT'; end if;
    update public.infrastructures set client_id=p_new_client_id where support_id=p_entity_id; get diagnostics v_changed=row_count;
  elsif p_domain='campaigns' then
    select client_id into v_old from public.campagnes_maitres where id=p_entity_id::bigint for update;
    update public.campagnes_maitres set client_id=p_new_client_id where id=p_entity_id::bigint; get diagnostics v_changed=row_count;
    update public.campagnes_supports set client_id=p_new_client_id where campagne_id=p_entity_id::bigint;
    update public.campagne_visuels_formats set client_id=p_new_client_id where campagne_id=p_entity_id::bigint;
    update public.support_photos set client_id=p_new_client_id where campagne_id=p_entity_id::bigint;
    update public.suivi_des_edt set client_id=p_new_client_id where campagne_id=p_entity_id::bigint;
    delete from public.client_campaign_access where campaign_id=p_entity_id::bigint;
  else raise exception 'UNSUPPORTED_TRANSFER_DOMAIN'; end if;
  if v_changed<>1 then raise exception 'TRANSFER_ENTITY_NOT_FOUND'; end if;
  insert into public.activity_events(occurred_at,actor_id,action,module,entity_type,entity_id,old_value,new_value,client_id,source,source_system,source_record_id,status)
  values(now(),v_actor,'DATA_TRANSFERRED_CLIENT','client_ownership',p_domain,p_entity_id,jsonb_build_object('client_id',v_old),jsonb_build_object('client_id',p_new_client_id),p_new_client_id::text,'admin','admin',p_entity_id,'success');
  return jsonb_build_object('ok',true,'domain',p_domain,'entity_id',p_entity_id,'old_client_id',v_old,'new_client_id',p_new_client_id);
end$$;
revoke all on function public.admin_transfer_data_client_v1362(text,text,bigint,boolean) from public,anon;
grant execute on function public.admin_transfer_data_client_v1362(text,text,bigint,boolean) to authenticated;

-- V1.3.6.2 utilise les client_id explicites; pagination et filtres restent serveur.
create or replace function public.client_portal_list_v1362(p_section text,p_page integer default 1,p_page_size integer default 25,p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_client bigint;v_role text;v_limit integer;v_offset integer;v_rows jsonb:='[]';v_total bigint:=0;
begin
  if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
  select client_id,role into v_client,v_role from public.utilisateurs where auth_user_id=v_uid and statut='Actif' and role in('Client','Client-Admin');
  if v_client is null then raise exception 'CLIENT_SCOPE_MISSING' using errcode='42501'; end if;
  v_limit:=least(100,greatest(1,coalesce(p_page_size,25)));v_offset:=(greatest(1,coalesce(p_page,1))-1)*v_limit;
  if p_section='supports' then
    select count(*),coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_total,v_rows from(select i.support_id,i.site,i.type_support,i.emplacement_visibilite,i.client_id,i.client_id::text client_effectif,'infrastructures.client_id' chemin_appartenance from public.infrastructures i where i.client_id=v_client order by i.site,i.support_id limit v_limit offset v_offset)q;
  else
    return public.client_portal_list_v1361(p_section,p_page,p_page_size,p_filters);
  end if;
  return jsonb_build_object('section',p_section,'page',greatest(1,coalesce(p_page,1)),'page_size',v_limit,'total',v_total,'rows',v_rows,'diagnostic',case when v_total=0 then 'NO_DATA' else null end);
end$$;
revoke all on function public.client_portal_list_v1362(text,integer,integer,jsonb) from public,anon;
grant execute on function public.client_portal_list_v1362(text,integer,integer,jsonb) to authenticated;

create or replace function public.admin_preview_client_portal_context_v1362(p_target_user_id bigint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_admin uuid:=auth.uid();v_target public.utilisateurs%rowtype;v_base jsonb;v_counts jsonb;
begin
  -- L'autorite UI demeure exclusivement public.role_ui_permissions, lue par la RPC v1361 commune.
  if v_admin is null or not exists(select 1 from public.utilisateurs where auth_user_id=v_admin and statut='Actif' and role='Administrateur') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select * into v_target from public.utilisateurs where id=p_target_user_id and statut='Actif' and role in('Client','Client-Admin');
  if not found then raise exception 'TARGET_USER_NOT_FOUND'; end if;
  if v_target.client_id is null then raise exception 'CLIENT_SCOPE_MISSING'; end if;
  v_base:=public.admin_preview_client_portal_context_v1361(p_target_user_id);
  select jsonb_object_agg(domain,total) into v_counts from public.client_ownership_summary_v1362(null) where client_id=v_target.client_id;
  return v_base||jsonb_build_object('scope_version','v1362','diagnostic','OK','ownership_counts',coalesce(v_counts,'{}'::jsonb),'auth_uid_changed',false,'target_session_created',false);
end$$;
revoke all on function public.admin_preview_client_portal_context_v1362(bigint) from public,anon;
grant execute on function public.admin_preview_client_portal_context_v1362(bigint) to authenticated;

commit;
