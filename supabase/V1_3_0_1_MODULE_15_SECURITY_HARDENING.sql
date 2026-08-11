-- Correctif additif post-V1.3.0 (déjà appliquée). Ne rejoue pas la migration originale.
begin;

-- Le calcul brut de version devient une primitive serveur uniquement.
create or replace function public.next_edt_report_version_v130(p_edt_id bigint)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_version integer;
begin
 if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
 if not exists(select 1 from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id where e.id=p_edt_id and c.client_id is not null) then raise exception 'edt_client_scope_missing'; end if;
 select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=p_edt_id;
 return v_version;
end$$;
revoke all on function public.next_edt_report_version_v130(bigint) from public,anon,authenticated;
grant execute on function public.next_edt_report_version_v130(bigint) to service_role;

create or replace function public.validate_edt_report_requester_v1301() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_edt_client bigint;v_requester_client bigint;
begin
 select c.client_id into v_edt_client from public.suivi_des_edt e join public.campagnes_maitres c on c.id=e.campagne_id where e.id=new.edt_id;
 select u.client_id into v_requester_client from public.utilisateurs u where u.id=new.requester_contact_id;
 if v_edt_client is null then raise exception 'edt_client_scope_missing' using errcode='23514'; end if;
 if v_requester_client is null or v_requester_client<>v_edt_client then raise exception 'requester_client_mismatch' using errcode='23514'; end if;
 return new;
end$$;
revoke all on function public.validate_edt_report_requester_v1301() from public,anon,authenticated;

-- Refuse l'application du correctif si des incohérences historiques existent; aucune donnée n'est modifiée.
do $$
begin
 if exists(
  select 1 from public.edt_reports r
  join public.suivi_des_edt e on e.id=r.edt_id
  left join public.campagnes_maitres c on c.id=e.campagne_id
  left join public.utilisateurs u on u.id=r.requester_contact_id
  where c.client_id is null or u.client_id is null or u.client_id<>c.client_id
 ) then raise exception 'existing_edt_report_requester_client_mismatch'; end if;
end$$;

create trigger validate_edt_report_requester_v1301
before insert or update of edt_id,requester_contact_id on public.edt_reports
for each row execute function public.validate_edt_report_requester_v1301();

-- Voie applicative atomique: rôle interne et périmètre dérivés exclusivement des données serveur.
create or replace function public.create_edt_report_v1301(
 p_edt_id bigint,p_report_path text,p_storage_bucket text default 'final-reports',p_client_visible boolean default false
) returns public.edt_reports language plpgsql security definer set search_path=public,pg_temp as $$
declare v_edt public.suivi_des_edt%rowtype;v_requester public.utilisateurs%rowtype;v_client bigint;v_report public.edt_reports%rowtype;v_version integer;
begin
 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501'; end if;
 if nullif(btrim(p_report_path),'') is null or coalesce(p_storage_bucket,'')<>'final-reports' then raise exception 'invalid_report_file'; end if;
 select * into v_edt from public.suivi_des_edt where id=p_edt_id for update;
 if not found or v_edt.statut<>'Complété' or v_edt.requester_contact_id is null then raise exception 'invalid_completed_edt'; end if;
 select c.client_id into v_client from public.campagnes_maitres c where c.id=v_edt.campagne_id;
 select * into v_requester from public.utilisateurs u where u.id=v_edt.requester_contact_id;
 if v_client is null or v_requester.client_id is null or v_requester.client_id<>v_client then raise exception 'requester_client_mismatch' using errcode='23514'; end if;
 select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=v_edt.id;
 insert into public.edt_reports(edt_id,report_version,status,storage_bucket,report_path,requester_contact_id,generated_at,generated_by,client_visible)
 values(v_edt.id,v_version,'ready','final-reports',btrim(p_report_path),v_requester.id,now(),auth.uid(),coalesce(p_client_visible,false)) returning * into v_report;
 return v_report;
end$$;
revoke all on function public.create_edt_report_v1301(bigint,text,text,boolean) from public,anon,authenticated;
grant execute on function public.create_edt_report_v1301(bigint,text,text,boolean) to authenticated;

-- Les fonctions de trigger ne sont jamais des API directement appelables.
revoke all on function public.edt_report_activity_v130() from public,anon,authenticated;

-- Table: privilèges minimaux; RLS existante limite authenticated aux rôles internes.
revoke all on public.edt_reports from public,anon;
revoke delete,truncate,references,trigger on public.edt_reports from authenticated;

commit;
