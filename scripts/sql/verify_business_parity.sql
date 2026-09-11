BEGIN;
INSERT INTO auth.users(id,email) VALUES('93000000-0000-4000-8000-000000000001','parity-admin@example.invalid'),('93000000-0000-4000-8000-000000000002','parity-ca@example.invalid'),('93000000-0000-4000-8000-000000000003','parity-client@example.invalid'),('93000000-0000-4000-8000-000000000004','parity-b@example.invalid');
INSERT INTO public.clients(id,nom_client,statut) VALUES(-93002,'Parity B','Actif');
INSERT INTO public.utilisateurs(id,auth_user_id,role,statut,client_id) VALUES
(-93001,'93000000-0000-4000-8000-000000000001','Administrateur','Actif',null),
(-93002,'93000000-0000-4000-8000-000000000002','Client-Admin','Actif',2),
(-93003,'93000000-0000-4000-8000-000000000003','Client','Actif',2),
(-93004,'93000000-0000-4000-8000-000000000004','Client','Actif',-93002);
INSERT INTO public.role_ui_permissions(role,visible_tables,visible_columns,capabilities) VALUES
('Administrateur',ARRAY['*'],'{}','{}'),('Client-Admin',ARRAY['Infrastructures','Répertoire des affiches'],'{}','{"*":{"update":true}}'),('Client',ARRAY['Infrastructures'],'{}','{}')
ON CONFLICT(role) DO UPDATE SET visible_tables=excluded.visible_tables,capabilities=excluded.capabilities;
INSERT INTO public.infrastructures(id,support_id,client_id,site,commentaires) VALUES(-93001,'PARITY-A',2,'EXO','before'),(-93002,'PARITY-B',-93002,'Client B','before');
-- Both client roles can request work on their own supports without a campaign.
DO $$ DECLARE actor uuid;result jsonb; BEGIN
 FOREACH actor IN ARRAY ARRAY['93000000-0000-4000-8000-000000000002'::uuid,'93000000-0000-4000-8000-000000000003'::uuid] LOOP
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  result:=public.creer_requete_client_multi_supports_v133('Inspection','Normale','Parity rollback test',ARRAY['PARITY-A']);
  IF result->>'support_count'<>'1' THEN RAISE EXCEPTION 'Request not created';END IF;
  BEGIN PERFORM public.creer_requete_client_multi_supports_v133('Inspection','Normale','Parity forbidden',ARRAY['PARITY-B']);RAISE EXCEPTION 'Cross-client request allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb;n integer; BEGIN
 r:=public.portal_business_rows('Infrastructures');
 IF r->>'total'<>'1' OR r->'rows'->0->>'support_id'<>'PARITY-A' THEN RAISE EXCEPTION 'Client-Admin scope';END IF;
 UPDATE public.infrastructures SET commentaires='after' WHERE support_id='PARITY-A';
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'EXO edit denied';END IF;
 UPDATE public.infrastructures SET commentaires='leak' WHERE support_id='PARITY-B';
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'cross client write';END IF;
 BEGIN UPDATE public.infrastructures SET client_id=-93002 WHERE support_id='PARITY-A';RAISE EXCEPTION 'owner transfer allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.admin_preview_dashboard_summary(-93001);RAISE EXCEPTION 'client preview admin allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.portal_preview_profile(-93001);RAISE EXCEPTION 'Client read preview Auth flag';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 UPDATE public.infrastructures SET commentaires='client write' WHERE support_id='PARITY-A';GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Client mutation';END IF;
 IF public.portal_view_allowed('Infrastructures',true) THEN RAISE EXCEPTION 'Client write capability';END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.admin_preview_business_rows(-93004,'Infrastructures');
 IF r->>'total'<>'1' OR r->'rows'->0->>'support_id'<>'PARITY-B' THEN RAISE EXCEPTION 'Preview cross client';END IF;
 IF auth.uid()<>'93000000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Preview changed identity';END IF;
 BEGIN PERFORM public.admin_preview_business_rows(-93004,'Répertoire des affiches');RAISE EXCEPTION 'Preview forbidden view';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF auth.uid()<>'93000000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Failed preview changed identity';END IF;
END $$;
RESET ROLE;
-- The Data API hook denies writes before replacing the JWT identity.
SELECT set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.headers','{"x-tos-preview-user":"25"}',true);
SELECT set_config('request.method','PATCH',true);
SELECT set_config('request.path','/infrastructures',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.portal_preview_guard();RAISE EXCEPTION 'Preview PATCH allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF auth.uid()<>'93000000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Denied preview changed identity';END IF;
 PERFORM set_config('request.method','POST',true);PERFORM set_config('request.path','/rpc/creer_requete_client_multi_supports_v133',true);
 BEGIN PERFORM public.portal_preview_guard();RAISE EXCEPTION 'Preview mutation RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 PERFORM set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000003',true);PERFORM set_config('request.method','GET',true);PERFORM set_config('request.path','/infrastructures',true);
 BEGIN PERFORM public.portal_preview_guard();RAISE EXCEPTION 'Client forged preview';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
ROLLBACK;
