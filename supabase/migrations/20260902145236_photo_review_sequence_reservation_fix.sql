begin;

-- La réservation reste sérialisée par famille canonique complète. Les noms déjà
-- finalisés et ceux réservés par une validation en cours participent au max.
create or replace function public.prepare_photo_review_assignment(p_photo_id bigint,p_support_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 p public.support_photos%rowtype;
 i public.infrastructures%rowtype;
 seq integer;
 ext text;
 ymd text;
 canonical_support text;
 canonical_prefix text;
 family_key text;
 name text;
 path text;
 actor uuid:=auth.uid();
 actor_role text;
 actor_client bigint;
begin
 select u.role,u.client_id into actor_role,actor_client
 from public.utilisateurs u
 where u.auth_user_id=actor and u.statut='Actif'
 limit 1;
 if actor is null or actor_role not in('Administrateur','Coordonnateur') then
  raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';
 end if;

 select * into p from public.support_photos where id=p_photo_id for update;
 if not found then raise exception 'PHOTO_NOT_FOUND';end if;
 if p.review_status not in('needs_review','unmatched','manually_validated') or p.assignment_pending then
  raise exception 'PHOTO_NOT_REVIEWABLE';
 end if;

 select * into i from public.infrastructures where support_id=trim(p_support_id);
 if not found or i.client_id is null then raise exception 'SUPPORT_NOT_FOUND_OR_UNOWNED';end if;
 if actor_role='Coordonnateur' and actor_client is not null and (i.client_id<>actor_client or (p.client_id is not null and p.client_id<>actor_client)) then
  raise exception 'SUPPORT_SCOPE_DENIED' using errcode='42501';
 end if;

 ymd:=to_char(coalesce(p.captured_at,p.prise_le,p.uploaded_at,p.created_at,now()) at time zone 'America/Toronto','YYYYMMDD');
 ext:=lower(coalesce(nullif(substring(coalesce(p.original_filename,p.nom_fichier) from '\.([A-Za-z0-9]{2,5})$'),''),'jpg'));
 if ext='jpeg'then ext:='jpg';end if;
 canonical_support:=regexp_replace(upper(i.support_id),'[^A-Z0-9_-]+','-','g');
 canonical_prefix:=canonical_support||'-'||ymd||'-INSPECTION-NONE-NONE';
 family_key:=canonical_support||'|'||ymd||'|INSPECTION|NONE|NONE';

 perform pg_advisory_xact_lock(hashtextextended(family_key,0));
 select coalesce(max(substring(candidate_filename from '-([0-9]+)\.[A-Za-z0-9]+$')::integer),0)+1
 into seq
 from (
  select coalesce(s.normalized_filename,s.nom_fichier) candidate_filename
  from public.support_photos s
  where s.support_id=i.support_id
    and coalesce(s.captured_at,s.prise_le)::date=coalesce(p.captured_at,p.prise_le,now())::date
  union all
  select s.target_filename
  from public.support_photos s
  where s.assignment_pending and s.target_support_id=i.support_id
    and coalesce(s.captured_at,s.prise_le)::date=coalesce(p.captured_at,p.prise_le,now())::date
 ) reserved
 where candidate_filename like canonical_prefix||'-%';

 name:=canonical_prefix||'-'||lpad(seq::text,3,'0')||'.'||ext;
 path:='supports/'||canonical_support||'/'||left(ymd,4)||'/NONE/INSPECTION/'||name;
 update public.support_photos
 set assignment_pending=true,target_storage_path=path,target_filename=name,target_support_id=i.support_id,target_client_id=i.client_id
 where id=p.id;
 return jsonb_build_object('photo_id',p.id,'storage_path',path,'filename',name,'support_id',i.support_id);
end$$;

revoke all on function public.prepare_photo_review_assignment(bigint,text) from public,anon;
grant execute on function public.prepare_photo_review_assignment(bigint,text) to authenticated;

commit;
