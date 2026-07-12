-- TOS Display Manager — Bloc 7.5 Production
-- Exécuter après validation locale du Bloc 7.4.

-- Lie automatiquement un compte Auth au profil applicatif portant le même courriel.
create or replace function public.link_auth_user_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.utilisateurs
  set auth_user_id = new.id,
      updated_at = now()
  where lower(courriel) = lower(new.email)
    and (auth_user_id is null or auth_user_id = new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_link_profile on auth.users;
create trigger on_auth_user_link_profile
after insert or update of email on auth.users
for each row execute procedure public.link_auth_user_to_profile();

-- Rattache les comptes Auth déjà créés.
update public.utilisateurs u
set auth_user_id = au.id,
    updated_at = now()
from auth.users au
where lower(u.courriel) = lower(au.email)
  and (u.auth_user_id is null or u.auth_user_id = au.id);

-- Retrait des politiques temporaires de développement ouvertes au public.
drop policy if exists "campagnes_maitres_test_local" on public.campagnes_maitres;
drop policy if exists "campagnes_maitres_anon_insert" on public.campagnes_maitres;
drop policy if exists "campagnes_maitres_anon_update" on public.campagnes_maitres;
drop policy if exists "campagnes_maitres_anon_delete" on public.campagnes_maitres;
drop policy if exists "relation_fields_anon_read" on public.relation_fields;
drop policy if exists "relation_rules_anon_read" on public.relation_rules;
drop policy if exists "relation_test_logs_anon_read" on public.relation_test_logs;
drop policy if exists "campagne_visuels_formats_public_write_dev" on public.campagne_visuels_formats;
drop policy if exists "support_photos_public_write_dev" on public.support_photos;
drop policy if exists "support_photos_storage_public_insert_dev" on storage.objects;

-- Lecture authentifiée et écritures selon rôle.
drop policy if exists "campagnes_maitres_authenticated_read_v075" on public.campagnes_maitres;
create policy "campagnes_maitres_authenticated_read_v075" on public.campagnes_maitres
for select to authenticated using (true);

drop policy if exists "campagnes_maitres_manager_write_v075" on public.campagnes_maitres;
create policy "campagnes_maitres_manager_write_v075" on public.campagnes_maitres
for all to authenticated
using (public.current_app_role() in ('Administrateur','Coordonnateur'))
with check (public.current_app_role() in ('Administrateur','Coordonnateur'));

drop policy if exists "relations_authenticated_read_v075" on public.relation_fields;
create policy "relations_authenticated_read_v075" on public.relation_fields
for select to authenticated using (true);

drop policy if exists "relations_admin_write_v075" on public.relation_fields;
create policy "relations_admin_write_v075" on public.relation_fields
for all to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

drop policy if exists "relation_rules_authenticated_read_v075" on public.relation_rules;
create policy "relation_rules_authenticated_read_v075" on public.relation_rules
for select to authenticated using (true);

drop policy if exists "relation_rules_admin_write_v075" on public.relation_rules;
create policy "relation_rules_admin_write_v075" on public.relation_rules
for all to authenticated
using (public.current_app_role() = 'Administrateur')
with check (public.current_app_role() = 'Administrateur');

drop policy if exists "visuals_authenticated_read_v075" on public.campagne_visuels_formats;
create policy "visuals_authenticated_read_v075" on public.campagne_visuels_formats
for select to authenticated using (true);

drop policy if exists "visuals_manager_write_v075" on public.campagne_visuels_formats;
create policy "visuals_manager_write_v075" on public.campagne_visuels_formats
for all to authenticated
using (public.current_app_role() in ('Administrateur','Coordonnateur'))
with check (public.current_app_role() in ('Administrateur','Coordonnateur'));

drop policy if exists "support_photos_authenticated_read_v075" on public.support_photos;
create policy "support_photos_authenticated_read_v075" on public.support_photos
for select to authenticated using (true);

drop policy if exists "support_photos_field_write_v075" on public.support_photos;
create policy "support_photos_field_write_v075" on public.support_photos
for insert to authenticated
with check (public.current_app_role() in ('Administrateur','Coordonnateur','Installateur'));

drop policy if exists "support_photos_storage_authenticated_insert_v075" on storage.objects;
create policy "support_photos_storage_authenticated_insert_v075" on storage.objects
for insert to authenticated
with check (bucket_id in ('support-photos','terrain-photos'));

-- Un compte inactif ne doit pas être considéré comme autorisé.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.utilisateurs
  where auth_user_id = auth.uid()
    and lower(coalesce(statut,'')) = 'actif'
  limit 1;
$$;
