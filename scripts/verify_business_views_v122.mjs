import assert from'node:assert/strict';import fs from'node:fs';
const read=file=>fs.readFileSync(file,'utf8'),main=read('src/main.jsx'),view=read('src/components/SiteSupportAssignmentsView.jsx'),service=read('src/services/siteSupportBusinessService.js'),module14=read('src/services/module14Service.js'),module17=read('src/services/clientPortalService.js'),drop=read('supabase/V1_2_2_DROP_LEGACY_CAMPAIGN_VISUAL_TABLE.sql'),verify=read('supabase/VERIFIER_V1_2_2_LEGACY_CAMPAIGN_REMOVAL_READ_ONLY.sql');

assert.ok(!main.includes("table: 'campagnes_et_visuels'"),'Ancienne table absente du chargement actif');
assert.ok(main.includes("!['Campagnes et visuels','Communications opérationnelles'].includes(tableName)"),'Anciennes entrées exclues du manifeste actif');
for(const table of['campagnes_visuels_sites_supports','communications_operationnelles_sites_supports'])assert.ok(service.includes(table),table);
assert.ok(module14.includes('getMarketingAssignmentsBySiteAndSupport')&&module14.includes('getOperationalCommunicationAssignmentsBySiteAndSupport'));
assert.ok(module17.includes("rpc('client_portal_list_v120'"),'Module 17 conserve sa RPC sécurisée');

const header=view.slice(view.indexOf('<header'),view.indexOf('{error&&'));
assert.ok(header.includes('Recherche globale'));for(const forbidden of['placeholder="Site"','placeholder="Support"','placeholder="Statut"','placeholder="Visuel"'])assert.ok(!header.includes(forbidden),forbidden);
for(const marker of['GridColumnHeader','filterValue={filters[key]}','sortState={sortState}','GridPagination','Sélectionner la page','Modifier la grille','Largeur','Réinitialiser la grille','Page visible','Sélection','Ensemble filtré','getAllAssignmentsBySiteAndSupport'])assert.ok(view.includes(marker),marker);
assert.ok(service.includes(".eq('business_context',context)"));assert.ok(service.includes('searchableFor(context)'));assert.ok(service.includes('.order(sortColumn'));

assert.match(drop,/^BEGIN;/);assert.match(drop,/DROP TABLE IF EXISTS public\.campagnes_et_visuels;/);assert.doesNotMatch(drop,/DROP TABLE[^;]+CASCADE/i);assert.equal((drop.match(/DROP TABLE/gi)||[]).length,1);for(const guard of['missing_rows','mismatched_rows','missing_columns','historical_fingerprint'])assert.ok(drop.includes(guard),guard);for(const sequenceGuard of['CREATE SEQUENCE IF NOT EXISTS public.campagnes_visuels_sites_supports_id_seq','OWNED BY public.campagnes_visuels_sites_supports.id','SELECT setval(','ALTER COLUMN id SET DEFAULT'])assert.ok(drop.includes(sequenceGuard),sequenceGuard);
assert.match(verify,/^BEGIN READ ONLY;/);assert.match(verify,/ROLLBACK;\s*$/);const executable=verify.replace(/--.*$/gm,'').replace(/'(?:''|[^'])*'/g,"''");assert.doesNotMatch(executable,/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\b/i);for(const marker of['LEGACY_CAMPAIGN_TABLE_ABSENT','CONSOLIDATED_CAMPAIGN_TABLE_PRESENT','CONSOLIDATED_SEQUENCE_PRESENT','CONSOLIDATED_ID_DEFAULT_DETACHED','DATABASE_VIEWS_REFERENCING_LEGACY','DATABASE_FUNCTIONS_REFERENCING_LEGACY','CAMPAIGN_DUPLICATE_LEGACY_IDS'])assert.ok(verify.includes(marker),marker);
assert.ok(verify.includes("procedure.prokind IN('f','p')"),'Les agrégats et fenêtres sont exclus de pg_get_functiondef');
console.log('V1.2.2: source canonique, ergonomie Infrastructure, garde-fous de retrait et sécurité Module 17 validés.');
