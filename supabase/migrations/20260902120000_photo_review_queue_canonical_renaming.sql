begin;
alter table public.support_photos alter column support_id drop not null;
alter table public.support_photos add column if not exists review_status text;
alter table public.support_photos add column if not exists ocr_text text;
alter table public.support_photos add column if not exists ocr_confidence numeric(5,2);
alter table public.support_photos add column if not exists ocr_suggestions jsonb not null default '[]'::jsonb;
alter table public.support_photos add column if not exists proposed_support_id text;
alter table public.support_photos add column if not exists import_batch_id text;
alter table public.support_photos add column if not exists assignment_pending boolean not null default false;
alter table public.support_photos add column if not exists target_storage_path text;
alter table public.support_photos add column if not exists target_filename text;
alter table public.support_photos add column if not exists target_support_id text;
alter table public.support_photos add column if not exists target_client_id bigint references public.clients(id) on delete restrict;
alter table public.support_photos drop constraint if exists support_photos_review_status_check;
alter table public.support_photos add constraint support_photos_review_status_check check(review_status is null or review_status in('auto_matched','needs_review','unmatched','manually_validated','ignored','error'));
alter table public.support_photos drop constraint if exists support_photos_ocr_confidence_check;
alter table public.support_photos add constraint support_photos_ocr_confidence_check check(ocr_confidence is null or ocr_confidence between 0 and 100);
create unique index if not exists support_photos_target_storage_path_uidx on public.support_photos(target_storage_path) where target_storage_path is not null;
create index if not exists support_photos_review_queue_idx on public.support_photos(review_status,uploaded_at desc);
create index if not exists support_photos_review_batch_idx on public.support_photos(import_batch_id,review_status);

create table if not exists public.photo_review_audit(
 id bigserial primary key,photo_id bigint not null references public.support_photos(id) on delete restrict,actor_id uuid not null,
 action text not null,original_filename text,ocr_text text,ocr_confidence numeric(5,2),proposed_support_id text,
 previous_support_id text,final_support_id text,old_filename text,new_filename text,old_storage_path text,new_storage_path text,
 client_id bigint references public.clients(id) on delete restrict,created_at timestamptz not null default now()
);
alter table public.photo_review_audit enable row level security;
revoke all on public.photo_review_audit from anon;
grant select on public.photo_review_audit to authenticated;
drop policy if exists photo_review_audit_internal_read on public.photo_review_audit;
create policy photo_review_audit_internal_read on public.photo_review_audit for select to authenticated using(public.current_app_role() in('Administrateur','Coordonnateur'));

drop policy if exists photo_review_internal_select on public.support_photos;
create policy photo_review_internal_select on public.support_photos for select to authenticated using(review_status is not null and public.current_app_role() in('Administrateur','Coordonnateur'));
drop policy if exists photo_review_internal_insert on public.support_photos;
create policy photo_review_internal_insert on public.support_photos for insert to authenticated with check(source='mass_import' and review_status in('needs_review','unmatched') and public.current_app_role() in('Administrateur','Coordonnateur'));
drop policy if exists support_photos_storage_internal_move on storage.objects;
create policy support_photos_storage_internal_move on storage.objects for update to authenticated
using(bucket_id='support-photos' and public.current_app_role() in('Administrateur','Coordonnateur'))
with check(bucket_id='support-photos' and public.current_app_role() in('Administrateur','Coordonnateur'));

create or replace function public.prepare_photo_review_assignment(p_photo_id bigint,p_support_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.support_photos%rowtype;i public.infrastructures%rowtype;seq integer;ext text;ymd text;name text;path text;actor uuid:=auth.uid();
begin
 if actor is null or public.current_app_role() not in('Administrateur','Coordonnateur') then raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';end if;
 select * into p from public.support_photos where id=p_photo_id for update;if not found then raise exception 'PHOTO_NOT_FOUND';end if;
 if p.review_status not in('needs_review','unmatched','manually_validated') or p.assignment_pending then raise exception 'PHOTO_NOT_REVIEWABLE';end if;
 select * into i from public.infrastructures where support_id=trim(p_support_id);if not found or i.client_id is null then raise exception 'SUPPORT_NOT_FOUND_OR_UNOWNED';end if;
 ymd:=to_char(coalesce(p.captured_at,p.prise_le,p.uploaded_at,p.created_at,now()) at time zone 'America/Toronto','YYYYMMDD');
 ext:=lower(coalesce(nullif(substring(coalesce(p.original_filename,p.nom_fichier) from '\.([A-Za-z0-9]{2,5})$'),''),'jpg'));if ext='jpeg'then ext:='jpg';end if;
 perform pg_advisory_xact_lock(hashtextextended(i.support_id||ymd,0));
 select coalesce(max((regexp_match(coalesce(normalized_filename,nom_fichier),'-([0-9]{3})\.[A-Za-z0-9]+$'))[1]::integer),0)+1 into seq from public.support_photos where support_id=i.support_id and coalesce(captured_at,prise_le)::date=coalesce(p.captured_at,p.prise_le,now())::date;
 name:=regexp_replace(upper(i.support_id),'[^A-Z0-9_-]+','-','g')||'-'||ymd||'-INSPECTION-NONE-NONE-'||lpad(seq::text,3,'0')||'.'||ext;
 path:='supports/'||regexp_replace(upper(i.support_id),'[^A-Z0-9_-]+','-','g')||'/'||left(ymd,4)||'/NONE/INSPECTION/'||name;
 update public.support_photos set assignment_pending=true,target_storage_path=path,target_filename=name,target_support_id=i.support_id,target_client_id=i.client_id where id=p.id;
 return jsonb_build_object('photo_id',p.id,'storage_path',path,'filename',name,'support_id',i.support_id);
end$$;

create or replace function public.finalize_photo_review_assignment(p_photo_id bigint,p_expected_path text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.support_photos%rowtype;actor uuid:=auth.uid();
begin
 if actor is null or public.current_app_role() not in('Administrateur','Coordonnateur') then raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';end if;
 select * into p from public.support_photos where id=p_photo_id for update;if not found or not p.assignment_pending or p.target_storage_path is distinct from p_expected_path then raise exception 'PHOTO_ASSIGNMENT_STATE_MISMATCH';end if;
 insert into public.photo_review_audit(photo_id,actor_id,action,original_filename,ocr_text,ocr_confidence,proposed_support_id,previous_support_id,final_support_id,old_filename,new_filename,old_storage_path,new_storage_path,client_id)values(p.id,actor,case when p.review_status='manually_validated'then'corrected'else'manually_validated'end,p.original_filename,p.ocr_text,p.ocr_confidence,p.proposed_support_id,p.support_id,p.target_support_id,p.nom_fichier,p.target_filename,p.storage_path,p.target_storage_path,p.target_client_id);
 update public.support_photos set support_id=target_support_id,client_id=target_client_id,storage_path=target_storage_path,normalized_filename=target_filename,nom_fichier=target_filename,review_status='manually_validated',statut_validation='Validée manuellement',validee_le=now(),uploaded_by=coalesce(uploaded_by,actor::text),assignment_pending=false,target_storage_path=null,target_filename=null,target_support_id=null,target_client_id=null where id=p.id;
 return jsonb_build_object('ok',true,'photo_id',p.id,'old_filename',p.nom_fichier,'new_filename',p.target_filename,'support_id',p.target_support_id);
end$$;

create or replace function public.cancel_photo_review_assignment(p_photo_id bigint) returns void language plpgsql security definer set search_path='' as $$begin if auth.uid() is null or public.current_app_role() not in('Administrateur','Coordonnateur')then raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';end if;update public.support_photos set assignment_pending=false,target_storage_path=null,target_filename=null,target_support_id=null,target_client_id=null where id=p_photo_id;end$$;
create or replace function public.ignore_photo_review_item(p_photo_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$declare p public.support_photos%rowtype;actor uuid:=auth.uid();begin if actor is null or public.current_app_role() not in('Administrateur','Coordonnateur')then raise exception 'PHOTO_REVIEW_FORBIDDEN' using errcode='42501';end if;select*into p from public.support_photos where id=p_photo_id for update;if not found or p.review_status not in('needs_review','unmatched')then raise exception 'PHOTO_NOT_REVIEWABLE';end if;update public.support_photos set review_status='ignored',statut_validation='Ignorée',validee_le=now()where id=p.id;insert into public.photo_review_audit(photo_id,actor_id,action,original_filename,ocr_text,ocr_confidence,proposed_support_id,previous_support_id,old_filename,old_storage_path,client_id)values(p.id,actor,'ignored',p.original_filename,p.ocr_text,p.ocr_confidence,p.proposed_support_id,p.support_id,p.nom_fichier,p.storage_path,p.client_id);return jsonb_build_object('ok',true,'photo_id',p.id);end$$;

revoke all on function public.prepare_photo_review_assignment(bigint,text),public.finalize_photo_review_assignment(bigint,text),public.cancel_photo_review_assignment(bigint),public.ignore_photo_review_item(bigint) from public,anon;
grant execute on function public.prepare_photo_review_assignment(bigint,text),public.finalize_photo_review_assignment(bigint,text),public.cancel_photo_review_assignment(bigint),public.ignore_photo_review_item(bigint) to authenticated;
commit;
