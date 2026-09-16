import {supabase,supabaseConfigured} from '../lib/supabaseClient';

export async function readPhotoProjection(table,filters={},offset=0,limit=500) {
 if(!supabaseConfigured||!supabase)throw new Error('Service photo indisponible.');
 const {data,error}=await supabase.rpc('photo_inventory_read',{p_table:table,p_filters:filters,p_offset:offset,p_limit:limit});
 if(error)throw error;
 if(!Array.isArray(data?.rows)||!Number.isSafeInteger(data.total))throw new Error('Lecture photo incomplète.');
 return data;
}
export async function allPhotoProjectionRows(table,filters={}) {
 const rows=[];let total=0;
 do {const page=await readPhotoProjection(table,filters,rows.length);total=page.total;
  if(!page.rows.length&&rows.length<total)throw new Error('Lecture photo interrompue. Actualisez.');
  rows.push(...page.rows);
 }while(rows.length<total);
 return rows;
}
