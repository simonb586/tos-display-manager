-- Remove a report version from active use while preserving its PDF and history.
ALTER TABLE public.edt_reports ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.edt_reports ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.edt_reports DROP CONSTRAINT edt_reports_status_check;
ALTER TABLE public.edt_reports ADD CONSTRAINT edt_reports_status_check CHECK (status IN ('draft','generated','ready','error','deleted'));
ALTER TABLE public.edt_reports DROP CONSTRAINT edt_reports_file_ready_v132;
ALTER TABLE public.edt_reports ADD CONSTRAINT edt_reports_file_ready_v132 CHECK (status IN ('draft','error','deleted') OR (report_path IS NOT NULL AND generated_at IS NOT NULL));

CREATE OR REPLACE FUNCTION public.guard_edt_report_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.utilisateurs%rowtype; e public.suivi_des_edt%rowtype;
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='deleted' THEN
   IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'deleted_report_immutable' USING ERRCODE='22023'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.status<>'deleted' THEN
   IF NEW.deleted_at IS NOT NULL OR NEW.deleted_by IS NOT NULL THEN RAISE EXCEPTION 'invalid_report_deletion' USING ERRCODE='22023'; END IF;
   RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN RAISE EXCEPTION 'invalid_report_deletion' USING ERRCODE='22023'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','deleted_at','deleted_by','client_visible','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','deleted_at','deleted_by','client_visible','updated_at']) THEN
   RAISE EXCEPTION 'report_deletion_cannot_modify_content' USING ERRCODE='22023';
 END IF;
 SELECT * INTO actor FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND lower(coalesce(statut,''))='actif';
 SELECT * INTO e FROM public.suivi_des_edt WHERE id=OLD.edt_id;
 IF auth.uid() IS NULL OR actor.id IS NULL OR actor.role NOT IN ('Administrateur','Coordonnateur')
 OR (actor.client_id IS NULL AND actor.role<>'Administrateur')
 OR public.tos_table_resource_scope(e.client_id,NULL,e.campagne_id,e.id,false) IS NOT TRUE THEN
   RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.email_outbox WHERE edt_id=OLD.edt_id AND (report_id=OLD.id OR report_id IS NULL) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.email_outbox WHERE edt_id=OLD.edt_id AND (report_id=OLD.id OR report_id IS NULL) AND status='sending') THEN
   RAISE EXCEPTION 'report_delivery_in_progress' USING ERRCODE='40001';
 END IF;
 UPDATE public.email_outbox SET status='failed',attempt_count=5,last_error='report_deleted',updated_at=now()
 WHERE edt_id=OLD.edt_id AND (report_id=OLD.id OR report_id IS NULL) AND status IN ('pending','failed');
 NEW.deleted_at:=now(); NEW.deleted_by:=auth.uid(); NEW.client_visible:=false;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_edt_report_deletion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER edt_report_deletion_guard BEFORE INSERT OR UPDATE ON public.edt_reports FOR EACH ROW EXECUTE FUNCTION public.guard_edt_report_deletion();

CREATE OR REPLACE FUNCTION public.delete_edt_report(p_report_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.utilisateurs%rowtype; r public.edt_reports%rowtype; e public.suivi_des_edt%rowtype;
BEGIN
 SELECT * INTO actor FROM public.utilisateurs WHERE auth_user_id=auth.uid() AND lower(coalesce(statut,''))='actif';
 IF auth.uid() IS NULL OR actor.id IS NULL OR actor.role NOT IN ('Administrateur','Coordonnateur')
 OR (actor.client_id IS NULL AND actor.role<>'Administrateur') THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.edt_reports WHERE id=p_report_id;
 SELECT * INTO e FROM public.suivi_des_edt WHERE id=r.edt_id;
 IF r.id IS NULL OR public.tos_table_resource_scope(e.client_id,NULL,e.campagne_id,e.id,false) IS NOT TRUE THEN RAISE EXCEPTION 'report_scope_denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.suivi_des_edt WHERE id=e.id FOR UPDATE;
 SELECT * INTO r FROM public.edt_reports WHERE id=p_report_id FOR UPDATE;
 IF r.status='deleted' THEN RETURN r.id; END IF;
 UPDATE public.edt_reports SET status='deleted',updated_at=now() WHERE id=r.id;
 RETURN r.id;
END $$;
REVOKE ALL ON FUNCTION public.delete_edt_report(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_edt_report(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.edt_report_activity_v130()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE event_action text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.activity_revision=OLD.activity_revision THEN RETURN NEW;END IF;
 event_action:=CASE WHEN NEW.status='deleted' THEN 'rapport_supprime' WHEN NEW.status='error' THEN 'rapport_generation_echouee' WHEN NEW.status='draft' THEN 'rapport_brouillon' ELSE 'rapport_genere' END;
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN event_action:=CASE WHEN NEW.client_visible IS DISTINCT FROM OLD.client_visible THEN 'rapport_visibilite_modifiee' ELSE 'rapport_modifie' END;END IF;
 INSERT INTO public.activity_events(occurred_at,actor_id,actor_email,action,module,entity_type,entity_id,edt_id,source,status,metadata,source_system,source_record_id,source_occurred_at,reconstruction_method,confidence)
 VALUES(now(),auth.uid(),auth.jwt()->>'email',event_action,'Rapports EDT','edt_report',NEW.id::text,NEW.edt_id::text,'edt_reports',NEW.status,jsonb_build_object('report_version',NEW.report_version,'activity_revision',NEW.activity_revision),'edt_reports',NEW.id::text||':v'||NEW.report_version::text||':r'||NEW.activity_revision::text,now(),'direct','exact');
 RETURN NEW;
END $function$
;
