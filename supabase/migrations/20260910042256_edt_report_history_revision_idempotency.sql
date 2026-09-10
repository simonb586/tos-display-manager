ALTER TABLE public.edt_reports ADD COLUMN activity_revision bigint NOT NULL DEFAULT 0;
CREATE FUNCTION public.edt_report_revision_before()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN NEW.activity_revision:=1;
 ELSIF (to_jsonb(NEW)-ARRAY['activity_revision','updated_at','generated_at','generated_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['activity_revision','updated_at','generated_at','generated_by']) THEN NEW.activity_revision:=OLD.activity_revision+1;
 ELSE NEW.activity_revision:=OLD.activity_revision;END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.edt_report_revision_before() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER edt_report_revision_before BEFORE INSERT OR UPDATE ON public.edt_reports FOR EACH ROW EXECUTE FUNCTION public.edt_report_revision_before();
CREATE OR REPLACE FUNCTION public.edt_report_activity_v130()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE event_action text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.activity_revision=OLD.activity_revision THEN RETURN NEW;END IF;
 event_action:=CASE WHEN NEW.status='error' THEN 'rapport_generation_echouee' WHEN NEW.status='draft' THEN 'rapport_brouillon' ELSE 'rapport_genere' END;
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN event_action:=CASE WHEN NEW.client_visible IS DISTINCT FROM OLD.client_visible THEN 'rapport_visibilite_modifiee' ELSE 'rapport_modifie' END;END IF;
 INSERT INTO public.activity_events(occurred_at,actor_id,actor_email,action,module,entity_type,entity_id,edt_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
 VALUES(now(),auth.uid(),auth.jwt()->>'email',event_action,'Rapports EDT','edt_report',NEW.id::text,NEW.edt_id::text,'edt_reports',NEW.status,jsonb_build_object('report_version',NEW.report_version,'activity_revision',NEW.activity_revision),'edt_reports',NEW.id::text||':v'||NEW.report_version::text||':r'||NEW.activity_revision::text,now(),'direct','exact');
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.edt_report_activity_v130() FROM PUBLIC,anon,authenticated,service_role;
