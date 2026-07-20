-- TOS Display Manager v0.12.8 — stabilisation photos et diagnostic
begin;

-- Administrators may delete photo records. Existing broader policies remain unchanged.
drop policy if exists "support_photos_delete_admin_v0128" on public.support_photos;
create policy "support_photos_delete_admin_v0128"
on public.support_photos
for delete
to authenticated
using (
  exists (
    select 1
    from public.utilisateurs u
    where lower(u.email) = lower(auth.jwt() ->> 'email')
      and lower(coalesce(u.role, '')) in ('administrateur', 'admin')
      and coalesce(u.actif, true) = true
  )
);

commit;
