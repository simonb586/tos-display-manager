-- Preserve all existing activity rows and the source uniqueness constraint.
ALTER TABLE public.reports ADD COLUMN activity_revision bigint NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX reports_one_child_per_parent ON public.reports(parent_report_id) WHERE parent_report_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.module15_report_revision_before() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='published' AND (to_jsonb(NEW)-ARRAY['activity_revision','updated_at','updated_by','status','client_published','published_by','published_at','archived_by','archived_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['activity_revision','updated_at','updated_by','status','client_published','published_by','published_at','archived_by','archived_at']) THEN RAISE EXCEPTION 'published_report_immutable_create_new_version' USING ERRCODE='22023';END IF;
 IF TG_OP='INSERT' THEN NEW.activity_revision:=1;
 ELSIF (to_jsonb(NEW)-ARRAY['activity_revision','updated_at','updated_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['activity_revision','updated_at','updated_by']) THEN NEW.activity_revision:=OLD.activity_revision+1;
 ELSE NEW.activity_revision:=OLD.activity_revision;END IF;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.module15_report_revision_before() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reports_revision_before BEFORE INSERT OR UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.module15_report_revision_before();
CREATE OR REPLACE FUNCTION public.module15_report_activity_v130()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_action text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.activity_revision=OLD.activity_revision THEN RETURN NEW;END IF;
v_action:=case when tg_op='INSERT' then case when new.status='generated' then 'Génération' else 'Création brouillon' end when old.status='published' and new.status='generated' then 'Dépublication' when new.status='generated' and old.status is distinct from new.status then 'Génération' when new.status='published' then 'Publication' when old.status='published' and new.status='generated' then 'Dépublication' when new.status='archived' then 'Archivage' else 'Modification' end;
 insert into public.activity_events(occurred_at,actor_id,actor_email,action,module,entity_type,entity_id,old_value,new_value,campaign_id,edt_id,support_id,client_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
 values(now(),auth.uid(),auth.jwt()->>'email',v_action,'Rapports et livrables','report',new.id::text,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),coalesce(new.campaign_id,new.communication_id)::text,new.no_edt,new.support_id,new.client_id::text,'reports',new.status,jsonb_build_object('report_type',new.report_type,'version',new.version),'reports',new.id::text||':v'||new.version::text||':r'||new.activity_revision::text,now(),'direct','exact');
 return new;
end$function$
;
CREATE OR REPLACE FUNCTION public.module15_generate_report_v130(p_report_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS reports
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.reports%rowtype; n public.reports%rowtype;
BEGIN
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
