-- PREPARATION UNIQUEMENT — remplace la proposition générique V1_3_0 jamais exécutée.
begin;

create table if not exists public.edt_reports (
  id uuid primary key default gen_random_uuid(),
  edt_id bigint not null references public.suivi_des_edt(id) on delete restrict,
  report_version integer not null check(report_version>0),
  status text not null default 'generated' check(status in ('generated','ready','error')),
  storage_bucket text not null default 'final-reports',
  report_path text,
  requester_contact_id bigint not null references public.utilisateurs(id) on delete restrict,
  generated_at timestamptz,
  generated_by uuid,
  client_visible boolean not null default false,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(edt_id,report_version),
  constraint edt_reports_file_ready_v130 check(status='error' or (report_path is not null and generated_at is not null))
);
create index if not exists edt_reports_latest_idx on public.edt_reports(edt_id,report_version desc);
create index if not exists edt_reports_status_idx on public.edt_reports(status,updated_at desc);

alter table public.edt_reports enable row level security;
revoke all on public.edt_reports from public,anon,authenticated;
grant select,insert,update on public.edt_reports to authenticated;
create policy edt_reports_staff_read_v130 on public.edt_reports for select to authenticated
 using(public.current_app_role() in ('Administrateur','Coordonnateur'));
create policy edt_reports_staff_insert_v130 on public.edt_reports for insert to authenticated
 with check(public.current_app_role() in ('Administrateur','Coordonnateur') and generated_by=auth.uid());
create policy edt_reports_staff_update_v130 on public.edt_reports for update to authenticated
 using(public.current_app_role() in ('Administrateur','Coordonnateur'))
 with check(public.current_app_role() in ('Administrateur','Coordonnateur'));

create or replace function public.next_edt_report_version_v130(p_edt_id bigint)
returns integer language sql security definer set search_path=public,pg_temp as $$
 select coalesce(max(report_version),0)+1 from public.edt_reports where edt_id=p_edt_id
$$;
revoke all on function public.next_edt_report_version_v130(bigint) from public,anon;
grant execute on function public.next_edt_report_version_v130(bigint) to authenticated;

create or replace function public.module15_client_edt_reports_v130(p_page integer default 1,p_page_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_client bigint;v_limit integer:=least(greatest(coalesce(p_page_size,25),1),100);v_offset integer:=(greatest(coalesce(p_page,1),1)-1)*v_limit;
begin
 select client_id into v_client from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role in ('Client','Client-Admin') limit 1;
 if v_client is null then raise exception 'client_scope_denied' using errcode='42501'; end if;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(q)) from (
   select r.id,r.edt_id,e.no_edt,r.report_version,r.status,r.report_path,r.generated_at
   from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id
   where c.client_id=v_client and c.client_published and e.client_visible and r.client_visible and r.status='ready'
     and public.client_can_access_campaign_v120(c.id)
   order by r.generated_at desc limit v_limit offset v_offset)q),'[]'::jsonb),
   'total',(select count(*) from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id where c.client_id=v_client and c.client_published and e.client_visible and r.client_visible and r.status='ready' and public.client_can_access_campaign_v120(c.id)),
   'page',greatest(coalesce(p_page,1),1),'page_size',v_limit);
end$$;
revoke all on function public.module15_client_edt_reports_v130(integer,integer) from public,anon;
grant execute on function public.module15_client_edt_reports_v130(integer,integer) to authenticated;

create or replace function public.edt_report_activity_v130() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.activity_events(occurred_at,actor_id,actor_email,action,module,entity_type,entity_id,edt_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
 values(now(),auth.uid(),auth.jwt()->>'email',case when new.status='error' then 'rapport_generation_echouee' else 'rapport_genere' end,'Rapports EDT','edt_report',new.id::text,new.edt_id::text,'edt_reports',new.status,jsonb_build_object('report_version',new.report_version),'edt_reports',new.id::text,now(),'direct','exact');
 return new;
end$$;
create trigger edt_report_activity_v130 after insert or update of status on public.edt_reports for each row execute function public.edt_report_activity_v130();

-- Le même fichier privé sert au courriel et au portail; l’accès portail reste borné au client/campagne.
create policy final_reports_edt_client_read_v130 on storage.objects for select to authenticated using(
 bucket_id='final-reports' and exists(
  select 1 from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id join public.utilisateurs u on u.client_id=c.client_id
  where r.report_path=name and r.status='ready' and r.client_visible and e.client_visible and c.client_published and u.auth_user_id=auth.uid() and u.role in ('Client','Client-Admin') and public.client_can_access_campaign_v120(c.id)
 )
);

commit;
