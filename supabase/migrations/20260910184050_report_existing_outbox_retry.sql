-- Reuse the automatic queued job, preserving one delivery per report and explicit resend.
CREATE OR REPLACE FUNCTION public.request_edt_report_email_v132(p_edt_id bigint, p_report_id uuid, p_recipients text[], p_message text DEFAULT ''::text, p_resend boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id bigint;v_report public.edt_reports;v_job public.email_outbox;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_reports sec_report WHERE sec_report.id=p_report_id AND EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=sec_report.edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false)) AND sec_report.edt_id=p_edt_id)) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

PERFORM 1 FROM public.suivi_des_edt WHERE id=p_edt_id FOR UPDATE;
SELECT id INTO v_id FROM public.email_outbox WHERE edt_id=p_edt_id AND report_id=p_report_id AND recipient_emails IS NOT DISTINCT FROM p_recipients AND accompaniment_message IS NOT DISTINCT FROM p_message AND requested_by=auth.uid() AND (status IN ('pending','sending') OR (status='sent' AND NOT p_resend)) ORDER BY id DESC LIMIT 1;IF FOUND THEN RETURN v_id;END IF;
 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select * into v_report from public.edt_reports where id=p_report_id and edt_id=p_edt_id and status in ('generated','ready');if v_report.id is null then raise exception 'final_report_required';end if;
 if coalesce(array_length(p_recipients,1),0)=0 or exists(select 1 from unnest(p_recipients)e where e!~*'^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then raise exception 'invalid_recipient_email';end if;

 select * into v_job from public.email_outbox where edt_id=p_edt_id and event_type='edt_completed_report_sent' and not manual_resend for update;
 if found and v_job.status in ('pending','failed') and (v_job.report_id is null or v_job.report_id=p_report_id) then
  update public.email_outbox set report_id=v_report.id,report_version=v_report.report_version,recipient_emails=p_recipients,accompaniment_message=p_message,requested_by=auth.uid(),status='pending',attempt_count=0,next_attempt_at=now(),last_error=null,updated_at=now() where id=v_job.id;
  return v_job.id;
 end if;
 if found and v_job.status='sending' then raise exception 'report_email_in_progress' using errcode='40001';end if;
 if found and v_job.status='sent' and v_job.report_id=p_report_id and not p_resend then return v_job.id;end if;
 insert into public.email_outbox(event_type,edt_id,idempotency_key,report_id,report_version,status,manual_resend,requested_by,recipient_emails,accompaniment_message) values('edt_completed_report_sent',p_edt_id,'edt_completed_report_sent:'||p_edt_id||':manual:'||gen_random_uuid(),v_report.id,v_report.report_version,'pending',true,auth.uid(),p_recipients,p_message) returning id into v_id;return v_id;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finalize_edt_report_v132(p_edt_id bigint, p_report_id uuid, p_report_path text, p_storage_bucket text, p_title text, p_summary text, p_conclusion text, p_content_snapshot jsonb, p_support_count integer, p_client_visible boolean DEFAULT false)
 RETURNS edt_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.edt_reports;v_source_count integer;v_requester bigint;v_version integer;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;
IF p_report_id IS NOT NULL THEN IF (EXISTS(SELECT 1 FROM public.edt_reports sec_report WHERE sec_report.id=p_report_id AND EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=sec_report.edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false)) AND sec_report.edt_id=p_edt_id)) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;
END IF;

BEGIN

PERFORM 1 FROM public.suivi_des_edt WHERE id=p_edt_id FOR UPDATE;

IF p_storage_bucket IS DISTINCT FROM 'final-reports' OR p_report_path IS NULL OR p_report_path !~* '[.]pdf$' OR p_report_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]' OR
 (SELECT count(*) FROM public.suivi_des_edt e WHERE regexp_replace(coalesce(e.no_edt,e.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_report_path,'/',1))<>1 OR
 NOT EXISTS(SELECT 1 FROM public.suivi_des_edt e WHERE e.id=p_edt_id AND regexp_replace(coalesce(e.no_edt,e.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_report_path,'/',1)) OR
 EXISTS(SELECT 1 FROM public.edt_reports r WHERE r.report_path=p_report_path AND (r.edt_id<>p_edt_id OR r.storage_bucket IS DISTINCT FROM 'final-reports')) OR
 EXISTS(SELECT 1 FROM public.communications_finales r WHERE r.report_path=p_report_path AND r.edt_id IS DISTINCT FROM p_edt_id::text)
THEN RAISE EXCEPTION 'report_path_denied' USING ERRCODE='42501';END IF;
SELECT * INTO v_row FROM public.edt_reports WHERE edt_id=p_edt_id AND report_path=p_report_path AND storage_bucket=p_storage_bucket AND status='ready';
IF FOUND THEN
 IF v_row.title IS DISTINCT FROM p_title OR v_row.summary IS DISTINCT FROM p_summary OR v_row.conclusion IS DISTINCT FROM p_conclusion OR v_row.content_snapshot IS DISTINCT FROM p_content_snapshot OR v_row.support_count IS DISTINCT FROM p_support_count THEN RAISE EXCEPTION 'report_version_conflict_reload_latest' USING ERRCODE='40001';END IF;
 RETURN v_row;
END IF;
IF p_report_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.edt_reports WHERE id=p_report_id AND edt_id=p_edt_id AND status='draft') THEN RAISE EXCEPTION 'report_version_conflict_reload_latest' USING ERRCODE='40001';END IF;
 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select requester_contact_id into v_requester from public.suivi_des_edt where id=p_edt_id and statut='Complété';select count(*) into v_source_count from public.edt_supports where edt_id=p_edt_id;
 if v_requester is null or v_source_count<>p_support_count or jsonb_array_length(coalesce(p_content_snapshot->'supports','[]'::jsonb))<>v_source_count then raise exception 'report_missing_edt_supports';end if;
 if p_report_id is not null then update public.edt_reports set status='ready',client_visible=p_client_visible,report_path=p_report_path,storage_bucket=p_storage_bucket,title=p_title,summary=p_summary,conclusion=p_conclusion,content_snapshot=p_content_snapshot,support_count=p_support_count,generated_at=now(),updated_at=now() where id=p_report_id and edt_id=p_edt_id and status='draft' returning * into v_row;end if;
 if v_row.id is null then select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=p_edt_id;insert into public.edt_reports(edt_id,report_version,status,storage_bucket,report_path,requester_contact_id,generated_at,generated_by,client_visible,title,summary,conclusion,content_snapshot,support_count) values(p_edt_id,v_version,'ready',p_storage_bucket,p_report_path,v_requester,now(),auth.uid(),p_client_visible,p_title,p_summary,p_conclusion,p_content_snapshot,p_support_count) returning * into v_row;end if;
 return v_row;
END;
END;
$function$
;
