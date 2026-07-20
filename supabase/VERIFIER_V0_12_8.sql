-- Vérification TOS Display Manager v0.12.8
select
  to_regclass('public.support_photos') is not null as support_photos_presente,
  to_regclass('public.infrastructures') is not null as infrastructures_presente;

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'support_photos'
  and policyname = 'support_photos_delete_admin_v0128';
