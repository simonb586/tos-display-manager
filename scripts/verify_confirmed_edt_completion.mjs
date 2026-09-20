import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {managementQuery} from './targeted_management_access.mjs';
const migration=fs.readFileSync('supabase/migrations/20260920200112_confirmed_edt_10_completion.sql','utf8');
const db=new PGlite();
await db.exec(`CREATE TABLE suivi_des_edt(id bigint PRIMARY KEY,no_edt text,client_id bigint,campagne_id bigint,statut text,lifecycle_status text,progression int,avancement int,raw_data jsonb,archived_at timestamptz,archived_by uuid,archive_reason text,lifecycle_closed_at timestamptz,lifecycle_exception text,date_fin text,updated_at timestamptz);
CREATE TABLE edt_phases(id bigint PRIMARY KEY,edt_id bigint,phase_type text,statut text,progression int,closed_at timestamptz,notes text,updated_at timestamptz,date_fin_reelle timestamptz);
INSERT INTO suivi_des_edt(id,no_edt,client_id,campagne_id,statut,lifecycle_status,progression,avancement,raw_data,archived_at,archive_reason) VALUES(10,'EDT-TOS-09 (0.1)',2,11,'Annule','annule',0,0,'{}',now(),'historic'),(11,'EDT-TOS-09',2,11,'Terminé','retrait_termine',100,100,'{}',null,null);
INSERT INTO edt_phases(id,edt_id,phase_type,statut,progression) VALUES(15,10,'installation','Terminée',100),(16,10,'retrait','Terminée',100),(17,10,null,'À faire',0);`);
const otherBefore=(await db.query('SELECT * FROM suivi_des_edt WHERE id=11')).rows;
await db.exec(migration);
const restored=(await db.query('SELECT * FROM suivi_des_edt WHERE id=10')).rows[0];
assert.equal(restored.statut,'Terminé');assert.equal(restored.lifecycle_status,'ferme');assert.equal(restored.archived_at,null);assert.equal(restored.progression,100);assert.equal(restored.date_fin,null);
assert.equal(restored.raw_data.confirmed_completion_20260920.previous_edt.statut,'Annule');
assert.equal(restored.raw_data.confirmed_completion_20260920.previous_phases.length,3);
assert((await db.query('SELECT * FROM edt_phases')).rows.every(p=>p.progression===100&&p.closed_at&&p.date_fin_reelle===null));
await db.exec(migration);assert.deepEqual((await db.query('SELECT * FROM suivi_des_edt WHERE id=10')).rows[0],restored,'Idempotent confirmation');
assert.deepEqual((await db.query('SELECT * FROM suivi_des_edt WHERE id=11')).rows,otherBefore);
await db.close();console.log('PASS: local confirmed completion, phase consistency, retained history, unchanged dates and distinct EDT, idempotency');
if(process.argv.includes('--remote')){
 const candidate=process.argv.includes('--applied')?'':migration;
 const results=await managementQuery(`BEGIN;SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='30s';
 CREATE TEMP TABLE before_other AS SELECT to_jsonb(e) data FROM public.suivi_des_edt e WHERE id<>10;
 CREATE TEMP TABLE before_mail AS SELECT count(*) n FROM public.email_outbox;
 ${candidate}
 DO $$BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.suivi_des_edt WHERE id=10 AND statut='Terminé' AND lifecycle_status='ferme' AND progression=100 AND archived_at IS NULL AND raw_data ? 'confirmed_completion_20260920') THEN RAISE EXCEPTION 'completion_missing';END IF;
  IF EXISTS(SELECT 1 FROM public.edt_phases WHERE edt_id=10 AND (progression<>100 OR closed_at IS NULL)) THEN RAISE EXCEPTION 'phase_incomplete';END IF;
  IF (SELECT count(*) FROM public.email_outbox)<>(SELECT n FROM before_mail) THEN RAISE EXCEPTION 'unexpected_mail';END IF;
  IF EXISTS((SELECT to_jsonb(e) FROM public.suivi_des_edt e WHERE id<>10 EXCEPT SELECT data FROM before_other) UNION ALL (SELECT data FROM before_other EXCEPT SELECT to_jsonb(e) FROM public.suivi_des_edt e WHERE id<>10)) THEN RAISE EXCEPTION 'other_edt_changed';END IF;
 END $$;
 SELECT id,no_edt,statut,progression,archived_at FROM public.suivi_des_edt WHERE id=10;
 ROLLBACK;`);
 assert.equal(results[0].statut,'Terminé');console.log('PASS: remote rollback, confirmed completion, phase consistency, no email and other EDTs unchanged');
}
