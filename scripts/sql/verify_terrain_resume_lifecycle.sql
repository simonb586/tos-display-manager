DO $test$ DECLARE t jsonb:='{"role":"Installateur","global":false,"deny":false}';a jsonb;b jsonb;n bigint;BEGIN BEGIN
insert into auth.users(id,email) values('91000000-0000-4000-8000-000000091899','security-actor@example.invalid'),('91000000-0000-4000-8000-000000091802','security-member@example.invalid'),('91000000-0000-4000-8000-000000091898','security-setup@example.invalid');
insert into public.clients(id,nom_client,statut) values(-91801,'SEC EXT A','Actif'),(-91802,'SEC EXT B','Actif');
insert into public.utilisateurs(id,auth_user_id,nom,courriel,role,statut,client_id) values
(-91899,'91000000-0000-4000-8000-000000091899','SEC Actor','security-actor@example.invalid',t->>'role','Actif',case when (t->>'global')::boolean then null when (t->>'deny')::boolean then -91802 else -91801 end),
(-91802,'91000000-0000-4000-8000-000000091802','SEC Member','security-member@example.invalid','Client','Actif',-91801),
(-91898,'91000000-0000-4000-8000-000000091898','SEC Setup','security-setup@example.invalid','Administrateur','Actif',null);
perform set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000091898',true);
insert into public.campagnes_maitres(id,nom_campagne,client_id,client_published,publiee_terrain,statut,business_context,date_debut,date_fin) values(-91801,'SEC Campaign A',-91801,true,true,'Active','marketing','2026-01-01','2026-12-31'),(-91802,'SEC Campaign B',-91802,true,true,'Active','marketing','2026-01-01','2026-12-31');
insert into public.infrastructures(id,support_id,client_id,format_affichage,type_support) values(-91801,'SEC-EXT-A',-91801,'13x19','Cadre'),(-91802,'SEC-EXT-B',-91802,'13x19','Cadre');
insert into public.suivi_des_edt(id,no_edt,client_id,campagne_id,statut,progression) values(-91801,'SEC-EDT-A',-91801,-91801,'En cours',40),(-91802,'SEC-EDT-B',-91802,-91802,'En cours',40);
insert into public.edt_phases(id,edt_id,client_id,phase_type,nom,statut,progression,date_debut_prevue) values(-91801,-91801,-91801,'installation','SEC Phase A','en_cours',40,'2026-09-01'),(-91802,-91802,-91802,'installation','SEC Phase B','en_cours',40,'2026-09-01');
insert into public.edt_supports(id,edt_id,phase_id,support_id,statut,progression,bloque) values(-91801,-91801,-91801,'SEC-EXT-A','En cours',40,false),(-91802,-91802,-91802,'SEC-EXT-B','En cours',40,false);
insert into public.campagne_visuels_formats(id,campagne_id,client_id,edt_phase_id,nom_visuel,format_support,actif,is_out_of_frame) values(-91801,-91801,-91801,-91801,'SEC Visual A','13x19',true,false),(-91802,-91802,-91802,-91802,'SEC Visual B','13x19',true,false);
insert into public.support_photos(id,nom_fichier,original_filename,storage_path,review_status,assignment_pending,source) values(-91801,'security.jpg','security.jpg','SEC-IMPORT/security.jpg','needs_review',false,'mass_import');
insert into public.reports(id,report_type,title,client_id,campaign_id,support_id,status,version,template_key) values('91000000-0000-4000-8000-000000091801','campaign','SEC Report A',-91801,-91801,'SEC-EXT-A','draft',1,'campaign');
insert into public.edt_reports(id,edt_id,report_version,status,title,support_count,requester_contact_id) values('91000000-0000-4000-8000-000000091801',-91801,1,'draft','SEC EDT Report',1,-91802);
insert into public.edt_phase_reports(id,edt_id,phase_id,phase_type,version,status,client_visible,archived) values(-91801,-91801,-91801,'installation',1,'brouillon',false,false);
insert into public.terrain_sync_diagnostics(id,support_id,campagne_id,edt_id,statut,reference,etape) values('91000000-0000-4000-8000-000000091801','SEC-EXT-A',-91801,-91801,'error','SEC-EXT','validation');

update public.infrastructures set campagne_actuelle='Ancienne campagne',visuel_campagne='Ancien visuel',edt_associe='Ancien EDT' where support_id='SEC-EXT-A';
perform set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000091899',true);
SET LOCAL ROLE authenticated;
a:=public.finaliser_installation_terrain_v1331('SEC-EXT-A',-91801,-91801,'install.png','SEC-EXT-A/install.png','terrain-photos/SEC-EXT-A/install.png',null,'Test','SEC-RESUME-INSTALL');IF (a->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'installation failed %',a;END IF;
b:=public.finaliser_installation_terrain_v1331('SEC-EXT-A',-91801,-91801,'install.png','SEC-EXT-A/install.png','terrain-photos/SEC-EXT-A/install.png',null,'Test','SEC-RESUME-INSTALL');IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'installation retry differs % %',a,b;END IF;
RESET ROLE;
IF (SELECT count(*) FROM public.historique_des_campagnes WHERE support_id='SEC-EXT-A' AND raw_data->>'reference'='SEC-RESUME-INSTALL')<>1 THEN RAISE EXCEPTION 'duplicate installation history';END IF;
IF NOT EXISTS(SELECT 1 FROM public.infrastructures WHERE support_id='SEC-EXT-A' AND campagne_precedente='Ancienne campagne' AND visuel_precedent='Ancien visuel') THEN RAISE EXCEPTION 'previous visual lost';END IF;
IF NOT EXISTS(SELECT 1 FROM public.edt_supports WHERE id=-91801 AND statut='Terminé' AND progression=100) THEN RAISE EXCEPTION 'assignment not complete';END IF;
SET LOCAL ROLE authenticated;
a:=public.finaliser_intervention_terrain_v1342('SEC-EXT-A',-91801,'enjeu','Autre','Test enjeu','issue.png','SEC-EXT-A/issue.png','terrain-photos/SEC-EXT-A/issue.png',null,'SEC-RESUME-ISSUE');IF (a->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'issue failed %',a;END IF;
b:=public.finaliser_intervention_terrain_v1342('SEC-EXT-A',-91801,'enjeu','Autre','Test enjeu','issue.png','SEC-EXT-A/issue.png','terrain-photos/SEC-EXT-A/issue.png',null,'SEC-RESUME-ISSUE');IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'issue retry differs % %',a,b;END IF;
RESET ROLE;
IF (SELECT count(*) FROM public.enjeux_terrain WHERE reference='SEC-RESUME-ISSUE' AND edt_phase_id=-91801 AND photo_id=(a->>'photo_id')::bigint)<>1 THEN RAISE EXCEPTION 'issue linkage lost';END IF;
IF (SELECT count(*) FROM public.inspections_terrain WHERE support_id='SEC-EXT-A' AND photo_path='SEC-EXT-A/issue.png')<>1 THEN RAISE EXCEPTION 'duplicate issue history';END IF;
IF NOT EXISTS(SELECT 1 FROM public.edt_supports WHERE id=-91802 AND phase_id=-91802) THEN RAISE EXCEPTION 'unrelated relation lost';END IF;
RAISE EXCEPTION SQLSTATE 'Z0001' USING MESSAGE='rollback';EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;END;
END $test$;SELECT '10 Terrain lifecycle and retry checks PASS; fixtures rolled back' AS result;