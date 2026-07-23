-- Vérification structurelle de l'Assistant d'automatisation.
-- À exécuter après V0_13_1_AUTOMATION_ASSISTANT.sql.

begin;

do $$
begin
  if to_regclass('public.automation_definitions') is null then
    raise exception 'ÉCHEC: table automation_definitions absente.';
  end if;
  if to_regprocedure(
    'public.approve_automation_definition_v0131(uuid)'
  ) is null then
    raise exception 'ÉCHEC: RPC d''approbation absente.';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.automation_definitions'::regclass
       and tgname = 'prepare_automation_definition_v0131'
       and not tgisinternal
  ) then
    raise exception 'ÉCHEC: trigger de révocation absent.';
  end if;
  if exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.automation_definitions'::regclass
       and not tgisinternal
       and pg_get_triggerdef(oid) ilike '%relation_rules%'
  ) then
    raise exception 'ÉCHEC: liaison exécutable interdite détectée.';
  end if;

  raise notice 'OK: stockage déclaratif présent.';
  raise notice 'OK: approbation explicite présente.';
  raise notice 'OK: aucune traduction automatique vers relation_rules.';
end;
$$;

rollback;
