-- Préflight et vérification après migration.

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    coalesce(qual, '') ilike '%terrain-photos%'
    or coalesce(with_check, '') ilike '%terrain-photos%'
  )
order by policyname;

select
  count(*) filter (
    where role = 'Administrateur'
      and lower(coalesce(statut, '')) = 'actif'
  ) as administrateurs_actifs,
  count(*) filter (
    where role = 'Administrateur'
      and lower(coalesce(statut, '')) = 'actif'
      and auth_user_id is not null
  ) as administrateurs_actifs_lies_auth
from public.utilisateurs;

select
  p.proname,
  p.prosecdef as security_definer,
  p.provolatile,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_app_role', 'tos_current_role')
order by p.proname;
