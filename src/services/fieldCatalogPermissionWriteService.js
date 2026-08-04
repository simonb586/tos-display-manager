import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import { normalizePermissionConfig, PERMISSION_CONFIG_VERSION } from '../lib/fieldCatalogPermissionDraft.js';
export async function saveFieldPermissionDraft({field,draft,expectedUpdatedAt,role}){
  if(role!=='Administrateur')throw new Error('Permission administrateur requise.');
  const validation=normalizePermissionConfig(draft);if(!validation.valid){const e=new Error(Object.values(validation.errors)[0]);e.validationErrors=validation.errors;throw e;}
  if(!supabaseConfigured||!supabase)throw new Error('Supabase n’est pas configuré.');
  const {data,error}=await supabase.rpc('save_relation_field_permission_draft_v0131a6',{p_table_name:field.tableName,p_field_name:field.technicalName,p_contract_version:PERMISSION_CONFIG_VERSION,p_permission_config:validation.normalized,p_expected_updated_at:expectedUpdatedAt});
  if(error){try{const d=JSON.parse(error.details||'{}');error.code=d.code||error.code;error.field=d.field;}catch{}throw error;}return data;
}
