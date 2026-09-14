BEGIN;
-- Extend the existing atomic intervention writer. The public v1342 wrapper
-- retains its canonical role, tenant, support and optional context guards.
DO $migration$
DECLARE definition text;needle text;
BEGIN
 SELECT replace(pg_get_functiondef('public.finaliser_intervention_terrain_v01273(text,text,text,text,text,text,text,text,text)'::regprocedure),E'\r\n',E'\n') INTO definition;
 IF position('storage_bucket,client_id,support_id,type_photo' IN definition)=0
    OR position('photo_scope_denied' IN definition)=0
    OR position('terrain_idempotency_conflict' IN definition)=0 THEN
   RAISE EXCEPTION 'audited_private_intervention_writer_required';
 END IF;
 needle:='v_action not in (''inspection'',''enjeu'',''photo'')';
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'unexpected_terrain_action_guard';END IF;
 definition:=replace(definition,needle,'v_action not in (''inspection'',''enjeu'',''photo'',''retrait'')');
 definition:=replace(definition,'v_photo public.support_photos%rowtype;','v_photo public.support_photos%rowtype;v_infra public.infrastructures%rowtype;');
 definition:=replace(definition,'perform 1 from public.infrastructures where support_id=p_support_id for update;','select * into v_infra from public.infrastructures where support_id=p_support_id for update;');
 definition:=replace(definition,'when v_action=''enjeu'' then ''Enjeu'' else ''Photo'' end','when v_action=''enjeu'' then ''Enjeu'' when v_action=''retrait'' then ''Retrait'' else ''Photo'' end');
 definition:=replace(definition,'case when v_action=''inspection'' then ''Validée'' else ''À valider'' end','case when v_action in (''inspection'',''retrait'') then ''Validée'' else ''À valider'' end');
 needle:='  if v_action=''enjeu'' then';
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'unexpected_intervention_write_order';END IF;
 definition:=replace(definition,needle,$removal$
  if v_action='retrait' then
    -- Keep every photo/file in the support gallery. Only clear current flags.
    update public.support_photos set is_current_visual=false,est_principale=false
      where support_id=p_support_id and (is_current_visual or est_principale);
    update public.infrastructures set
      campagne_precedente=coalesce(campagne_actuelle,campagne_precedente),
      visuel_precedent=coalesce(visuel_campagne,visuel_precedent),
      edt_precedent_associe=coalesce(edt_associe,edt_precedent_associe),
      campagne_actuelle=null,campagne_selon_visuel=null,visuel_campagne=null,
      visuel_en_expo=null,visuel_actuel_cadre=null,visuel_id=null,
      phase_campagne=null,format_visuel=null,edt_associe=null,
      photo_principale_url=null,photo_miniature_url=null,date_visuel_actuel=null,
      date_derniere_manipulation=now()::text,updated_at=now()
    where support_id=p_support_id;
    insert into public.historique_des_campagnes(
      support_id,client_id,campagne,visuel,no_edt,date_retrait,photo_installation,utilisateur,raw_data)
    values(p_support_id,v_infra.client_id,v_infra.campagne_actuelle,v_infra.visuel_campagne,
      v_infra.edt_associe,now()::text,v_infra.photo_principale_url,p_utilisateur,
      jsonb_build_object('reference',v_ref,'source','terrain_retrait','photo_id',v_photo.id,
        'photo_retrait',p_photo_url,'previous_visual_id',v_infra.visuel_id));
  end if;
  if v_action='enjeu' then
$removal$);
 EXECUTE definition;
END $migration$;
COMMIT;
