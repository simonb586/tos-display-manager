import fs from 'node:fs';
let source=fs.readFileSync('scripts/verify_business_parity_local.mjs','utf8');
source=source.replace('await db.close();', `
for(const p of JSON.parse(fs.readFileSync('docs/client-business-parity/assignment-rls-baseline.json','utf8'))){
 await db.exec('DROP POLICY IF EXISTS '+p.policyname+' ON public.'+p.tablename);
 await db.exec('CREATE POLICY '+p.policyname+' ON public.'+p.tablename+' AS '+p.permissive+' FOR '+p.cmd+' TO '+(Array.isArray(p.roles)?p.roles.join(','):p.roles.replaceAll('{','').replaceAll('}',''))+(p.qual?' USING ('+p.qual+')':'')+(p.with_check?' WITH CHECK ('+p.with_check+')':''));
}
await db.exec(fs.readFileSync('supabase/migrations/20260912023913_client_site_support_assignment_access.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20260912024911_client_assignment_retired_support_history.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20260912025134_client_assignment_history_policy_alignment.sql','utf8'));
await db.exec(fs.readFileSync('scripts/sql/verify_client_assignment_access.sql','utf8'));
console.log('Client assignment access SQL PASS: own reads/updates, Client read-only, cross-client isolation, protected relationships, hidden columns, historical ownership, preview');
await db.close();`);
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
