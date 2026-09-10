-- Additive hardening. Existing function signatures and ACLs are preserved.
-- No business rows, objects, grants or applied migrations are changed.

CREATE OR REPLACE FUNCTION public.save_edt_report_draft_v132(p_edt_id bigint, p_title text, p_summary text, p_conclusion text, p_content_snapshot jsonb, p_support_count integer, p_client_visible boolean DEFAULT false, p_report_id uuid DEFAULT NULL::uuid)
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
IF p_report_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.edt_reports WHERE id=p_report_id AND edt_id=p_edt_id AND status='draft') THEN RAISE EXCEPTION 'report_version_conflict_reload_latest' USING ERRCODE='40001';END IF;
IF p_report_id IS NULL THEN SELECT * INTO v_row FROM public.edt_reports WHERE edt_id=p_edt_id AND status='draft' AND title IS NOT DISTINCT FROM p_title AND summary IS NOT DISTINCT FROM p_summary AND conclusion IS NOT DISTINCT FROM p_conclusion AND content_snapshot IS NOT DISTINCT FROM p_content_snapshot AND support_count IS NOT DISTINCT FROM p_support_count AND client_visible IS NOT DISTINCT FROM p_client_visible ORDER BY report_version DESC LIMIT 1;IF FOUND THEN RETURN v_row;END IF;END IF;
 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501';end if;
 select requester_contact_id into v_requester from public.suivi_des_edt where id=p_edt_id and statut='Complété';if v_requester is null then raise exception 'completed_edt_requester_required';end if;
 select count(*) into v_source_count from public.edt_supports where edt_id=p_edt_id;
 if v_source_count<>p_support_count or jsonb_array_length(coalesce(p_content_snapshot->'supports','[]'::jsonb))<>v_source_count then raise exception 'report_missing_edt_supports';end if;
 if p_report_id is not null then update public.edt_reports set title=p_title,summary=p_summary,conclusion=p_conclusion,content_snapshot=p_content_snapshot,support_count=p_support_count,updated_at=now() where id=p_report_id and edt_id=p_edt_id and status='draft' returning * into v_row;end if;
 if v_row.id is null then select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=p_edt_id;insert into public.edt_reports(edt_id,report_version,status,requester_contact_id,generated_by,client_visible,title,summary,conclusion,content_snapshot,support_count) values(p_edt_id,v_version,'draft',v_requester,auth.uid(),p_client_visible,p_title,p_summary,p_conclusion,p_content_snapshot,p_support_count) returning * into v_row;end if;
 return v_row;
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
 if p_report_id is not null then update public.edt_reports set status='ready',report_path=p_report_path,storage_bucket=p_storage_bucket,title=p_title,summary=p_summary,conclusion=p_conclusion,content_snapshot=p_content_snapshot,support_count=p_support_count,generated_at=now(),updated_at=now() where id=p_report_id and edt_id=p_edt_id and status='draft' returning * into v_row;end if;
 if v_row.id is null then select coalesce(max(report_version),0)+1 into v_version from public.edt_reports where edt_id=p_edt_id;insert into public.edt_reports(edt_id,report_version,status,storage_bucket,report_path,requester_contact_id,generated_at,generated_by,client_visible,title,summary,conclusion,content_snapshot,support_count) values(p_edt_id,v_version,'ready',p_storage_bucket,p_report_path,v_requester,now(),auth.uid(),p_client_visible,p_title,p_summary,p_conclusion,p_content_snapshot,p_support_count) returning * into v_row;end if;
 return v_row;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_edt_report_v1301(p_edt_id bigint, p_report_path text, p_storage_bucket text DEFAULT 'final-reports'::text, p_client_visible boolean DEFAULT false)
 RETURNS edt_reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_edt public.suivi_des_edt%rowtype;v_requester public.utilisateurs%rowtype;v_client bigint;v_report public.edt_reports%rowtype;v_version integer;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

PERFORM 1 FROM public.suivi_des_edt WHERE id=p_edt_id FOR UPDATE;

IF p_storage_bucket IS DISTINCT FROM 'final-reports' OR p_report_path IS NULL OR p_report_path !~* '[.]pdf$' OR p_report_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]' OR
 (SELECT count(*) FROM public.suivi_des_edt e WHERE regexp_replace(coalesce(e.no_edt,e.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_report_path,'/',1))<>1 OR
 NOT EXISTS(SELECT 1 FROM public.suivi_des_edt e WHERE e.id=p_edt_id AND regexp_replace(coalesce(e.no_edt,e.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_report_path,'/',1)) OR
 EXISTS(SELECT 1 FROM public.edt_reports r WHERE r.report_path=p_report_path AND (r.edt_id<>p_edt_id OR r.storage_bucket IS DISTINCT FROM 'final-reports')) OR
 EXISTS(SELECT 1 FROM public.communications_finales r WHERE r.report_path=p_report_path AND r.edt_id IS DISTINCT FROM p_edt_id::text)
THEN RAISE EXCEPTION 'report_path_denied' USING ERRCODE='42501';END IF;
SELECT * INTO v_report FROM public.edt_reports WHERE edt_id=p_edt_id AND report_path=p_report_path AND storage_bucket=p_storage_bucket AND status='ready';IF FOUND THEN RETURN v_report;END IF;
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
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.request_edt_report_email_v132(p_edt_id bigint, p_report_id uuid, p_recipients text[], p_message text DEFAULT ''::text, p_resend boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id bigint;v_report public.edt_reports;
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
 insert into public.email_outbox(event_type,edt_id,idempotency_key,report_id,report_version,status,manual_resend,requested_by,recipient_emails,accompaniment_message) values('edt_completed_report_sent',p_edt_id,'edt_completed_report_sent:'||p_edt_id||':manual:'||gen_random_uuid(),v_report.id,v_report.report_version,'pending',p_resend,auth.uid(),p_recipients,p_message) returning id into v_id;return v_id;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.request_edt_email_retry_v131(p_edt_id bigint, p_resend boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id bigint;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=p_edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'edt_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

PERFORM 1 FROM public.suivi_des_edt WHERE id=p_edt_id FOR UPDATE;
 if auth.uid() is null or public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'access_denied' using errcode='42501'; end if;
 if not exists(select 1 from public.suivi_des_edt where id=p_edt_id and statut='Complété') then raise exception 'edt_not_completed'; end if;
 if (select count(*) from public.email_outbox where edt_id=p_edt_id and requested_by=auth.uid() and created_at>now()-interval '1 hour')>=3 then raise exception 'email_rate_limit'; end if;
 if p_resend then
  insert into public.email_outbox(event_type,edt_id,idempotency_key,status,manual_resend,requested_by) values('edt_completed_report_sent',p_edt_id,'edt_completed_report_sent:'||p_edt_id::text||':manual:'||gen_random_uuid()::text,'pending',true,auth.uid()) returning id into v_id;
 else
  update public.email_outbox set status='pending',attempt_count=0,next_attempt_at=now(),last_error=null,requested_by=auth.uid(),updated_at=now() where edt_id=p_edt_id and event_type='edt_completed_report_sent' and not manual_resend and status='failed' returning id into v_id;
  if v_id is null and not exists(select 1 from public.email_outbox where edt_id=p_edt_id and event_type='edt_completed_report_sent') then insert into public.email_outbox(event_type,edt_id,idempotency_key,status,manual_resend,requested_by) values('edt_completed_report_sent',p_edt_id,'edt_completed_report_sent:'||p_edt_id::text||':manual:'||gen_random_uuid()::text,'pending',true,auth.uid()) returning id into v_id; end if;
 end if;
 if v_id is null then raise exception 'retry_not_available'; end if;
 return v_id;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.source_rapport_phase_v133(p_phase_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.edt_phases%rowtype;e public.suivi_des_edt%rowtype;c public.campagnes_maitres%rowtype;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur','Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phases sec_phase JOIN public.suivi_des_edt sec_edt ON sec_edt.id=sec_phase.edt_id WHERE sec_phase.id=p_phase_id AND (sec_phase.client_id IS NULL OR sec_phase.client_id=sec_edt.client_id) AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'phase_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 select * into p from public.edt_phases where id=p_phase_id;if not found then raise exception 'phase_not_found';end if;
 select * into e from public.suivi_des_edt where id=p.edt_id;select * into c from public.campagnes_maitres where id=e.campagne_id;
 if public.current_app_role() in ('Client','Client-Admin') and not public.client_can_access_campaign_v120(c.id) then raise exception 'phase_client_scope_denied' using errcode='42501';end if;
 return jsonb_build_object('phase_id',p.id,'edt_id',e.id,'no_edt',e.no_edt,'phase_type',p.phase_type,'intervention_type',case p.phase_type when 'installation' then 'Installation' else 'Retrait' end,'status',p.statut,'scheduled_date',p.date_debut_prevue,'supports',(select coalesce(jsonb_agg(jsonb_build_object('assignment_id',s.id,'support_id',s.support_id,'status',s.statut) order by s.support_id),'[]') from public.edt_supports s where s.phase_id=p.id AND public.tos_table_resource_scope(NULL,s.support_id,NULL,s.edt_id,false)),'reports',(select coalesce(jsonb_agg(to_jsonb(r) order by r.version desc),'[]') from public.edt_phase_reports r where r.phase_id=p.id AND (public.tos_current_role() IN ('Administrateur','Coordonnateur','Installateur') OR (r.client_visible AND NOT coalesce(r.archived,false)))));
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marquer_rapport_phase_envoye_v132p1(p_report_id bigint, p_recipient text, p_provider_message_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.edt_phase_reports%rowtype;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.edt_phase_reports sec_report WHERE sec_report.id=p_report_id AND EXISTS(SELECT 1 FROM public.suivi_des_edt sec_edt WHERE sec_edt.id=sec_report.edt_id AND public.tos_table_resource_scope(sec_edt.client_id,NULL,sec_edt.campagne_id,NULL,false)))) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

  if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Permission insuffisante.' using errcode='42501';end if;
  if coalesce(trim(p_recipient),'')='' then raise exception 'Destinataire obligatoire.';end if;
  select * into r from public.edt_phase_reports where id=p_report_id for update;if not found then raise exception 'Rapport introuvable.';end if;
  update public.edt_phase_reports set status='envoye',recipient=p_recipient,sent_at=now(),sent_by=auth.uid(),provider_message_id=p_provider_message_id where id=r.id;
  perform public.tdm_edt_audit_v132p1(r.edt_id,r.phase_id,'ENVOI_RAPPORT',to_jsonb(r),(select to_jsonb(x) from public.edt_phase_reports x where x.id=r.id),p_recipient);
  return jsonb_build_object('ok',true,'report_id',r.id,'sent_at',now());
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.module15_generate_report_v130(p_report_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.reports%rowtype; n public.reports%rowtype;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.reports sec_report WHERE sec_report.id=p_report_id AND public.tos_table_resource_scope(sec_report.client_id,sec_report.support_id,sec_report.campaign_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Accès refusé'; end if;
 select * into r from public.reports where id=p_report_id for update;
 if not found or r.status not in ('draft','generated','published','error') then raise exception 'Transition non autorisée'; end if;
 if r.status='published' then
  select * into n from public.reports where parent_report_id=r.id;
  if found then
   if n.metadata IS DISTINCT FROM coalesce(p_metadata,r.metadata) then raise exception 'report_version_conflict_reload_latest' using errcode='40001';end if;
   return n;
  end if;
  insert into public.reports(report_type,title,client_id,campaign_id,communication_id,site,support_id,no_edt,period_start,period_end,status,client_published,created_by,updated_by,metadata,template_key,version,parent_report_id)
  values(r.report_type,r.title,r.client_id,r.campaign_id,r.communication_id,r.site,r.support_id,r.no_edt,r.period_start,r.period_end,'generated',false,auth.uid(),auth.uid(),coalesce(p_metadata,r.metadata),r.template_key,r.version+1,r.id) returning * into n;
 else
  update public.reports set status='generated',client_published=false,published_by=null,published_at=null,metadata=coalesce(p_metadata,metadata),updated_by=auth.uid(),updated_at=now() where id=r.id returning * into n;
 end if;
 return n;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.module15_transition_report_v130(p_report_id uuid, p_action text)
 RETURNS reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.reports%rowtype;
BEGIN

IF NOT EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')) THEN RAISE EXCEPTION 'report_client_required' USING ERRCODE='42501';END IF;
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Administrateur','Coordonnateur')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.reports sec_report WHERE sec_report.id=p_report_id AND public.tos_table_resource_scope(sec_report.client_id,sec_report.support_id,sec_report.campaign_id,NULL,false))) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';END IF;

BEGIN

 if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Accès refusé'; end if;
 select * into r from public.reports where id=p_report_id for update;
 if not found then raise exception 'Rapport introuvable'; end if;
 if (p_action='publish' and r.status='published') or (p_action='unpublish' and r.status='generated') or (p_action='archive' and r.status='archived') then return r;end if;
 if p_action='publish' and r.status='generated' then
  update public.reports set status='published',client_published=true,published_by=auth.uid(),published_at=now(),archived_by=null,archived_at=null,updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 elsif p_action='unpublish' and r.status='published' then
  update public.reports set status='generated',client_published=false,published_by=null,published_at=null,updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 elsif p_action='archive' and r.status in ('draft','generated','published','error') then
  update public.reports set status='archived',client_published=false,published_by=null,published_at=null,archived_by=auth.uid(),archived_at=now(),updated_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 else raise exception 'Transition non autorisée'; end if;
 return r;
END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tos_storage_tenant_scope(p_bucket text, p_path text, p_action text, p_owner text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r text:=public.tos_current_role();a bigint;s text;owner_client bigint;e bigint;p record;matched boolean:=false;
BEGIN
 IF p_bucket='terrain-photos' AND p_action='read' THEN RETURN true;END IF;
 IF auth.uid() IS NULL OR r IS NULL OR p_action IS NULL OR p_action NOT IN ('read','insert','update','delete') OR p_path IS NULL OR p_path='' OR p_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]' THEN RETURN false;END IF;
 SELECT u.client_id INTO a FROM public.utilisateurs u WHERE u.auth_user_id=auth.uid() AND lower(coalesce(u.statut,''))='actif';
 IF a IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=a) THEN RETURN false;END IF;
 IF r IN ('Client','Client-Admin') AND a IS NULL THEN RETURN false;END IF;
 IF p_action<>'read' AND r NOT IN ('Administrateur','Coordonnateur','Installateur') THEN RETURN false;END IF;
 IF p_action='insert' AND p_owner IS DISTINCT FROM auth.uid()::text THEN RETURN false;END IF;
 IF p_bucket='terrain-photos' THEN
  IF p_action='update' THEN RETURN false;END IF;
  s:=case when split_part(p_path,'/',1)='supports' then split_part(p_path,'/',2) else split_part(p_path,'/',1) end;
  RETURN public.tos_table_resource_scope(null,s,null,null,false) IS TRUE;
 ELSIF p_bucket='support-photos' THEN
  FOR p IN SELECT x.* FROM public.support_photos x WHERE coalesce(x.storage_bucket,'support-photos')='support-photos' AND (x.storage_path=p_path OR (x.assignment_pending AND x.target_storage_path=p_path)) LOOP
   matched:=true;
   IF public.tos_table_resource_scope(p.client_id,p.support_id,p.campagne_id,nullif(p.edt_id,'')::bigint,p.source='mass_import') IS NOT TRUE THEN RETURN false;END IF;
   IF p.assignment_pending AND public.tos_table_resource_scope(p.target_client_id,p.target_support_id,null,null,false) IS NOT TRUE THEN RETURN false;END IF;
   IF r IN ('Client','Client-Admin') AND (p.client_visible IS NOT TRUE OR public.client_can_access_campaign_v120(p.campagne_id) IS NOT TRUE) THEN RETURN false;END IF;
  END LOOP;
  IF matched THEN RETURN true;END IF;
  IF r NOT IN ('Administrateur','Coordonnateur','Installateur') THEN RETURN false;END IF;
  s:=case when split_part(p_path,'/',1)='supports' then split_part(p_path,'/',2) else split_part(p_path,'/',1) end;
  IF public.tos_table_resource_scope(null,s,null,null,false) IS TRUE THEN RETURN true;END IF;
  RETURN a IS NULL AND (p_action='read' OR (r IN ('Administrateur','Coordonnateur') AND split_part(p_path,'/',1)='review'));
 ELSIF p_bucket='final-reports' THEN
  IF a IS NULL AND r IS DISTINCT FROM 'Administrateur' THEN RETURN false;END IF;
  IF r NOT IN ('Administrateur','Coordonnateur','Client','Client-Admin') THEN RETURN false;END IF;
  IF p_path !~* '[.]pdf$' OR (SELECT count(*) FROM public.suivi_des_edt x WHERE regexp_replace(coalesce(x.no_edt,x.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_path,'/',1))<>1 THEN RETURN false;END IF;
  SELECT x.id INTO e FROM public.suivi_des_edt x WHERE regexp_replace(coalesce(x.no_edt,x.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_path,'/',1);
  IF public.tos_table_resource_scope(null,null,null,e,false) IS NOT TRUE THEN RETURN false;END IF;
  IF EXISTS(SELECT 1 FROM public.edt_reports x WHERE x.report_path=p_path AND (x.edt_id IS DISTINCT FROM e OR x.storage_bucket IS DISTINCT FROM 'final-reports')) OR EXISTS(SELECT 1 FROM public.communications_finales x WHERE x.report_path=p_path AND x.edt_id IS DISTINCT FROM e::text) THEN RETURN false;END IF;
  FOR p IN SELECT x.edt_id,x.status,x.client_visible FROM public.edt_reports x WHERE x.report_path=p_path LOOP
   matched:=true;IF public.tos_table_resource_scope(null,null,null,p.edt_id,false) IS NOT TRUE THEN RETURN false;END IF;
   IF r IN ('Client','Client-Admin') AND (p.status IS DISTINCT FROM 'ready' OR p.client_visible IS NOT TRUE OR NOT EXISTS(SELECT 1 FROM public.suivi_des_edt x WHERE x.id=p.edt_id AND x.client_visible AND public.client_can_access_campaign_v120(x.campagne_id) IS TRUE)) THEN RETURN false;END IF;
  END LOOP;
  FOR p IN SELECT x.client_id,x.edt_id,x.client_published FROM public.communications_finales x WHERE x.report_path=p_path LOOP
   matched:=true;IF public.tos_table_resource_scope(p.client_id,null,null,nullif(p.edt_id,'')::bigint,false) IS NOT TRUE THEN RETURN false;END IF;
   IF r IN ('Client','Client-Admin') AND p.client_published IS NOT TRUE THEN RETURN false;END IF;
  END LOOP;
  IF matched THEN RETURN true;END IF;
  IF r NOT IN ('Administrateur','Coordonnateur') THEN RETURN false;END IF;
  IF (SELECT count(*) FROM public.suivi_des_edt x WHERE regexp_replace(coalesce(x.no_edt,x.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_path,'/',1))<>1 THEN RETURN false;END IF;
  SELECT x.id INTO e FROM public.suivi_des_edt x WHERE regexp_replace(coalesce(x.no_edt,x.id::text),'[^a-zA-Z0-9_-]','_','g')=split_part(p_path,'/',1);
  RETURN public.tos_table_resource_scope(null,null,null,e,false) IS TRUE;
 END IF;
 RETURN false;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $function$
;

CREATE OR REPLACE FUNCTION public.module15_client_edt_reports_v130(p_page integer DEFAULT 1, p_page_size integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_client bigint;v_limit integer:=least(greatest(coalesce(p_page_size,25),1),100);v_offset integer:=(greatest(coalesce(p_page,1),1)-1)*v_limit;
BEGIN
IF (auth.uid() IS NOT NULL AND public.tos_current_role() IN ('Client','Client-Admin')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_rpc_role_denied' USING ERRCODE='42501';END IF;
IF (NOT EXISTS(SELECT 1 FROM public.utilisateurs actor_profile WHERE actor_profile.auth_user_id=auth.uid() AND lower(coalesce(actor_profile.statut,''))='actif' AND actor_profile.client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients actor_owner WHERE actor_owner.id=actor_profile.client_id))) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_actor_client_invalid' USING ERRCODE='42501';END IF;
IF (EXISTS(SELECT 1 FROM public.utilisateurs sec_actor JOIN public.clients sec_client ON sec_client.id=sec_actor.client_id WHERE sec_actor.auth_user_id=auth.uid() AND lower(coalesce(sec_actor.statut,''))='actif')) IS NOT TRUE THEN RAISE EXCEPTION 'canonical_client_required' USING ERRCODE='42501';END IF;

BEGIN

 select client_id into v_client from public.utilisateurs where auth_user_id=auth.uid() and statut='Actif' and role in ('Client','Client-Admin') limit 1;
 if v_client is null then raise exception 'client_scope_denied' using errcode='42501'; end if;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(q)) from (
   select r.id,r.edt_id,e.no_edt,r.report_version,r.status,r.report_path,r.generated_at
   from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id
   where e.client_id=v_client and c.client_id=v_client and c.client_published and e.client_visible and r.client_visible and r.status='ready'
     and public.client_can_access_campaign_v120(c.id)
   order by r.generated_at desc limit v_limit offset v_offset)q),'[]'::jsonb),
   'total',(select count(*) from public.edt_reports r join public.suivi_des_edt e on e.id=r.edt_id join public.campagnes_maitres c on c.id=e.campagne_id where e.client_id=v_client and c.client_id=v_client and c.client_published and e.client_visible and r.client_visible and r.status='ready' and public.client_can_access_campaign_v120(c.id)),
   'page',greatest(coalesce(p_page,1),1),'page_size',v_limit);
END;
END;
$function$
;

CREATE POLICY report_global_admin_only ON public.edt_reports AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur'))) WITH CHECK (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')));

CREATE POLICY report_global_admin_only ON public.edt_phase_reports AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur'))) WITH CHECK (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')));

CREATE POLICY report_global_admin_only ON public.reports AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur'))) WITH CHECK (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')));

CREATE POLICY report_global_admin_only ON public.communications_finales AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur'))) WITH CHECK (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')));

CREATE POLICY report_global_admin_only ON public.email_outbox AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur'))) WITH CHECK (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')));

CREATE POLICY report_global_admin_only ON public.email_delivery_log AS RESTRICTIVE FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur'))) WITH CHECK (EXISTS(SELECT 1 FROM public.utilisateurs a WHERE a.auth_user_id=auth.uid() AND lower(coalesce(a.statut,''))='actif' AND (a.client_id IS NOT NULL OR a.role='Administrateur')));
