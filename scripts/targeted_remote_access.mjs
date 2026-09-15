import {createClient} from '@supabase/supabase-js';
import {managementToken} from './targeted_management_access.mjs';
export async function targetedAccess(){
 const project='cmdfomowtzrinywdsosy';
 const response=await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys`,{headers:{Authorization:'Bearer '+managementToken()}});
 if(!response.ok)throw Error('Project API credentials unavailable');
 const keys=await response.json();
 const service=keys.find(k=>k.name==='service_role')?.api_key,anon=keys.find(k=>k.name==='anon')?.api_key;
 if(!service||!anon)throw Error('Project API credentials incomplete');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 return {admin:createClient(`https://${project}.supabase.co`,service,options),userClient:()=>createClient(`https://${project}.supabase.co`,anon,options)};
}
