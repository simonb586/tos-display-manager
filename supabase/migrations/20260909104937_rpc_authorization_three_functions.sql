-- Targeted authorization correction. No data rewrite and no policy changes.
-- Existing signatures and business mutations preserved; invalid ownership fails closed.
CREATE OR REPLACE FUNCTION public.appliquer_campagne_support(p_support_id text, p_campagne_id bigint, p_utilisateur text DEFAULT NULL::text, p_photo_url text DEFAULT NULL::text, p_photo_path text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.campagnes_maitres%rowtype;
declare op uuid:=gen_random_uuid();
declare v_role text;
declare v_actor_client bigint;
declare v_client bigint;
begin

  if auth.uid() is null then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  begin
    select u.role, u.client_id into strict v_role, v_actor_client
    from public.utilisateurs u
    where u.auth_user_id=auth.uid() and lower(coalesce(u.statut,''))='actif'
    for share;
  exception when no_data_found or too_many_rows then
    raise exception 'unauthorized' using errcode='42501';
  end;
  if v_role is null or v_role not in ('Administrateur','Coordonnateur','Installateur') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  -- Internal staff may have global scope (explicitly approved).
  -- A populated profile client always restricts that scope.
  select * into c from public.campagnes_maitres where id=p_campagne_id and publiee_terrain=true for update;
  if not found then raise exception 'Campagne non publiée ou introuvable.'; end if;

  select client_id into v_client from public.infrastructures where support_id=p_support_id for update;
  if not found then raise exception 'resource_not_found' using errcode='P0002'; end if;

  if v_client is null or not exists(select 1 from public.clients where id=v_client)
     or (v_actor_client is not null and v_actor_client is distinct from v_client) then
    raise exception 'client_scope_denied' using errcode='42501';
  end if;

  if c.client_id is null or c.client_id is distinct from v_client then
    raise exception 'cross_client_denied' using errcode='42501';
  end if;
  perform 1 from public.campagnes_supports where campagne_id=c.id and support_id=p_support_id for update;
  if exists(select 1 from public.campagnes_supports where campagne_id=c.id and support_id=p_support_id
            and client_id is distinct from v_client) then
    raise exception 'cross_client_denied' using errcode='42501';
  end if;

  update public.infrastructures set
    campagne_actuelle=c.nom_campagne,
    campagne_selon_visuel=c.nom_campagne,
    visuel_campagne=c.visuel_generique,
    visuel_en_expo=coalesce(c.visuel_generique,visuel_en_expo),
    edt_associe=coalesce(c.no_edt,edt_associe),
    date_derniere_manipulation=now()::text,
    updated_at=now()
  where support_id=p_support_id;

  insert into public.campagnes_supports(campagne_id,support_id,statut,visuel_attendu,no_edt,photo_url,date_completion,utilisateur_completion,updated_at)
  values(c.id,p_support_id,'Terminée',c.visuel_generique,c.no_edt,p_photo_url,now(),p_utilisateur,now())
  on conflict(campagne_id,support_id) do update set statut='Terminée',visuel_attendu=excluded.visuel_attendu,no_edt=excluded.no_edt,photo_url=coalesce(excluded.photo_url,campagnes_supports.photo_url),date_completion=now(),utilisateur_completion=excluded.utilisateur_completion,updated_at=now();

  insert into public.historique_des_campagnes(support_id,campagne,visuel,no_edt,date_installation,photo_installation,utilisateur,raw_data)
  values(p_support_id,c.nom_campagne,c.visuel_generique,c.no_edt,now()::text,p_photo_url,p_utilisateur,jsonb_build_object('operation_id',op,'photo_path',p_photo_path));

  insert into public.journal_propagations(operation_id,campagne_id,support_id,declencheur,statut,details,utilisateur)
  values(op,c.id,p_support_id,'Campagne sélectionnée dans application terrain','Réussi',jsonb_build_object('infrastructure',true,'historique',true,'photo_url',p_photo_url),p_utilisateur);

  return jsonb_build_object('operation_id',op,'support_id',p_support_id,'campagne',c.nom_campagne,'visuel',c.visuel_generique,'no_edt',c.no_edt,'statut','Réussi');
end;
$function$
;
REVOKE EXECUTE ON FUNCTION public.appliquer_campagne_support(text,bigint,text,text,text) FROM PUBLIC, anon;
-- Preserve the existing authenticated and service_role grants; no new privilege.

CREATE OR REPLACE FUNCTION public.retirer_support_edt_v0129(p_edt_id bigint, p_support_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_no_edt text;
  v_bt_id bigint;
  v_role text;
  v_actor_client bigint;
  v_client bigint;
  v_edt_client bigint;
begin

  if auth.uid() is null then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  begin
    select u.role, u.client_id into strict v_role, v_actor_client
    from public.utilisateurs u
    where u.auth_user_id=auth.uid() and lower(coalesce(u.statut,''))='actif'
    for share;
  exception when no_data_found or too_many_rows then
    raise exception 'unauthorized' using errcode='42501';
  end;
  if v_role is null or v_role not in ('Administrateur','Coordonnateur') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  -- Internal staff may have global scope (explicitly approved).
  -- A populated profile client always restricts that scope.


  select no_edt, client_id into v_no_edt, v_edt_client from public.suivi_des_edt where id = p_edt_id for update;
  if not found then raise exception 'resource_not_found' using errcode='P0002'; end if;
  select client_id into v_client from public.infrastructures where support_id=p_support_id for update;
  if not found then raise exception 'resource_not_found' using errcode='P0002'; end if;

  if v_client is null or not exists(select 1 from public.clients where id=v_client)
     or (v_actor_client is not null and v_actor_client is distinct from v_client) then
    raise exception 'client_scope_denied' using errcode='42501';
  end if;

  if v_edt_client is null or v_edt_client is distinct from v_client then
    raise exception 'cross_client_denied' using errcode='42501';
  end if;
  select bon_de_travail_id into v_bt_id from public.edt_supports where edt_id=p_edt_id and support_id=p_support_id for update;
  if not found then raise exception 'resource_not_found' using errcode='P0002'; end if;
  if v_bt_id is not null then
    perform 1 from public.bons_de_travail where id=v_bt_id and edt_id=p_edt_id and support_id=p_support_id and client_id=v_client for update;
    if not found then raise exception 'cross_client_denied' using errcode='42501'; end if;
  end if;

  delete from public.edt_supports where edt_id=p_edt_id and support_id=p_support_id;
  if v_bt_id is not null then delete from public.bons_de_travail where id=v_bt_id and statut in ('À faire','Planifié','Annulée'); end if;

  update public.infrastructures
     set prochain_edt_cible = nullif(prochain_edt_cible, v_no_edt), updated_at=now()
   where support_id=p_support_id;

  perform public.refresh_edt_enterprise(p_edt_id);
  return jsonb_build_object('ok',true,'edt_id',p_edt_id,'support_id',p_support_id);
end;
$function$
;
REVOKE EXECUTE ON FUNCTION public.retirer_support_edt_v0129(bigint,text) FROM PUBLIC, anon;
-- Preserve the existing authenticated and service_role grants; no new privilege.

CREATE OR REPLACE FUNCTION public.supprimer_photo_support_v0129_lot3(p_photo_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_photo record;
  v_role text;
  v_actor_client bigint;
  v_client bigint;
  v_replacement record;
  v_id_type text;
begin

  if auth.uid() is null then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  begin
    select u.role, u.client_id into strict v_role, v_actor_client
    from public.utilisateurs u
    where u.auth_user_id=auth.uid() and lower(coalesce(u.statut,''))='actif'
    for share;
  exception when no_data_found or too_many_rows then
    raise exception 'unauthorized' using errcode='42501';
  end;
  if v_role is null or v_role not in ('Administrateur') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  -- Internal staff may have global scope (explicitly approved).
  -- A populated profile client always restricts that scope.


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
    raise exception 'resource_not_found' using errcode='P0002';
  end if;


  select client_id into v_client from public.infrastructures where support_id=v_photo.support_id for update;
  if not found then raise exception 'resource_not_found' using errcode='P0002'; end if;

  if v_client is null or not exists(select 1 from public.clients where id=v_client)
     or (v_actor_client is not null and v_actor_client is distinct from v_client) then
    raise exception 'client_scope_denied' using errcode='42501';
  end if;

  if v_photo.client_id is null or v_photo.client_id is distinct from v_client then
    raise exception 'cross_client_denied' using errcode='42501';
  end if;
  if v_photo.campagne_id is not null and not exists(
    select 1 from public.campagnes_maitres where id=v_photo.campagne_id and client_id=v_client
  ) then raise exception 'cross_client_denied' using errcode='42501'; end if;

  execute 'delete from public.support_photos where id::text = $1' using p_photo_id;

  execute $q$
    select * from public.support_photos
    where support_id::text = $1
    order by coalesce(prise_le, created_at, now()) desc
    limit 1
  $q$ into v_replacement using v_photo.support_id::text;


  if v_replacement.id is not null and v_replacement.client_id is distinct from v_client then
    raise exception 'cross_client_denied' using errcode='42501';
  end if;
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
$function$
;
REVOKE EXECUTE ON FUNCTION public.supprimer_photo_support_v0129_lot3(text) FROM PUBLIC, anon;
-- Preserve the existing authenticated and service_role grants; no new privilege.
