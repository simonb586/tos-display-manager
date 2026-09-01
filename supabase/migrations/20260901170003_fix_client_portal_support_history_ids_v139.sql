begin;
create or replace function public.client_portal_support_context_v139(p_section text,p_support_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_client bigint;v_support text:=btrim(p_support_id);v_rows jsonb:='[]';
begin
 if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select client_id into v_client from public.utilisateurs where auth_user_id=v_uid and statut='Actif' and role in('Client','Client-Admin');
 if v_client is null then raise exception 'CLIENT_SCOPE_MISSING' using errcode='42501';end if;
 if not exists(select 1 from public.infrastructures where support_id=v_support and client_id=v_client) then raise exception 'SUPPORT_SCOPE_DENIED' using errcode='42501';end if;
 if p_section='photos' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select p.id,p.support_id,p.type_photo,p.nom_fichier,p.storage_bucket,p.storage_path,p.thumbnail_url,p.prise_le,p.statut_validation from public.support_photos p where p.support_id=v_support and p.client_id=v_client and p.client_visible and p.deleted_at is null order by p.prise_le desc nulls last,p.id desc)q;
 elsif p_section='edt' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select distinct e.id,e.no_edt,e.statut,e.date_debut_prevue,e.date_fin_prevue,e.campagne_id from public.suivi_des_edt e join public.edt_supports es on es.edt_id=e.id join public.campagnes_maitres c on c.id=e.campagne_id where es.support_id=v_support and c.client_id=v_client and c.client_published and e.client_visible order by e.date_fin_prevue desc nulls last,e.id desc)q;
 elsif p_section='history' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into v_rows from(select a.id,a.occurred_at,a.action,a.module,a.entity_type,a.entity_id,a.campaign_id,a.edt_id,a.support_id,a.status from public.activity_events a where a.client_id=v_client::text and a.client_visible and(a.support_id=v_support or exists(select 1 from public.edt_supports es where es.edt_id::text=a.edt_id and es.support_id=v_support))order by a.occurred_at desc,a.id desc)q;
 else raise exception 'INVALID_SUPPORT_SECTION';end if;
 return jsonb_build_object('section',p_section,'page',1,'page_size',jsonb_array_length(v_rows),'total',jsonb_array_length(v_rows),'rows',v_rows,'support_id',v_support);
end$$;
revoke all on function public.client_portal_support_context_v139(text,text) from public,anon;
grant execute on function public.client_portal_support_context_v139(text,text) to authenticated;
commit;
