begin;

alter table public.campagne_visuels_formats
  add column if not exists is_out_of_frame boolean not null default false;

create or replace function public.delete_or_archive_master_campaign_v111(p_campaign_id bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.campagnes_maitres%rowtype; dependency_count bigint;
begin
  if public.current_app_role() not in ('Administrateur','Coordonnateur') then raise exception 'Permission insuffisante.'; end if;
  select * into c from public.campagnes_maitres where id=p_campaign_id for update;
  if not found then raise exception 'Campagne introuvable.'; end if;
  select
    (select count(*) from public.campagne_visuels_formats where campagne_id=c.id)+
    (select count(*) from public.support_photos where campagne_id=c.id)+
    (select count(*) from public.suivi_des_edt where campagne_id=c.id)+
    (select count(*) from public.historique_des_campagnes where campagne=c.nom_campagne)
  into dependency_count;
  if dependency_count>0 then
    update public.campagnes_maitres set statut='Archivée',publiee_terrain=false,updated_at=now() where id=c.id;
    return jsonb_build_object('action','archived','dependencies',dependency_count);
  end if;
  delete from public.campagnes_maitres where id=c.id;
  return jsonb_build_object('action','deleted','dependencies',0);
end$$;
revoke all on function public.delete_or_archive_master_campaign_v111(bigint) from public,anon;
grant execute on function public.delete_or_archive_master_campaign_v111(bigint) to authenticated;

create or replace function public.finaliser_installation_terrain_v01210(p_support_id text,p_visuel_id bigint,p_nom_fichier text,p_storage_path text,p_photo_url text,p_utilisateur text default null,p_commentaires text default null,p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_support_format text;v_visual_format text;v_out_of_frame boolean;v_visual_active boolean;v_campaign_published boolean;v_campaign_status text;
begin
 if public.current_app_role() not in ('Administrateur','Coordonnateur','Installateur') then raise exception 'Permission terrain requise.';end if;
 select coalesce(format_affichage,type_support) into v_support_format from public.infrastructures where support_id=p_support_id;if not found then raise exception 'Support % introuvable.',p_support_id;end if;
 select cv.format_support,cv.is_out_of_frame,cv.actif,c.publiee_terrain,c.statut into v_visual_format,v_out_of_frame,v_visual_active,v_campaign_published,v_campaign_status from public.campagne_visuels_formats cv join public.campagnes_maitres c on c.id=cv.campagne_id where cv.id=p_visuel_id;if not found then raise exception 'Visuel ou campagne introuvable.';end if;
 if v_visual_active is not true then raise exception 'Le visuel sélectionné est inactif.';end if;if v_campaign_published is not true then raise exception 'La campagne du visuel n''est pas publiée sur le terrain.';end if;if lower(coalesce(v_campaign_status,''))<>'active' then raise exception 'La campagne du visuel n''est pas active.';end if;
 if not v_out_of_frame then if nullif(public.tdm_normalize_display_format(v_support_format),'') is null then raise exception 'Le support ne possède aucun format exploitable.';end if;if public.tdm_normalize_display_format(v_support_format) is distinct from public.tdm_normalize_display_format(v_visual_format) then raise exception 'Format incompatible : support % / visuel %.',v_support_format,v_visual_format;end if;end if;
 return public.finaliser_installation_terrain_v01273(p_support_id,p_visuel_id,p_nom_fichier,p_storage_path,p_photo_url,p_utilisateur,p_commentaires,p_idempotency_key);
end$$;
grant execute on function public.finaliser_installation_terrain_v01210(text,bigint,text,text,text,text,text,text) to authenticated;

commit;
