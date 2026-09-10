-- Retry the same failed request; preserve delivery identity and provider idempotency.
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
SELECT id INTO v_id FROM public.email_outbox WHERE edt_id=p_edt_id AND report_id=p_report_id AND recipient_emails IS NOT DISTINCT FROM p_recipients AND accompaniment_message IS NOT DISTINCT FROM p_message AND requested_by=auth.uid() AND (status IN ('pending','sending','failed') OR (status='sent' AND NOT p_resend)) ORDER BY id DESC LIMIT 1;IF FOUND THEN UPDATE public.email_outbox SET status='pending',attempt_count=0,next_attempt_at=now(),last_error=null,updated_at=now() WHERE id=v_id AND status='failed';RETURN v_id;END IF;
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
