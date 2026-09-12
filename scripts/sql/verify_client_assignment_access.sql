BEGIN;
INSERT INTO auth.users(id,email) VALUES
('94000000-0000-4000-8000-000000000001','assign-admin@example.invalid'),
('94000000-0000-4000-8000-000000000002','assign-ca@example.invalid'),
('94000000-0000-4000-8000-000000000003','assign-client@example.invalid'),
('94000000-0000-4000-8000-000000000004','assign-b@example.invalid');
INSERT INTO clients(id,nom_client,statut) VALUES(-94002,'Assignment B','Actif');
INSERT INTO utilisateurs(id,auth_user_id,role,statut,client_id) VALUES
(-94001,'94000000-0000-4000-8000-000000000001','Administrateur','Actif',null),
(-94002,'94000000-0000-4000-8000-000000000002','Client-Admin','Actif',2),
(-94003,'94000000-0000-4000-8000-000000000003','Client','Actif',2),
(-94004,'94000000-0000-4000-8000-000000000004','Client-Admin','Actif',-94002);
INSERT INTO role_ui_permissions(role,visible_tables,visible_columns,capabilities) VALUES
('Administrateur',ARRAY['*'],'{}','{}'),
('Client-Admin',ARRAY['Infrastructures','Campagnes et visuels par site et supports','Communications opérationnelles par site et supports'],'{}','{"*":{"update":true}}'),
('Client',ARRAY['Infrastructures','Campagnes et visuels par site et supports','Communications opérationnelles par site et supports'],'{}','{}')
ON CONFLICT(role) DO UPDATE SET visible_tables=excluded.visible_tables,visible_columns=excluded.visible_columns,capabilities=excluded.capabilities;
INSERT INTO infrastructures(id,support_id,client_id,site) VALUES(-94001,'ASSIGN-A',2,'EXO'),(-94002,'ASSIGN-B',-94002,'B');
INSERT INTO campagnes_maitres(id,client_id,business_context,nom_campagne,client_published) VALUES(-94001,2,'marketing','A',true),(-94002,-94002,'marketing','B',true);
INSERT INTO campagnes_supports(id,campagne_id,support_id,client_id,client_visible,statut) VALUES(-94001,-94001,'ASSIGN-A',2,true,'Initial'),(-94002,-94002,'ASSIGN-B',-94002,true,'Initial');
INSERT INTO campagnes_visuels_sites_supports(id,client_id,support_id,business_context,nom_campagne) VALUES(-94001,2,'ASSIGN-A','marketing','A'),(-94002,-94002,'ASSIGN-B','marketing','B'),(-94003,2,'RETIRED-SUPPORT','marketing','Historique EXO'),(-94004,2,'ASSIGN-B','marketing','Contradiction');
INSERT INTO communications_operationnelles_sites_supports(id,client_id,support_id,business_context,message) VALUES(-94001,2,'ASSIGN-A','operational_communication','A'),(-94002,-94002,'ASSIGN-B','operational_communication','B');
SELECT set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; t text; BEGIN
 FOREACH t IN ARRAY ARRAY['campagnes_supports','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports'] LOOP
  EXECUTE format('SELECT count(*) FROM %I WHERE id=-94001',t) INTO n;IF n<>1 THEN RAISE EXCEPTION 'Own read %',t;END IF;
  EXECUTE format('SELECT count(*) FROM %I WHERE id=-94002',t) INTO n;IF n<>0 THEN RAISE EXCEPTION 'Cross client read %',t;END IF;
  EXECUTE format('UPDATE %I SET updated_at=now() WHERE id=-94001',t);GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Own edit %',t;END IF;
  EXECUTE format('UPDATE %I SET updated_at=now() WHERE id=-94002',t);GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Cross client edit %',t;END IF;
  BEGIN EXECUTE format('UPDATE %I SET client_id=-94002 WHERE id=-94001',t);RAISE EXCEPTION 'Transfer allowed %',t;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN EXECUTE format('UPDATE %I SET support_id=null WHERE id=-94001',t);RAISE EXCEPTION 'Support detach allowed %',t;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN EXECUTE format('DELETE FROM %I WHERE id=-94001',t);GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Delete allowed %',t;END IF;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END LOOP;
 UPDATE campagnes_supports SET visuel_attendu='Corrected' WHERE id=-94001;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Visual edit denied';END IF;
 UPDATE campagnes_visuels_sites_supports SET nom_campagne='Corrected' WHERE id=-94001;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'History edit denied';END IF;
 UPDATE communications_operationnelles_sites_supports SET message='Corrected' WHERE id=-94001;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Communication edit denied';END IF;
 IF NOT EXISTS(SELECT 1 FROM campagnes_visuels_sites_supports WHERE id=-94003) THEN RAISE EXCEPTION 'Unlinked EXO history lost';END IF;
 IF EXISTS(SELECT 1 FROM campagnes_visuels_sites_supports WHERE id=-94004) THEN RAISE EXCEPTION 'Contradictory support accessible';END IF;
 BEGIN PERFORM admin_preview_assignment_source(-94001,'infrastructures');RAISE EXCEPTION 'Client impersonation allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer;t text; BEGIN
 FOREACH t IN ARRAY ARRAY['campagnes_supports','campagnes_visuels_sites_supports','communications_operationnelles_sites_supports'] LOOP
  EXECUTE format('SELECT count(*) FROM %I WHERE id=-94001',t) INTO n;IF n<>1 THEN RAISE EXCEPTION 'Client read denied %',t;END IF;
  EXECUTE format('UPDATE %I SET updated_at=now() WHERE id=-94001',t);GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Client edit allowed %',t;END IF;
  BEGIN EXECUTE format('DELETE FROM %I WHERE id=-94001',t);GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Client delete allowed %',t;END IF;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN EXECUTE format('INSERT INTO %I(id,client_id) VALUES(-94999,2)',t);RAISE EXCEPTION 'Client insert allowed %',t;EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 END LOOP;
END $$;
RESET ROLE;
UPDATE role_ui_permissions SET visible_columns='{"Campagnes et visuels par site et supports":["visuel_terrain"]}' WHERE role='Client-Admin';
SELECT set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN UPDATE campagnes_supports SET statut='Hidden' WHERE id=-94001;RAISE EXCEPTION 'Hidden column editable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 UPDATE campagnes_supports SET visuel_attendu='Allowed' WHERE id=-94001;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','94000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE rows jsonb; BEGIN
 rows:=admin_preview_assignment_source(-94004,'campagnes_visuels_sites_supports');
 IF jsonb_array_length(rows)<>1 OR rows->0->>'client_id'<>'-94002' THEN RAISE EXCEPTION 'Preview B scope';END IF;
 IF auth.uid()<>'94000000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Preview changed session';END IF;
 BEGIN PERFORM admin_preview_assignment_source(-94004,'utilisateurs');RAISE EXCEPTION 'Preview arbitrary table';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
ROLLBACK;
