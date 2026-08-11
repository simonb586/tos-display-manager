begin;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  title text not null,
  client_id bigint references public.clients(id) on delete restrict,
  campaign_id bigint references public.campagnes_maitres(id) on delete restrict,
  communication_id bigint references public.campagnes_maitres(id) on delete restrict,
  site text,
  support_id text,
  no_edt text,
  period_start date,
  period_end date,
  status text not null default 'draft',
  client_published boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  published_by uuid,
  published_at timestamptz,
  archived_by uuid,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  template_key text not null,
  version integer not null default 1,
  parent_report_id uuid references public.reports(id) on delete restrict,
  constraint reports_type_v130 check (report_type in ('campaign','operational_communication','site_support','client','edt','inspection','photos','issues','summary')),
  constraint reports_status_v130 check (status in ('draft','generated','published','archived','error')),
  constraint reports_period_v130 check (period_end is null or period_start is null or period_end >= period_start),
  constraint reports_version_v130 check (version > 0),
  constraint reports_publication_v130 check ((status='published' and client_published and published_at is not null) or (status<>'published' and not client_published)),
  constraint reports_archive_v130 check ((status='archived' and archived_at is not null) or status<>'archived'),
  constraint reports_scope_v130 check (
    (report_type='campaign' and campaign_id is not null and communication_id is null) or
    (report_type='operational_communication' and communication_id is not null and campaign_id is null) or
    report_type in ('site_support','client','edt','inspection','photos','issues','summary')
  )
);

create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_client_idx on public.reports(client_id);
create index if not exists reports_campaign_idx on public.reports(campaign_id) where campaign_id is not null;
create index if not exists reports_communication_idx on public.reports(communication_id) where communication_id is not null;
create index if not exists reports_type_created_idx on public.reports(report_type,created_at desc);
create index if not exists reports_published_idx on public.reports(published_at desc) where client_published;

alter table public.reports enable row level security;
revoke all on public.reports from PUBLIC;
revoke all on public.reports from anon,authenticated;
grant select,insert,update on public.reports to authenticated;

drop policy if exists reports_internal_read_v130 on public.reports;
create policy reports_internal_read_v130 on public.reports for select to authenticated
using (public.current_app_role() in ('Administrateur','Coordonnateur'));
drop policy if exists reports_internal_insert_v130 on public.reports;
create policy reports_internal_insert_v130 on public.reports for insert to authenticated
with check (public.current_app_role() in ('Administrateur','Coordonnateur') and created_by=auth.uid() and status='draft' and not client_published);
drop policy if exists reports_internal_update_v130 on public.reports;
create policy reports_internal_update_v130 on public.reports for update to authenticated
using (public.current_app_role() in ('Administrateur','Coordonnateur'))
with check (public.current_app_role() in ('Administrateur','Coordonnateur'));

create or replace function public.module15_generate_report_v130(p_report_id uuid,p_metadata jsonb default '{}'::jsonb)
returns public.reports language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.reports%rowtype; n public.reports%rowtype;
begin
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Accès refusé'; end if;
 select * into r from public.reports where id=p_report_id for update;
 if not found or r.status not in ('draft','generated','published','error') then raise exception 'Transition non autorisée'; end if;
 if r.status='published' then
  insert into public.reports(report_type,title,client_id,campaign_id,communication_id,site,support_id,no_edt,period_start,period_end,status,client_published,created_by,updated_by,metadata,template_key,version,parent_report_id)
  values(r.report_type,r.title,r.client_id,r.campaign_id,r.communication_id,r.site,r.support_id,r.no_edt,r.period_start,r.period_end,'generated',false,auth.uid(),auth.uid(),coalesce(p_metadata,r.metadata),r.template_key,r.version+1,r.id) returning * into n;
 else
  update public.reports set status='generated',client_published=false,published_by=null,published_at=null,metadata=coalesce(p_metadata,metadata),updated_by=auth.uid(),updated_at=now() where id=r.id returning * into n;
 end if;
 return n;
end$$;

create or replace function public.module15_transition_report_v130(p_report_id uuid,p_action text)
returns public.reports language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.reports%rowtype;
begin
 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Accès refusé'; end if;
 select * into r from public.reports where id=p_report_id for update;
 if not found then raise exception 'Rapport introuvable'; end if;
 if p_action='publish' and r.status='generated' then
  update public.reports set status='published',client_published=true,published_by=auth.uid(),published_at=now(),archived_by=null,archived_at=null,updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 elsif p_action='unpublish' and r.status='published' then
  update public.reports set status='generated',client_published=false,published_by=null,published_at=null,updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 elsif p_action='archive' and r.status in ('draft','generated','published','error') then
  update public.reports set status='archived',client_published=false,published_by=null,published_at=null,archived_by=auth.uid(),archived_at=now(),updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 else raise exception 'Transition non autorisée'; end if;
 return r;
end$$;

create or replace function public.module15_client_reports_v130(p_page integer default 1,p_page_size integer default 25)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_client bigint;v_role text;v_limit integer:=least(greatest(coalesce(p_page_size,25),1),100);v_offset integer:=(greatest(coalesce(p_page,1),1)-1)*v_limit;
begin
 select client_id,role into v_client,v_role from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role in ('Client','Client-Admin') limit 1;
 if v_client is null then raise exception 'Accès refusé'; end if;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(q)) from (select id,report_type,title,campaign_id,communication_id,site,support_id,no_edt,period_start,period_end,status,published_at,template_key,version,metadata from public.reports where client_id=v_client and status='published' and client_published and (campaign_id is null or public.client_can_access_campaign_v120(campaign_id)) and (communication_id is null or public.client_can_access_campaign_v120(communication_id)) order by published_at desc limit v_limit offset v_offset)q),'[]'::jsonb),'total',(select count(*) from public.reports where client_id=v_client and status='published' and client_published and (campaign_id is null or public.client_can_access_campaign_v120(campaign_id)) and (communication_id is null or public.client_can_access_campaign_v120(communication_id))),'page',greatest(coalesce(p_page,1),1),'page_size',v_limit);
end$$;

create or replace function public.module15_report_activity_v130() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_action text;
begin
 v_action:=case when tg_op='INSERT' then 'Création brouillon' when new.status='generated' and old.status is distinct from new.status then 'Génération' when new.status='published' then 'Publication' when old.status='published' and new.status='generated' then 'Dépublication' when new.status='archived' then 'Archivage' else 'Modification' end;
 insert into public.activity_events(occurred_at,actor_id,actor_email,action,module,entity_type,entity_id,old_value,new_value,campaign_id,edt_id,support_id,client_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
 values(now(),auth.uid(),auth.jwt()->>'email',v_action,'Rapports et livrables','report',new.id::text,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),coalesce(new.campaign_id,new.communication_id)::text,new.no_edt,new.support_id,new.client_id::text,'reports',new.status,jsonb_build_object('report_type',new.report_type,'version',new.version),'reports',new.id::text,now(),'direct','exact');
 return new;
end$$;
drop trigger if exists reports_activity_v130 on public.reports;
create trigger reports_activity_v130 after insert or update on public.reports for each row execute function public.module15_report_activity_v130();

revoke all on function public.module15_generate_report_v130(uuid,jsonb) from PUBLIC;
revoke all on function public.module15_generate_report_v130(uuid,jsonb) from anon,authenticated;
revoke all on function public.module15_transition_report_v130(uuid,text) from PUBLIC;
revoke all on function public.module15_transition_report_v130(uuid,text) from anon,authenticated;
revoke all on function public.module15_client_reports_v130(integer,integer) from PUBLIC;
revoke all on function public.module15_client_reports_v130(integer,integer) from anon,authenticated;
revoke all on function public.module15_report_activity_v130() from PUBLIC;
revoke all on function public.module15_report_activity_v130() from anon,authenticated;
grant execute on function public.module15_generate_report_v130(uuid,jsonb) to authenticated;
grant execute on function public.module15_transition_report_v130(uuid,text) to authenticated;
grant execute on function public.module15_client_reports_v130(integer,integer) to authenticated;

commit;
