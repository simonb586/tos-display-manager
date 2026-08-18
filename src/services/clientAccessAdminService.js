import {supabase}from'../lib/supabaseClient';import{clientPortalAccessStatus}from'../lib/clientPortalAccessStatus';import{inviteRealUser}from'./userProvisioningService';
async function rpc(name,args={}){const{data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);return data}
export async function listClientAccessOverview(){return(await rpc('admin_client_access_overview_v135')).map(x=>({...x,portal_access_status:clientPortalAccessStatus(x)}))}
export const getClientAccessDetail=id=>rpc('admin_client_access_detail_v135',{p_client_id:+id});
export const createClient=payload=>rpc('admin_create_client_v135',{p_payload:payload});export const updateClient=(id,payload)=>rpc('admin_update_client_v135',{p_client_id:+id,p_payload:payload});
export const inviteClientAdmin=(client,form)=>inviteRealUser({nom:form.nom,courriel:form.courriel,role:'Client-Admin',organisation:client.nom_client,client_id:client.client_id});
