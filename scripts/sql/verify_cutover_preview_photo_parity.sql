BEGIN;
INSERT INTO public.clients(id,nom_client) VALUES(-92201,'CUTOVER-A'),(-92202,'CUTOVER-B');
INSERT INTO auth.users(id,email) VALUES('91000000-0000-4000-8000-000000092201','preview-admin@example.invalid'),('91000000-0000-4000-8000-000000092202','preview-ca@example.invalid'),('91000000-0000-4000-8000-000000092203','preview-c@example.invalid'),('91000000-0000-4000-8000-000000092204','preview-b@example.invalid');
INSERT INTO public.utilisateurs(id,auth_user_id,nom,courriel,role,statut,client_id) VALUES
(-92201,'91000000-0000-4000-8000-000000092201','Test','preview-admin@example.invalid','Administrateur','Actif',NULL),
(-92202,'91000000-0000-4000-8000-000000092202','Test','preview-ca@example.invalid','Client-Admin','Actif',-92201),
(-92203,'91000000-0000-4000-8000-000000092203','Test','preview-c@example.invalid','Client','Actif',-92201),
(-92204,'91000000-0000-4000-8000-000000092204','Test','preview-b@example.invalid','Client-Admin','Actif',-92202);
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000092201',true);
UPDATE public.role_ui_permissions SET visible_tables=ARRAY['Photos'] WHERE role IN ('Client','Client-Admin');
INSERT INTO public.role_ui_permissions(role,visible_tables) SELECT r,ARRAY['Photos'] FROM unnest(ARRAY['Client','Client-Admin']) r WHERE NOT EXISTS(SELECT 1 FROM public.role_ui_permissions p WHERE p.role=r);
INSERT INTO public.infrastructures(support_id,client_id) VALUES('CUTOVER-PREVIEW-A',-92201),('CUTOVER-PREVIEW-B',-92202);
INSERT INTO public.campagnes_maitres(id,nom_campagne,client_id,client_published) VALUES(-92201,'CUTOVER-PUBLISHED',-92201,true),(-92202,'CUTOVER-PRIVATE',-92201,false);
INSERT INTO public.support_photos(id,support_id,client_id,campagne_id,client_visible,deleted_at,nom_fichier,storage_bucket,storage_path) VALUES
(-92201,'CUTOVER-PREVIEW-A',-92201,NULL,true,NULL,'test.jpg','terrain-photos','CUTOVER-PREVIEW-A/1.jpg'),
(-92202,'CUTOVER-PREVIEW-B',-92202,NULL,true,NULL,'test.jpg','terrain-photos','CUTOVER-PREVIEW-B/2.jpg'),
(-92203,'CUTOVER-PREVIEW-A',-92201,NULL,false,NULL,'test.jpg','terrain-photos','CUTOVER-PREVIEW-A/3.jpg'),
(-92204,'CUTOVER-PREVIEW-A',-92201,NULL,true,now(),'test.jpg','terrain-photos','CUTOVER-PREVIEW-A/4.jpg'),
(-92205,'CUTOVER-PREVIEW-A',-92201,-92201,true,NULL,'test.jpg','terrain-photos','CUTOVER-PREVIEW-A/5.jpg'),
(-92206,'CUTOVER-PREVIEW-A',-92201,-92202,true,NULL,'test.jpg','terrain-photos','CUTOVER-PREVIEW-A/6.jpg'),
(-92207,'CUTOVER-PREVIEW-B',-92201,NULL,true,NULL,'test.jpg','terrain-photos','CUTOVER-PREVIEW-B/7.jpg');
SELECT set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000092201',true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE r jsonb; ids bigint[];
BEGIN
 r:=public.admin_preview_client_portal_context_v1362(-92202);
 SELECT array_agg((x->>'id')::bigint ORDER BY (x->>'id')::bigint) INTO ids FROM jsonb_array_elements(r#>'{sections,photos,rows}') x;
 IF ids IS DISTINCT FROM ARRAY[-92205,-92201]::bigint[] THEN RAISE EXCEPTION 'Client-Admin photo scope mismatch: %',ids;END IF;
 IF r->>'auth_uid_changed'<>'false' OR auth.uid()<>'91000000-0000-4000-8000-000000092201'::uuid THEN RAISE EXCEPTION 'Preview changed identity';END IF;
 r:=public.admin_preview_client_portal_context_v1362(-92203);
 IF (r#>>'{sections,photos,total}')::int<>1 OR (r#>>'{sections,photos,rows,0,id}')::bigint<>-92201 THEN RAISE EXCEPTION 'Client without grant scope mismatch';END IF;
 r:=public.admin_preview_client_portal_context_v1362(-92204);
 IF (r#>>'{sections,photos,total}')::int<>1 OR (r#>>'{sections,photos,rows,0,id}')::bigint<>-92202 THEN RAISE EXCEPTION 'Client B photo scope mismatch';END IF;
END $test$;
RESET ROLE;
INSERT INTO public.client_campaign_access(client_id,campaign_id,user_id) VALUES(-92201,-92201,'91000000-0000-4000-8000-000000092203');
UPDATE public.utilisateurs SET client_id=-92201 WHERE id=-92201;
SET LOCAL ROLE authenticated;
DO $test$ BEGIN
 IF (public.admin_preview_client_portal_context_v1362(-92203)#>>'{sections,photos,total}')::int<>2 THEN RAISE EXCEPTION 'Client campaign grant not honored';END IF;
 BEGIN PERFORM public.admin_preview_client_portal_context_v1362(-92204);RAISE EXCEPTION 'Cross-client preview allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $test$;
RESET ROLE;
UPDATE public.utilisateurs SET role='Installateur' WHERE id=-92201;
SET LOCAL ROLE authenticated;
DO $test$ BEGIN BEGIN PERFORM public.admin_preview_client_portal_context_v1362(-92202);RAISE EXCEPTION 'Installer preview allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $test$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $test$ BEGIN BEGIN PERFORM public.admin_preview_client_portal_context_v1362(-92202);RAISE EXCEPTION 'Missing uid allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $test$;
ROLLBACK;
SELECT '8 preview scope/identity cases PASS; fixtures rolled back' AS result;
