let profile=null;
export const getUserViewPreview=()=>profile;
export function setUserViewPreview(value){profile=value;window.dispatchEvent(new Event('tos-user-view-preview'));}
export function userViewSession(session){
 if(!session||!profile)return session;
 return {...session,user:{...session.user,id:profile.auth_user_id,email:profile.courriel,user_metadata:{account_activated:profile._preview_account_activated===true}}};
}

// The real application is remounted for each target. The admin JWT stays intact.
// The server validates this header before applying the target's RLS identity.
export async function previewAwareFetch(input,init={}){
 const target=profile;
 if(!target)return fetch(input,init);
 const url=new URL(typeof input==='string'?input:input.url);
 const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
 const method=(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(url.pathname.startsWith('/rest/v1/')){
  headers.set('x-tos-preview-user',String(target.id));
  return fetch(input,{...init,headers});
 }
 if(url.pathname.startsWith('/functions/v1/') ||
   (url.pathname.startsWith('/auth/v1/')&&method!=='GET'&&!url.pathname.endsWith('/token')) ||
   (url.pathname.startsWith('/storage/v1/')&&!['GET','HEAD'].includes(method)&&!url.pathname.startsWith('/storage/v1/object/sign/'))){
  throw new Error('Aperçu utilisateur : les écritures sont désactivées.');
 }
 if(url.pathname.startsWith('/storage/v1/object/sign/')){
  const path=url.pathname.slice('/storage/v1/object/sign/'.length).split('/');
  const bucket=decodeURIComponent(path.shift()),name=decodeURIComponent(path.join('/'));
  if(!name)throw new Error('Aperçu : signature groupée indisponible.');
  const checkHeaders=new Headers(headers);checkHeaders.set('x-tos-preview-user',String(target.id));checkHeaders.set('Content-Type','application/json');
  const check=await fetch(`${url.origin}/rest/v1/rpc/portal_preview_storage_read`,{method:'POST',headers:checkHeaders,body:JSON.stringify({p_bucket:bucket,p_name:name})});
  if(!check.ok||await check.json()!==true)throw new Error('Photo inaccessible pour cet utilisateur.');
 }
 return fetch(input,init);
}
