import fs from 'node:fs';
import {managementQuery} from './targeted_management_access.mjs';
const dir='docs/photo-inventory-mission';
fs.mkdirSync(dir,{recursive:true});
const queries={
 functions:`select p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosecdef,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and (p.proname ~ '(photo|terrain|portal|preview|report|rapport|histor|permission|capabil|edt|movement)' or p.proname in ('current_app_user','current_app_role','current_app_client_id','can_access_client')) order by p.proname`,
 columns:`select table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
 policies:`select * from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname`,
 constraints:`select c.relname table_name,conname,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,conname`,
 triggers:`select c.relname table_name,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname`,
 views:`select viewname,definition from pg_views where schemaname='public'`,
 permissions:`select role,visible_tables,capabilities from role_ui_permissions`
};
for(const [name,sql] of Object.entries(queries)){
 const file=`${dir}/${name}-before.json`;
 if(fs.existsSync(file))throw Error('Audit snapshot already exists: '+name);
 const rows=await managementQuery(sql);fs.writeFileSync(file,JSON.stringify(rows,null,2));console.log(name+': '+rows.length);
}
