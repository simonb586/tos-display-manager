-- The revision-aware handler already skips no-op updates. Cover content and visibility as well as status.
CREATE OR REPLACE TRIGGER edt_report_activity_v130 AFTER INSERT OR UPDATE ON public.edt_reports FOR EACH ROW EXECUTE FUNCTION public.edt_report_activity_v130();
