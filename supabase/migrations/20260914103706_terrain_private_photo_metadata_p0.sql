BEGIN;
DO $migration$
DECLARE definition text;needle text;
BEGIN
  SELECT replace(pg_get_functiondef('public.finaliser_intervention_terrain_v01273(text,text,text,text,text,text,text,text,text)'::regprocedure),E'\r\n',E'\n') INTO definition;
  IF position('storage_bucket,client_id,support_id,type_photo' IN definition)>0 THEN RETURN;END IF;
  needle:=E'    support_id,type_photo,nom_fichier,storage_path';
  IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected intervention photo insert; audit required';END IF;
  definition:=replace(definition,needle,E'    storage_bucket,client_id,support_id,type_photo,nom_fichier,storage_path');
  needle:=E'    p_support_id,\n    case when v_action=';
  IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected intervention photo values; audit required';END IF;
  definition:=replace(definition,needle,E'    \'terrain-photos\',(select client_id from public.infrastructures where support_id=p_support_id),p_support_id,\n    case when v_action=');
  needle:='  perform 1 from public.infrastructures where support_id=p_support_id for update;';
  IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected intervention transaction; audit required';END IF;
  definition:=replace(definition,needle,$guard$
  if auth.uid() is null or p_storage_path is null
     or left(p_storage_path,length('supports/'||p_support_id||'/')) is distinct from 'supports/'||p_support_id||'/'
     or p_storage_path ~ '(^|/)[.][.]?(/|$)|//|[?#%]'
     or not exists(select 1 from storage.objects o where o.bucket_id='terrain-photos' and o.name=p_storage_path and o.owner_id=auth.uid()::text)
  then raise exception 'photo_scope_denied' using errcode='42501';end if;
  p_photo_url:='terrain-photos/'||p_storage_path;
  perform 1 from public.infrastructures where support_id=p_support_id for update;
$guard$);
  definition:=replace(definition,'''message'',sqlerrm)','''message'',sqlerrm,''code'',sqlstate)');
  EXECUTE definition;
END $migration$;

-- Repair only canonical references proven to resolve to an existing private
-- object and exactly one existing support. No photo/file/history is removed.
UPDATE public.support_photos p
SET client_id=i.client_id,storage_bucket='terrain-photos',source='terrain'
FROM public.infrastructures i
WHERE p.support_id=i.support_id AND i.client_id IS NOT NULL
  AND p.photo_url='terrain-photos/'||p.storage_path
  AND left(p.storage_path,length('supports/'||i.support_id||'/'))='supports/'||i.support_id||'/'
  AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='terrain-photos' AND o.name=p.storage_path)
  AND (p.client_id IS NULL OR p.client_id=i.client_id)
  AND (p.campagne_id IS NULL OR EXISTS(SELECT 1 FROM public.campagnes_maitres c WHERE c.id=p.campagne_id AND c.client_id=i.client_id))
  AND (p.client_id IS NULL OR p.storage_bucket IS DISTINCT FROM 'terrain-photos');
COMMIT;
