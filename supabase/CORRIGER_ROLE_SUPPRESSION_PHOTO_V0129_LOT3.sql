-- Correction ciblée : aligner l'autorisation de la RPC de suppression
-- sur la source de vérité officielle de l'application.
--
-- Ne modifie aucune politique RLS, aucun bucket et aucune donnée.

begin;

create or replace function public.supprimer_photo_support_v0129_lot3(p_photo_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_photo record;
  v_role text;
  v_replacement record;
  v_id_type text;
begin
  v_role := public.current_app_role();
  if v_role <> 'Administrateur' then
    raise exception 'Suppression réservée aux administrateurs.' using errcode='42501';
  end if;

  if to_regclass('public.support_photos') is null then
    raise exception 'La table support_photos est absente.';
  end if;

  select data_type into v_id_type
  from information_schema.columns
  where table_schema='public' and table_name='support_photos' and column_name='id';

  if v_id_type in ('uuid') then
    execute 'select * from public.support_photos where id = $1::uuid for update'
      into v_photo using p_photo_id;
  elsif v_id_type in ('bigint','integer','smallint','numeric') then
    execute 'select * from public.support_photos where id::text = $1 for update'
      into v_photo using p_photo_id;
  else
    execute 'select * from public.support_photos where id::text = $1 for update'
      into v_photo using p_photo_id;
  end if;

  if v_photo is null then
    raise exception 'Photo introuvable.';
  end if;

  execute 'delete from public.support_photos where id::text = $1' using p_photo_id;

  execute $q$
    select * from public.support_photos
    where support_id::text = $1
    order by coalesce(prise_le, created_at, now()) desc
    limit 1
  $q$ into v_replacement using v_photo.support_id::text;

  if to_regclass('public.infrastructures') is not null then
    begin
      execute $q$
        update public.infrastructures
        set photo_principale_url=$1,
            photo_miniature_url=$2
        where support_id::text=$3
      $q$ using
        case when v_replacement is null then null else v_replacement.photo_url end,
        case when v_replacement is null then null else coalesce(v_replacement.thumbnail_url,v_replacement.photo_url) end,
        v_photo.support_id::text;
    exception when undefined_column then
      null;
    end;
  end if;

  insert into public.photo_action_log(action,photo_id,support_id,nom_fichier,details,user_id)
  values ('SUPPRESSION',p_photo_id,v_photo.support_id::text,v_photo.nom_fichier,
    jsonb_build_object('storage_path',v_photo.storage_path,'replacement_id',
      case when v_replacement is null then null else v_replacement.id::text end),auth.uid());

  return jsonb_build_object(
    'ok',true,
    'photo_id',p_photo_id,
    'support_id',v_photo.support_id::text,
    'storage_path',v_photo.storage_path,
    'replacement_id',case when v_replacement is null then null else v_replacement.id::text end
  );
end;
$$;

commit;
