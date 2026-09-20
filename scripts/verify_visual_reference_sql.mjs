import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`
 CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
 CREATE FUNCTION public.tos_current_role() RETURNS text LANGUAGE sql AS $$SELECT nullif(current_setting('test.role',true),'')$$;
 CREATE FUNCTION public.tos_storage_tenant_scope(text,text,text,text) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
 CREATE TABLE public.campagne_visuels_formats(id bigint PRIMARY KEY,client_id bigint,updated_at timestamptz);
 ALTER TABLE public.campagne_visuels_formats ENABLE ROW LEVEL SECURITY;
 CREATE POLICY fixture_scope ON public.campagne_visuels_formats TO authenticated
 USING(tos_current_role()='Administrateur' OR client_id=nullif(current_setting('test.client',true),'')::bigint)
 WITH CHECK(tos_current_role() IN ('Administrateur','Coordonnateur') AND (tos_current_role()='Administrateur' OR client_id=nullif(current_setting('test.client',true),'')::bigint));
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(bucket_id text,name text,owner_id text,PRIMARY KEY(bucket_id,name));
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE POLICY final_storage_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(false);
 CREATE POLICY final_storage_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);
 CREATE POLICY final_storage_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
 GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.campagne_visuels_formats,storage.objects TO authenticated;
 INSERT INTO public.campagne_visuels_formats VALUES(1,2,now()),(2,1,now());
`);
await db.exec(fs.readFileSync('supabase/migrations/20260920085824_visual_reference_assets.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20260920101916_visual_reference_removal.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20260920104037_visual_reference_active_limit.sql','utf8'));
const identity=async(role,client='2')=>db.exec(`RESET ROLE;SET test.uid='00000000-0000-0000-0000-000000000001';SET test.role='${role}';SET test.client='${client}';SET ROLE authenticated;`);
const path='2/1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf';
const asset={id:'a',storage_path:path,name:'Reference.pdf',mime_type:'application/pdf',pages:[{page:1,features:{version:1,points:[],descriptors:'',columns:0}}]};
await identity('Administrateur');
await db.query('INSERT INTO storage.objects VALUES($1,$2,$3)',['visual-references',path,'00000000-0000-0000-0000-000000000001']);
await db.query('SELECT public.add_visual_reference($1,$2)',[1,JSON.stringify(asset)]);
await db.query('SELECT public.add_visual_reference($1,$2)',[1,JSON.stringify(asset)]);
assert.equal((await db.query('SELECT jsonb_array_length(reference_assets) n FROM campagne_visuels_formats WHERE id=1')).rows[0].n,1);
await assert.rejects(db.query('DELETE FROM campagne_visuels_formats WHERE id=1'),/Archivez/);
for(const role of ['Client','Client-Admin']){
 await identity(role);
 assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1);
 await assert.rejects(db.query('SELECT public.add_visual_reference($1,$2)',[1,JSON.stringify({...asset,id:'b'})]),/reference_write_denied/);
 await assert.rejects(db.query('INSERT INTO storage.objects VALUES($1,$2,$3)',['visual-references',path.replace('.pdf','.jpg'),'x']),/row-level security/);
 await identity(role,'1');assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0,'Client B cannot read EXO reference');
}
await identity('Coordonnateur','1');await assert.rejects(db.query('SELECT public.add_visual_reference($1,$2)',[1,JSON.stringify(asset)]),/visual_not_accessible/);
await identity('Administrateur');
await assert.rejects(db.query('SELECT public.add_visual_reference($1,$2)',[2,JSON.stringify(asset)]),/invalid_visual_reference/);
await db.query('SELECT public.remove_visual_reference($1,$2)',[1,'a']);
await db.query('SELECT public.remove_visual_reference($1,$2)',[1,'a']);
const removed=(await db.query('SELECT reference_assets FROM campagne_visuels_formats WHERE id=1')).rows[0].reference_assets;
assert.equal(removed[0].archived,true);
assert.equal(removed[0].storage_path,path);
assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1,'Removal retains original');
for(let i=0;i<10;i++)await db.query('SELECT public.add_visual_reference($1,$2)',[1,JSON.stringify({...asset,id:'active-'+i})]);
await assert.rejects(db.query('SELECT public.add_visual_reference($1,$2)',[1,JSON.stringify({...asset,id:'over-limit'})]),/check constraint/);
await db.query('SELECT public.remove_visual_reference($1,$2)',[1,'active-0']);
await db.query('SELECT public.add_visual_reference($1,$2)',[1,JSON.stringify({...asset,id:'replacement'})]);
assert.equal((await db.query('SELECT jsonb_array_length(reference_assets) n FROM campagne_visuels_formats WHERE id=1')).rows[0].n,12,'Removed references retain history and free active slots');
for(const role of ['Client','Client-Admin']){
 await identity(role);await assert.rejects(db.query('SELECT public.remove_visual_reference($1,$2)',[1,'a']),/reference_write_denied/);
}
await identity('Coordonnateur','1');await assert.rejects(db.query('SELECT public.remove_visual_reference($1,$2)',[1,'a']),/visual_not_accessible/);
await db.exec('RESET ROLE;SET ROLE anon;');await assert.rejects(db.query('SELECT public.add_visual_reference($1,$2)',[1,JSON.stringify(asset)]),/permission denied/);
await db.close();console.log('PASS: local PostgreSQL migration, private originals, idempotent append, role writes, tenant isolation, anon denial');
