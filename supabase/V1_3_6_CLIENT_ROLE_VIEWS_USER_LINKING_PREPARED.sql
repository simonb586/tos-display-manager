-- PRÉPARATION UNIQUEMENT — NE PAS EXÉCUTER AVANT APPROBATION.
begin;

create or replace function public.current_user_visible_views_v136()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_role text;v_client bigint;v_tables text[];
begin
 if v_uid is null then raise exception 'authentication_required' using errcode='42501';end if;
 select u.role,u.client_id into v_role,v_client from public.utilisateurs u where u.auth_user_id=v_uid and u.statut='Actif' limit 1;
 if v_role not in('Client','Client-Admin')or v_client is null then raise exception 'client_scope_denied' using errcode='42501';end if;
 select p.visible_tables into v_tables from public.role_ui_permissions p where p.role=v_role;
 return jsonb_build_object('role',v_role,'client_id',v_client,'visible_tables',coalesce(v_tables,'{}'::text[]));
end$$;

drop policy if exists role_ui_permissions_authenticated_read on public.role_ui_permissions;
create policy role_ui_permissions_authenticated_read_v136 on public.role_ui_permissions for select to authenticated
using(public.current_app_role()='Administrateur' or role=public.current_app_role());

create or replace function public.log_client_user_change_v136(p_action text,p_target bigint,p_old_client bigint,p_new_client bigint,p_old_role text,p_new_role text)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.activity_events(occurred_at,actor_id,actor_email,action,module,entity_type,entity_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
 values(clock_timestamp(),auth.uid(),auth.jwt()->>'email',p_action,'Clients','utilisateur',p_target::text,'utilisateurs','success',jsonb_build_object('target_user_id',p_target,'old_client_id',p_old_client,'new_client_id',p_new_client,'old_role',p_old_role,'new_role',p_new_role),'utilisateurs',concat(p_target,':',p_action,':',extract(epoch from clock_timestamp())),clock_timestamp(),'direct','exact');
end$$;

create or replace function public.admin_search_client_users_v136(p_query text default '')
returns table(id bigint,nom text,courriel text,role text,client_id bigint,client_name text,statut text,auth_user_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 return query select u.id,u.nom,u.courriel,u.role,u.client_id,c.nom_client,u.statut,u.auth_user_id from public.utilisateurs u left join public.clients c on c.id=u.client_id
 where(p_query=''or u.nom ilike'%'||p_query||'%'or u.courriel ilike'%'||p_query||'%')order by u.nom,u.courriel limit 50;
end$$;

create or replace function public.admin_link_user_to_client_v136(p_user_id bigint,p_client_id bigint,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.utilisateurs%rowtype;
begin
 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 if p_role not in('Client','Client-Admin')then raise exception 'invalid_client_role';end if;
 select*into u from public.utilisateurs where id=p_user_id for update;if not found then raise exception 'user_not_found';end if;
 if not exists(select 1 from public.clients where id=p_client_id)then raise exception 'client_not_found';end if;
 if u.role not in('Client','Client-Admin')and u.client_id is not null then raise exception 'internal_role_link_denied'using errcode='42501';end if;
 if u.client_id is not null and u.client_id<>p_client_id then raise exception 'user_already_linked_use_transfer'using errcode='23514';end if;
 update public.utilisateurs set client_id=p_client_id,role=p_role,updated_at=now()where id=p_user_id;
 perform public.log_client_user_change_v136(case when u.client_id=p_client_id then'CLIENT_USER_ROLE_CHANGED'else'USER_LINKED_TO_CLIENT'end,p_user_id,u.client_id,p_client_id,u.role,p_role);
 return jsonb_build_object('id',p_user_id,'client_id',p_client_id,'role',p_role,'auth_user_id',u.auth_user_id);
end$$;

create or replace function public.admin_unlink_user_from_client_v136(p_user_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.utilisateurs%rowtype;
begin
 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 select*into u from public.utilisateurs where id=p_user_id and role in('Client','Client-Admin')for update;if not found then raise exception 'client_user_not_found';end if;
 delete from public.client_campaign_access where user_id=u.auth_user_id;
 update public.utilisateurs set client_id=null,updated_at=now()where id=p_user_id;
 perform public.log_client_user_change_v136('USER_UNLINKED_FROM_CLIENT',p_user_id,u.client_id,null,u.role,u.role);
 return jsonb_build_object('id',p_user_id,'client_id',null,'role',u.role,'auth_user_id',u.auth_user_id);
end$$;

create or replace function public.admin_transfer_user_client_v136(p_user_id bigint,p_client_id bigint,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.utilisateurs%rowtype;
begin
 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 if p_role not in('Client','Client-Admin')then raise exception 'invalid_client_role';end if;
 select*into u from public.utilisateurs where id=p_user_id and role in('Client','Client-Admin')for update;if not found then raise exception 'client_user_not_found';end if;
 if u.client_id is null or u.client_id=p_client_id then raise exception 'transfer_requires_distinct_source_and_target';end if;
 if not exists(select 1 from public.clients where id=p_client_id)then raise exception 'client_not_found';end if;
 delete from public.client_campaign_access where user_id=u.auth_user_id;
 update public.utilisateurs set client_id=p_client_id,role=p_role,updated_at=now()where id=p_user_id;
 perform public.log_client_user_change_v136('USER_TRANSFERRED_CLIENT',p_user_id,u.client_id,p_client_id,u.role,p_role);
 return jsonb_build_object('id',p_user_id,'client_id',p_client_id,'role',p_role,'auth_user_id',u.auth_user_id);
end$$;

create or replace function public.admin_change_client_user_role_v136(p_user_id bigint,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.utilisateurs%rowtype;
begin
 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role='Administrateur')then raise exception 'client_admin_write_denied'using errcode='42501';end if;
 if p_role not in('Client','Client-Admin')then raise exception 'invalid_client_role';end if;
 select*into u from public.utilisateurs where id=p_user_id and client_id is not null and role in('Client','Client-Admin')for update;if not found then raise exception 'client_user_not_found';end if;
 update public.utilisateurs set role=p_role,updated_at=now()where id=p_user_id;
 perform public.log_client_user_change_v136('CLIENT_USER_ROLE_CHANGED',p_user_id,u.client_id,u.client_id,u.role,p_role);
 return jsonb_build_object('id',p_user_id,'client_id',u.client_id,'role',p_role,'auth_user_id',u.auth_user_id);
end$$;

create or replace function public.admin_client_access_detail_v135(p_client_id bigint)
returns jsonb language plpgsql stable security definer set search_path=''as $$
declare v jsonb;
begin
 if auth.uid()is null or not exists(select 1 from public.utilisateurs a where a.auth_user_id=auth.uid()and a.statut='Actif'and a.role in('Administrateur','Coordonnateur'))then raise exception 'client_admin_read_denied'using errcode='42501';end if;
 if not exists(select 1 from public.clients where id=p_client_id)then raise exception 'client_not_found';end if;
 select jsonb_build_object(
 'organisation',(select to_jsonb(c)from public.clients c where c.id=p_client_id),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'nom',u.nom,'courriel',u.courriel,'role',u.role,'statut',u.statut,'auth_user_id',u.auth_user_id,'client_id',u.client_id,'client_name',c.nom_client,'derniere_activite_le',u.derniere_activite_le,'visible_views',coalesce(p.visible_tables,'{}'::text[])))from public.utilisateurs u join public.clients c on c.id=u.client_id left join public.role_ui_permissions p on p.role=u.role where u.client_id=p_client_id and u.role in('Client','Client-Admin')),'[]'::jsonb),
 'invitations',coalesce((select jsonb_agg(to_jsonb(i))from public.client_member_invitations i where i.client_id=p_client_id),'[]'::jsonb),
 'campaigns',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'nom_campagne',c.nom_campagne,'access_mode','Module 17'))from public.campagnes_maitres c where c.client_id=p_client_id and c.client_published),'[]'::jsonb))into v;
 return v;
end$$;

revoke all on function public.current_user_visible_views_v136()from public,anon;
revoke all on function public.admin_search_client_users_v136(text)from public,anon;
revoke all on function public.admin_link_user_to_client_v136(bigint,bigint,text)from public,anon;
revoke all on function public.admin_unlink_user_from_client_v136(bigint)from public,anon;
revoke all on function public.admin_transfer_user_client_v136(bigint,bigint,text)from public,anon;
revoke all on function public.admin_change_client_user_role_v136(bigint,text)from public,anon;
revoke all on function public.admin_client_access_detail_v135(bigint)from public,anon;
revoke all on function public.log_client_user_change_v136(text,bigint,bigint,bigint,text,text)from public,anon,authenticated;
grant execute on function public.current_user_visible_views_v136()to authenticated;
grant execute on function public.admin_search_client_users_v136(text),public.admin_link_user_to_client_v136(bigint,bigint,text),public.admin_unlink_user_from_client_v136(bigint),public.admin_transfer_user_client_v136(bigint,bigint,text),public.admin_change_client_user_role_v136(bigint,text),public.admin_client_access_detail_v135(bigint)to authenticated;
commit;
