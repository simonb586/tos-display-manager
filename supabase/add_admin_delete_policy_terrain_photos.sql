-- Politique ciblée de suppression Storage pour les photos terrain.
-- Nouvelle migration idempotente : ne modifie aucune autre politique.

begin;

drop policy if exists "Administrateurs suppriment terrain-photos"
on storage.objects;

create policy "Administrateurs suppriment terrain-photos"
on storage.objects
for delete
to authenticated
using (
  auth.uid() is not null
  and bucket_id = 'terrain-photos'
  and public.current_app_role() = 'Administrateur'
);

commit;
