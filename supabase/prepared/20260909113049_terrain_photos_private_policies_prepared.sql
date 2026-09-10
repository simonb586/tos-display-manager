-- PREPARED ONLY. Not applied. Does not close the bucket.
-- Apply in the coordinated cutover after validating the compatible frontend.
-- Restrictive policies fence off legacy permissive policies for this bucket only.
begin;
create or replace function public.terrain_photo_access_prepared(p_path text, p_action text, p_owner text default null, p_created timestamptz default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_role text; v_client bigint; v_support text; v_owner bigint;
begin
  if v_uid is null or p_action is null or p_action not in ('read','insert','delete')
     or p_path is null or p_path !~ '^[A-Za-z0-9_-]+/'
     or p_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]' then return false; end if;
  v_role:=public.tos_current_role();
  if v_role is null then return false; end if;
  select u.client_id into v_client from public.utilisateurs u where u.auth_user_id=v_uid and lower(u.statut)='actif';
  v_support:=case when split_part(p_path,'/',1)='supports' then split_part(p_path,'/',2) else split_part(p_path,'/',1) end;
  select i.client_id into v_owner from public.infrastructures i join public.clients c on c.id=i.client_id where i.support_id=v_support;
  if v_owner is null then return false; end if;
  if exists(select 1 from public.support_photos p
    where ((p.storage_bucket='terrain-photos' and p.storage_path=p_path)
      or p.photo_url='terrain-photos/'||p_path
      or split_part(p.photo_url,'/storage/v1/object/public/terrain-photos/',2)=p_path)
    and (p.client_id is distinct from v_owner or p.support_id is distinct from v_support
      or (p.campagne_id is not null and not exists(select 1 from public.campagnes_maitres c where c.id=p.campagne_id and c.client_id=v_owner)))) then return false; end if;
  if v_role in ('Administrateur','Coordonnateur','Installateur') then
    if v_client is not null and v_client<>v_owner then return false; end if;
    if p_action in ('read','insert') then return true; end if;
    if v_role='Administrateur' then return true; end if;
    -- Upload rollback only: internal uploader, no registered photo left.
    return p_owner=v_uid::text and p_created>now()-interval '10 minutes'
      and not exists(select 1 from public.inspections_terrain x where x.photo_path=p_path or x.photo_url='terrain-photos/'||p_path or split_part(x.photo_url,'/storage/v1/object/public/terrain-photos/',2)=p_path)
      and not exists(select 1 from public.infrastructures i where i.photo_principale_url='terrain-photos/'||p_path or i.photo_miniature_url='terrain-photos/'||p_path or split_part(i.photo_principale_url,'/storage/v1/object/public/terrain-photos/',2)=p_path or split_part(i.photo_miniature_url,'/storage/v1/object/public/terrain-photos/',2)=p_path)
      and not exists(select 1 from public.support_photos p
      where (p.storage_bucket='terrain-photos' and p.storage_path=p_path)
         or p.photo_url='terrain-photos/'||p_path
         or split_part(p.photo_url,'/storage/v1/object/public/terrain-photos/',2)=p_path);
  end if;
  if p_action<>'read' or v_role not in ('Client','Client-Admin') or v_client is null or v_client<>v_owner then return false; end if;
  return exists(select 1 from public.support_photos p
    left join public.campagnes_maitres c on c.id=p.campagne_id and c.client_id=p.client_id
    where p.support_id=v_support and p.client_id=v_owner and p.client_visible and p.deleted_at is null
      and ((p.storage_bucket='terrain-photos' and p.storage_path=p_path)
        or p.photo_url='terrain-photos/'||p_path
        or split_part(p.photo_url,'/storage/v1/object/public/terrain-photos/',2)=p_path)
      and (p.campagne_id is null or (c.client_published and (v_role='Client-Admin' or exists(select 1 from public.client_campaign_access a where a.client_id=v_client and a.campaign_id=c.id
        and (a.user_id is null or a.user_id=v_uid))))));
end $$;
revoke all on function public.terrain_photo_access_prepared(text,text,text,timestamptz) from public,anon;
grant execute on function public.terrain_photo_access_prepared(text,text,text,timestamptz) to authenticated;

create policy terrain_private_anon_fence on storage.objects as restrictive for all to anon
  using (bucket_id<>'terrain-photos') with check (bucket_id<>'terrain-photos');
create policy terrain_private_read_fence on storage.objects as restrictive for select to authenticated
  using (bucket_id<>'terrain-photos' or public.terrain_photo_access_prepared(name,'read',owner_id));
create policy terrain_private_insert_fence on storage.objects as restrictive for insert to authenticated
  with check (bucket_id<>'terrain-photos' or (owner_id=auth.uid()::text and public.terrain_photo_access_prepared(name,'insert',owner_id)));
create policy terrain_private_delete_fence on storage.objects as restrictive for delete to authenticated
  using (bucket_id<>'terrain-photos' or public.terrain_photo_access_prepared(name,'delete',owner_id,created_at));
-- No Terrain overwrite/move consumer: upsert is false. Both old and new rows denied.
create policy terrain_private_update_fence on storage.objects as restrictive for update to authenticated
  using (bucket_id<>'terrain-photos') with check (bucket_id<>'terrain-photos');
create policy terrain_private_read on storage.objects for select to authenticated
  using (bucket_id='terrain-photos' and public.terrain_photo_access_prepared(name,'read',owner_id));
create policy terrain_private_insert on storage.objects for insert to authenticated
  with check (bucket_id='terrain-photos' and owner_id=auth.uid()::text and public.terrain_photo_access_prepared(name,'insert',owner_id));
create policy terrain_private_delete on storage.objects for delete to authenticated
  using (bucket_id='terrain-photos' and public.terrain_photo_access_prepared(name,'delete',owner_id,created_at));
commit;
