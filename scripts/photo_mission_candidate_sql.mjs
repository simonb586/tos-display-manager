import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
export async function photoMissionCandidateSql(){
 const [{count}]=await managementQuery("SELECT count(*)::int count FROM supabase_migrations.schema_migrations WHERE version IN ('20260916001452','20260916001458')");
 if(count===2)return ''; // Applied migrations are immutable and never replayed.
 if(count!==0)throw Error('Incomplete photo mission migration pair');
 return ['20260916001452_photo_inventory_import_privacy_movements.sql','20260916001458_photo_import_canonical_movements.sql'].map(file=>fs.readFileSync('supabase/migrations/'+file,'utf8')).join('\n');
}
