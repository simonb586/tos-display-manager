-- V1.3.8 — dérivation canonique du client des enjeux Terrain.
-- Migration additive : aucune donnée historique n'est modifiée.

begin;

create or replace function public.derive_terrain_issue_client_v138()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_id bigint;
begin
  select i.client_id
    into v_client_id
    from public.infrastructures i
   where i.support_id = new.support_id;

  if not found then
    raise exception 'terrain_issue_support_not_found'
      using errcode = '23503';
  end if;

  if v_client_id is null then
    raise exception 'terrain_issue_client_ownership_required'
      using errcode = '23502';
  end if;

  if new.client_id is not null and new.client_id <> v_client_id then
    raise exception 'terrain_issue_client_ownership_mismatch'
      using errcode = '23514';
  end if;

  new.client_id := v_client_id;
  return new;
end;
$$;

revoke all on function public.derive_terrain_issue_client_v138() from public, anon;
grant execute on function public.derive_terrain_issue_client_v138() to authenticated, service_role;

drop trigger if exists derive_terrain_issue_client_v138 on public.enjeux_terrain;
create trigger derive_terrain_issue_client_v138
before insert or update of support_id, client_id on public.enjeux_terrain
for each row execute function public.derive_terrain_issue_client_v138();

comment on function public.derive_terrain_issue_client_v138() is
  'Dérive client_id depuis infrastructures.support_id et refuse toute contradiction fournie par l’appelant.';

commit;
