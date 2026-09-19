import {loadBusinessRows} from './businessParityService';
import {supabase} from '../lib/supabaseClient';
import {projectCampaignHistory} from '../lib/campaignHistory';
async function catalog(table,fields,targetUserId){
 const rows=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await (targetUserId?supabase.rpc('admin_preview_assignment_source',{p_target_user_id:targetUserId,p_table:table,p_offset:offset,p_limit:500}):supabase.from(table).select(fields).order('id').range(offset,offset+499));
  if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)return rows;
 }
}
export async function loadCampaignHistory(targetUserId=null){
 const [history,campaigns,supports]=await Promise.all([
  loadBusinessRows('Historique des campagnes',{targetUserId}),
  catalog('campagnes_maitres','id,client_id,nom_campagne,business_context',targetUserId),
  catalog('infrastructures','id,support_id,site,format_affichage',targetUserId)
 ]);
 return projectCampaignHistory(history.rows,{campaigns,supports});
}
