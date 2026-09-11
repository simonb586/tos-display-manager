import {supabase, supabaseConfigured} from '../lib/supabaseClient';
import {mergeInternalIssues} from './internalIssuesService';

async function call(name,args) {
 if(!supabaseConfigured || !supabase) throw new Error('Service sécurisé indisponible.');
 const {data,error}=await supabase.rpc(name,args);
 if(error) throw error;
 return data;
}
export async function loadBusinessRows(view,{targetUserId=null}={}) {
 if(view==='Enjeux des cadres et supports'){
  const [historical,terrain]=await Promise.all([loadBusinessRows('enjeux_des_cadres_et_supports',{targetUserId}),loadBusinessRows('Enjeux terrain',{targetUserId})]);
  const rows=mergeInternalIssues(historical.rows,terrain.rows);return {rows,total:rows.length};
 }
 const rows=[]; let total=0;
 do {
  const page=await call(targetUserId?'admin_preview_business_rows':'portal_business_rows',{
   p_view:view,p_offset:rows.length,p_limit:1000,...(targetUserId?{p_target_user_id:targetUserId}:{})
  });
  if(!Array.isArray(page?.rows)||!Number.isSafeInteger(page.total)) throw new Error('Vue métier incomplète.');
  total=page.total;
  if(!page.rows.length && rows.length<total) throw new Error('Lecture métier interrompue. Actualisez.');
  rows.push(...page.rows);
 }while(rows.length<total);
 return {rows,total};
}
export const loadPreviewSummary = targetUserId => call('admin_preview_dashboard_summary',{p_target_user_id:targetUserId});
export const listPreviewUsers = () => call('admin_preview_users',{});
export const loadPreviewProfile = userId => call('portal_preview_profile',{p_user_id:userId});
export const loadBusinessContext = (kind,id=null,targetUserId=null) => targetUserId
 ? call('admin_preview_business_read',{p_target_user_id:targetUserId,p_view:kind==='operations'?'@operations':`@support:${id}`})
 : call('portal_business_context',{p_kind:kind,p_id:id});
