import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Task-scoped access to the Supabase CLI credential only. Never serialize it.
export function managementToken(){
 if(process.env.SUPABASE_ACCESS_TOKEN)return process.env.SUPABASE_ACCESS_TOKEN;
 const {Entry}=require('C:/Users/sim-0/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/@napi-rs/keyring');
 for(const account of ['supabase','access-token']){
  try{const bytes=Entry.withTarget('Supabase CLI:'+account,'Supabase CLI',account).getSecret();if(bytes){for(const encoding of ['utf8','utf16le']){const value=Buffer.from(bytes).toString(encoding).replace(/\0/g,'').trim();if(/^sbp_[a-zA-Z0-9_-]+$/.test(value))return value}}}catch{}
 }
 throw Error('Supabase CLI credential unavailable');
}
export async function managementQuery(query,parameters=[]){
 const response=await fetch('https://api.supabase.com/v1/projects/cmdfomowtzrinywdsosy/database/query',{method:'POST',headers:{Authorization:'Bearer '+managementToken(),'Content-Type':'application/json'},body:JSON.stringify({query,parameters})});
 if(!response.ok){const error=await response.json().catch(()=>({}));throw Error('Database management HTTP '+response.status+': '+String(error.message||error.error||'').replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted]'))}
 return response.json();
}
