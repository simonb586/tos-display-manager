-- TOS Display Manager V1.3.10 — durcissement additif ciblé.
begin;

drop policy if exists relation_test_logs_authenticated_read on public.relation_test_logs;

alter function public.approve_automation_definition_v0131(uuid) set search_path='';
revoke all on function public.approve_automation_definition_v0131(uuid) from public,anon;
grant execute on function public.approve_automation_definition_v0131(uuid) to authenticated;

commit;
