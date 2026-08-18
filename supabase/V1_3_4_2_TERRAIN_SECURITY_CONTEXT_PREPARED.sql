-- V1.3.4.2 PREPARED ONLY — NE PAS EXECUTER SANS APPROBATION.
-- Durcissement additif des mutations Terrain et contexte canonique des enjeux.
begin;

alter table public.enjeux_terrain
  add column if not exists edt_phase_id bigint references public.edt_phases(id) on delete restrict;
create index if not exists enjeux_terrain_edt_phase_v1342_idx
  on public.enjeux_terrain(edt_phase_id) where edt_phase_id is not null;

-- Backfill sans supposition : une seule association phase connue sur toute
-- l'histoire du support. Les supports à 0 ou plusieurs phases restent NULL.
with deterministic as (
  select support_id,min(phase_id) phase_id
  from public.edt_supports
  where phase_id is not null
  group by support_id
  having count(distinct phase_id)=1
)
update public.enjeux_terrain e
set edt_phase_id=d.phase_id
from deterministic d
where e.edt_phase_id is null and d.support_id=e.support_id;

create or replace function public.lister_contextes_terrain_v1342(p_support_id text)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,pg_temp as $$
declare v_user public.utilisateurs%rowtype;v_result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
 if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('phase_id',p.id,'phase_name',p.nom,'phase_type',p.phase_type,'phase_status',p.statut,'edt_id',e.id,'edt_number',e.no_edt,'campaign_id',e.campagne_id) order by e.id,p.ordre),'[]'::jsonb)
 into v_result
 from public.edt_supports es join public.edt_phases p on p.id=es.phase_id join public.suivi_des_edt e on e.id=p.edt_id
 where es.support_id=p_support_id and es.edt_id=p.edt_id and e.archived_at is null;
 return v_result;
end$$;

-- L'ancienne mutation reste disponible seulement comme implémentation interne.
revoke execute on function public.finaliser_intervention_terrain_v01273(text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.finaliser_installation_terrain_v01273(text,bigint,text,text,text,text,text,text) from public,anon,authenticated;
-- Certaines surfaces très anciennes ne sont pas présentes dans toutes les
-- installations. Leur neutralisation reste idempotente et conditionnelle.
do $$
begin
 if to_regprocedure('public.finaliser_installation_terrain_v0127(text,bigint,text,text,text,text,text,text)') is not null then
   execute 'revoke execute on function public.finaliser_installation_terrain_v0127(text,bigint,text,text,text,text,text,text) from public,anon,authenticated';
 end if;
 if to_regprocedure('public.finaliser_installation_terrain(text,bigint,text,text,text,text,text)') is not null then
   execute 'revoke execute on function public.finaliser_installation_terrain(text,bigint,text,text,text,text,text) from public,anon,authenticated';
 end if;
 if to_regprocedure('public.appliquer_visuel_support(text,bigint,text,text,text)') is not null then
   execute 'revoke execute on function public.appliquer_visuel_support(text,bigint,text,text,text) from public,anon,authenticated';
 end if;
end$$;

-- Remplace le point d'entrée Installation actif avec identité, rôle et relation
-- support/visuel/campagne/phase vérifiés côté serveur.
create or replace function public.finaliser_installation_terrain_v01210(p_support_id text,p_visuel_id bigint,p_nom_fichier text,p_storage_path text,p_photo_url text,p_utilisateur text default null,p_commentaires text default null,p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_user public.utilisateurs%rowtype;v_phase_id bigint;v_campaign_id bigint;v_email text;v_support_format text;v_visual_format text;v_out_of_frame boolean;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
 if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501';end if;
 select cv.edt_phase_id,cv.campagne_id,cv.format_support,cv.is_out_of_frame into v_phase_id,v_campaign_id,v_visual_format,v_out_of_frame from public.campagne_visuels_formats cv join public.campagnes_maitres c on c.id=cv.campagne_id where cv.id=p_visuel_id and cv.actif and c.publiee_terrain and lower(coalesce(c.statut,''))='active';
 if not found then raise exception 'visual_campaign_denied' using errcode='42501';end if;
 if v_phase_id is null or not exists(select 1 from public.edt_supports es join public.edt_phases ep on ep.id=es.phase_id join public.suivi_des_edt e on e.id=ep.edt_id where es.support_id=p_support_id and es.phase_id=v_phase_id and es.edt_id=ep.edt_id and e.campagne_id=v_campaign_id and ep.phase_type='installation' and e.archived_at is null) then raise exception 'cross_context_support_denied' using errcode='42501';end if;
 select coalesce(i.format_affichage,i.type_support) into v_support_format from public.infrastructures i where i.support_id=p_support_id;
 if not found then raise exception 'support_not_found';end if;
 if not coalesce(v_out_of_frame,false) and public.tdm_normalize_display_format(v_support_format) is distinct from public.tdm_normalize_display_format(v_visual_format) then raise exception 'visual_format_mismatch' using errcode='23514';end if;
 v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));
 return public.finaliser_installation_terrain_v01273(p_support_id,p_visuel_id,p_nom_fichier,p_storage_path,p_photo_url,v_email,p_commentaires,p_idempotency_key);
end$$;
revoke execute on function public.finaliser_installation_terrain_v01210(text,bigint,text,text,text,text,text,text) from public,anon;
grant execute on function public.finaliser_installation_terrain_v01210(text,bigint,text,text,text,text,text,text) to authenticated;

-- Nouveau point d'entrée : la phase est fournie par le contexte actif, puis
-- validée avec le support et l'EDT avant toute écriture.
create or replace function public.finaliser_intervention_terrain_v1342(p_support_id text,p_edt_phase_id bigint,p_action text,p_type_enjeu text,p_commentaires text,p_nom_fichier text,p_storage_path text,p_photo_url text,p_utilisateur text default null,p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_user public.utilisateurs%rowtype;v_context record;v_email text;v_result jsonb;v_issue_id bigint;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 select * into v_user from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' limit 1;
 if not found or v_user.role not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'terrain_role_denied' using errcode='42501';end if;
 if lower(trim(p_action))='enjeu' and p_edt_phase_id is null then raise exception 'issue_phase_required' using errcode='23502';end if;
 if p_edt_phase_id is not null then
   select ep.id phase_id,ep.edt_id,ep.phase_type,e.campagne_id into v_context
   from public.edt_phases ep join public.edt_supports es on es.phase_id=ep.id and es.edt_id=ep.edt_id join public.suivi_des_edt e on e.id=ep.edt_id
   where ep.id=p_edt_phase_id and es.support_id=p_support_id and e.archived_at is null;
   if not found then raise exception 'cross_context_support_denied' using errcode='42501';end if;
 end if;
 v_email:=coalesce(nullif(v_user.courriel,''),(select email from auth.users where id=auth.uid()));
 v_result:=public.finaliser_intervention_terrain_v01273(p_support_id,p_action,p_type_enjeu,p_commentaires,p_nom_fichier,p_storage_path,p_photo_url,v_email,p_idempotency_key);
 if coalesce((v_result->>'ok')::boolean,false) is not true then return v_result;end if;
 if lower(trim(p_action))='enjeu' then
   v_issue_id:=nullif(v_result->>'enjeu_id','')::bigint;
   update public.enjeux_terrain set edt_phase_id=p_edt_phase_id where id=v_issue_id and support_id=p_support_id;
   if not found then raise exception 'issue_context_not_persisted';end if;
 end if;
 return v_result||jsonb_build_object('edt_phase_id',p_edt_phase_id,'edt_id',case when p_edt_phase_id is null then null else v_context.edt_id end,'phase_type',case when p_edt_phase_id is null then null else v_context.phase_type end);
end$$;
revoke execute on function public.finaliser_intervention_terrain_v1342(text,bigint,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.finaliser_intervention_terrain_v1342(text,bigint,text,text,text,text,text,text,text,text) to authenticated;
revoke execute on function public.lister_contextes_terrain_v1342(text) from public,anon;
grant execute on function public.lister_contextes_terrain_v1342(text) to authenticated;

-- Les deux mutations de diagnostic actives exigent aussi explicitement une identité.
create or replace function public.resolve_terrain_sync_v113(p_id uuid,p_resolution text)
returns public.terrain_sync_diagnostics language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result public.terrain_sync_diagnostics;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 update public.terrain_sync_diagnostics set statut='resolved',resolved_at=now(),resolved_by=auth.uid(),resolution=nullif(trim(p_resolution),'') where id=p_id and lower(statut) in ('échec','echec','error','erreur','failed') returning * into result;
 if result.id is null then raise exception 'diagnostic_not_resolvable';end if;return result;
end$$;
create or replace function public.request_terrain_sync_retry_v113(p_id uuid)
returns public.terrain_sync_diagnostics language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare original public.terrain_sync_diagnostics;result public.terrain_sync_diagnostics;v_email text;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into original from public.terrain_sync_diagnostics where id=p_id;if not found then raise exception 'diagnostic_not_found';end if;
 select email into v_email from auth.users where id=auth.uid();
 insert into public.terrain_sync_diagnostics(reference,support_id,visuel_id,utilisateur,etape,statut,details,device_id,operation,campagne_id,edt_id,attempt,last_attempt_at,source) values(original.reference,original.support_id,original.visuel_id,v_email,'Nouvelle tentative demandée','pending',jsonb_build_object('retry_of',original.id),original.device_id,original.operation,original.campagne_id,original.edt_id,original.attempt+1,now(),'manual_retry_request') returning * into result;
 return result;
end$$;
revoke execute on function public.resolve_terrain_sync_v113(uuid,text) from public,anon;
revoke execute on function public.request_terrain_sync_retry_v113(uuid) from public,anon;
grant execute on function public.resolve_terrain_sync_v113(uuid,text) to authenticated;
grant execute on function public.request_terrain_sync_retry_v113(uuid) to authenticated;

commit;
