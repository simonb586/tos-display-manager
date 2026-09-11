
import {createClient} from '@supabase/supabase-js';
async function managementToken(){
 if(process.env.SUPABASE_ACCESS_TOKEN)return process.env.SUPABASE_ACCESS_TOKEN;
 // Optional local credential adapter; portable runs use the environment variable.
 try{return (await import('../remote_management_access.mjs')).managementToken();}catch{throw Error('Set SUPABASE_ACCESS_TOKEN for the explicitly requested live tests.');}
}

export const project='cmdfomowtzrinywdsosy';
export const endpoint=`https://${project}.supabase.co`;
// CLI credentials are read only into process memory. Never serialize keys,
// generated links, sessions, request headers or complete Auth responses.
export async function serverAccess(){
 const response=await fetch('https://api.supabase.com/v1/projects/'+project+'/api-keys',{headers:{Authorization:'Bearer '+await managementToken()}});
 if(!response.ok)throw Error('Test access unavailable HTTP '+response.status);
 const keys=await response.json();
 const service=keys.find(k=>k.name==='service_role')?.api_key;
 const anon=keys.find(k=>k.name==='anon')?.api_key;
 if(!service||!anon||service.includes('*'))throw Error('Server credentials unavailable');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(endpoint,service,options);
 const userClient=()=>createClient(endpoint,anon,options);
 return {admin,anon,userClient};
}
export async function existingSession(access,profileId){
 const {data:profile,error}=await access.admin.from('utilisateurs').select('id,auth_user_id,courriel,role,client_id,statut').eq('id',profileId).single();
 if(error||profile.statut!=='Actif'||!profile.auth_user_id)throw Error('Canonical active profile required');
 const {data:account,error:accountError}=await access.admin.auth.admin.getUserById(profile.auth_user_id);
 if(accountError||!account.user.email_confirmed_at)throw Error('Do not activate a real pending account');
 const {data:link,error:linkError}=await access.admin.auth.admin.generateLink({type:'magiclink',email:profile.courriel});
 if(linkError)throw Error('Test session link generation failed: '+linkError.message);
 const client=access.userClient();
 const {data,error:verifyError}=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'});
 if(verifyError||data.user?.id!==profile.auth_user_id)throw Error('Test session identity verification failed');
 return {client,session:data.session,profile};
}
