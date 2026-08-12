-- V1.3.2 — MIGRATION ADDITIVE PRÉPARÉE. NE PAS EXÉCUTER SANS APPROBATION.
begin;

alter table public.edt_reports
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists conclusion text,
  add column if not exists content_snapshot jsonb,
  add column if not exists support_count integer not null default 0;
alter table public.edt_reports drop constraint if exists edt_reports_status_check;
alter table public.edt_reports add constraint edt_reports_status_check check(status in ('draft','generated','ready','error'));
alter table public.edt_reports add constraint edt_reports_support_count_v132 check(support_count>=0);
alter table public.edt_reports drop constraint if exists edt_reports_file_ready_v130;
alter table public.edt_reports add constraint edt_reports_file_ready_v132 check(status in ('draft','error') or (report_path is not null and generated_at is not null));

alter table public.email_outbox
  add column if not exists recipient_emails text[],
  add column if not exists accompaniment_message text;
alter table public.email_delivery_log add column if not exists recipient_emails text[];

create or replace function public.save_edt_report_draft_v132(p_edt_id bigint,p_title text,p_summary text,p_conclusion text,p_content_snapshot jsonb,p_support_count integer,p_client_visible boolean default false,p_report_id uuid default null)
returns public.edt_reports language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_row public.edt_reports;v_source_count integer;v_requester bigint;v_version integer;
begin
 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select requester_contact_id into v_requester from public.suivi_des_edt where id=p_edt_id and statut='Complété';if v_requester is null then raise exception 'completed_edt_requester_required';end if;
 select count(*) into v_source_count from public.edt_supports where edt_id=p_edt_id;
 if v_source_count<>p_support_count or jsonb_array_length(coalesce(p_content_snapshot->'supports','[]'::jsonb))<>v_source_count then raise exception 'report_missing_edt_supports';end if;
 if p_report_id is not null then update public.edt_reports set title=p_title,summary=p_summary,conclusion=p_conclusion,content_snapshot=p_content_snapshot,support_count=p_support_count,updated_at=now() where id=p_report_id and edt_id=p_edt_id and status='draft' returning * into v_row;end if;
 if v_row.id is null then select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=p_edt_id;insert into public.edt_reports(edt_id,report_version,status,requester_contact_id,generated_by,client_visible,title,summary,conclusion,content_snapshot,support_count) values(p_edt_id,v_version,'draft',v_requester,auth.uid(),p_client_visible,p_title,p_summary,p_conclusion,p_content_snapshot,p_support_count) returning * into v_row;end if;
 return v_row;
end$$;
revoke all on function public.save_edt_report_draft_v132(bigint,text,text,text,jsonb,integer,boolean,uuid) from public,anon;
grant execute on function public.save_edt_report_draft_v132(bigint,text,text,text,jsonb,integer,boolean,uuid) to authenticated;

create or replace function public.finalize_edt_report_v132(p_edt_id bigint,p_report_id uuid,p_report_path text,p_storage_bucket text,p_title text,p_summary text,p_conclusion text,p_content_snapshot jsonb,p_support_count integer,p_client_visible boolean default false)
returns public.edt_reports language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_row public.edt_reports;v_source_count integer;v_requester bigint;v_version integer;
begin
 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select requester_contact_id into v_requester from public.suivi_des_edt where id=p_edt_id and statut='Complété';select count(*) into v_source_count from public.edt_supports where edt_id=p_edt_id;
 if v_requester is null or v_source_count<>p_support_count or jsonb_array_length(coalesce(p_content_snapshot->'supports','[]'::jsonb))<>v_source_count then raise exception 'report_missing_edt_supports';end if;
 if p_report_id is not null then update public.edt_reports set status='ready',report_path=p_report_path,storage_bucket=p_storage_bucket,title=p_title,summary=p_summary,conclusion=p_conclusion,content_snapshot=p_content_snapshot,support_count=p_support_count,generated_at=now(),updated_at=now() where id=p_report_id and edt_id=p_edt_id and status='draft' returning * into v_row;end if;
 if v_row.id is null then select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=p_edt_id;insert into public.edt_reports(edt_id,report_version,status,storage_bucket,report_path,requester_contact_id,generated_at,generated_by,client_visible,title,summary,conclusion,content_snapshot,support_count) values(p_edt_id,v_version,'ready',p_storage_bucket,p_report_path,v_requester,now(),auth.uid(),p_client_visible,p_title,p_summary,p_conclusion,p_content_snapshot,p_support_count) returning * into v_row;end if;
 return v_row;
end$$;
revoke all on function public.finalize_edt_report_v132(bigint,uuid,text,text,text,text,text,jsonb,integer,boolean) from public,anon;
grant execute on function public.finalize_edt_report_v132(bigint,uuid,text,text,text,text,text,jsonb,integer,boolean) to authenticated;

create or replace function public.request_edt_report_email_v132(p_edt_id bigint,p_report_id uuid,p_recipients text[],p_message text default '',p_resend boolean default false)
returns bigint language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_id bigint;v_report public.edt_reports;
begin
 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select * into v_report from public.edt_reports where id=p_report_id and edt_id=p_edt_id and status in ('generated','ready');if v_report.id is null then raise exception 'final_report_required';end if;
 if coalesce(array_length(p_recipients,1),0)=0 or exists(select 1 from unnest(p_recipients)e where e!~*'^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then raise exception 'invalid_recipient_email';end if;
 insert into public.email_outbox(event_type,edt_id,idempotency_key,report_id,report_version,status,manual_resend,requested_by,recipient_emails,accompaniment_message) values('edt_completed_report_sent',p_edt_id,'edt_completed_report_sent:'||p_edt_id||':manual:'||gen_random_uuid(),v_report.id,v_report.report_version,'pending',p_resend,auth.uid(),p_recipients,p_message) returning id into v_id;return v_id;
end$$;
revoke all on function public.request_edt_report_email_v132(bigint,uuid,text[],text,boolean) from public,anon;
grant execute on function public.request_edt_report_email_v132(bigint,uuid,text[],text,boolean) to authenticated;

commit;
