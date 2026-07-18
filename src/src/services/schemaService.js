import { supabase, supabaseConfigured } from '../lib/supabaseClient';
export async function listAvailableTablesAndFields(){if(!supabaseConfigured||!supabase)throw new Error('Supabase n’est pas configuré.');const{data,error}=await supabase.rpc('list_public_schema_fields');if(error)throw error;const out={};for(const r of data||[]){(out[r.table_name]??=[]).push(r.column_name);}return out;}
