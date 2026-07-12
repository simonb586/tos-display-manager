import { supabase, supabaseConfigured } from '../lib/supabaseClient';
export async function runSystemValidation(){if(!supabaseConfigured||!supabase)throw new Error('Supabase n’est pas configuré.');const{data,error}=await supabase.rpc('diagnostic_systeme_v07');if(error)throw error;return data||[];}
