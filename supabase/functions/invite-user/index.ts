import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});

function publicSiteUrl(){
  const value=(Deno.env.get('CLIENT_PORTAL_URL')||Deno.env.get('PUBLIC_SITE_URL')||Deno.env.get('APP_PUBLIC_URL')||'').trim().replace(/\/+$/,'');
  if(!value)throw new Error('Le secret CLIENT_PORTAL_URL est obligatoire.');
  const url=new URL(value);
  if(url.protocol!=='https:'||['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname)||url.hostname.endsWith('.local'))throw new Error('CLIENT_PORTAL_URL doit être une adresse HTTPS publique.');
  return value;
}

async function findUser(admin:any,email:string){
  for(let page=1;page<=10;page+=1){
    const{data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const user=data.users.find((item:any)=>String(item.email||'').toLowerCase()===email);
    if(user)return user;
    if(data.users.length<1000)break;
  }
  return null;
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST')return json({error:'Méthode non autorisée.'},405);
  try{
    const authorization=request.headers.get('Authorization');
    if(!authorization)return json({error:'Session absente.'},401);
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
    const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serverKey=Deno.env.get('SUPABASE_SECRET_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if(!supabaseUrl||!publicKey||!serverKey)return json({error:'Configuration Supabase Edge incomplète.'},500);
    const caller=createClient(supabaseUrl,publicKey,{global:{headers:{Authorization:authorization}}});
    const admin=createClient(supabaseUrl,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const{data:authData,error:authError}=await caller.auth.getUser();
    if(authError||!authData.user)return json({error:'Session invalide.'},401);
    const{data:callerProfile,error:callerError}=await admin.from('utilisateurs').select('id,role,statut,client_id,organisation,courriel').or(`auth_user_id.eq.${authData.user.id},courriel.eq.${authData.user.email}`).maybeSingle();
    if(callerError)throw callerError;
    if(!callerProfile||String(callerProfile.statut||'').toLowerCase()!=='actif')return json({error:'Profil actif requis.'},403);
    const body=await request.json();

    if(body.action==='complete_client_activation'){
      if(!['Client','Client-Admin'].includes(callerProfile.role)||!callerProfile.client_id)return json({error:'Profil client requis.'},403);
      const{error}=await admin.from('client_member_invitations').update({status:'accepted'}).eq('client_id',callerProfile.client_id).eq('email',String(authData.user.email||'').toLowerCase()).eq('status','pending');
      if(error)throw error;
      return json({ok:true,status:'accepted'});
    }

    const clientAdminOrigin=body.origin==='client-admin';
    if(clientAdminOrigin&&callerProfile.role!=='Client-Admin')return json({error:'Accès Client-Admin requis.'},403);
    if(!clientAdminOrigin&&callerProfile.role!=='Administrateur')return json({error:'Accès administrateur actif requis.'},403);
    const email=String(body.email||'').trim().toLowerCase();
    const nom=String(body.nom||'').trim();
    let role=String(body.role||'Installateur').trim();
    let organisation=String(body.organisation||'').trim();
    let clientId=body.client_id?Number(body.client_id):null;
    const redirectTo=`${publicSiteUrl()}/set-password`;
    if(!email||!email.includes('@'))return json({error:'Courriel valide obligatoire.'},400);

    if(clientAdminOrigin){
      role='Client';
      clientId=Number(callerProfile.client_id);
      organisation=String(callerProfile.organisation||'');
      const invitationId=Number(body.invitation_id);
      if(!invitationId)return json({error:'Invitation métier requise.'},400);
      const{data:businessInvite,error:inviteError}=await admin.from('client_member_invitations').select('id,client_id,email,requested_role,status').eq('id',invitationId).maybeSingle();
      if(inviteError)throw inviteError;
      if(!businessInvite||Number(businessInvite.client_id)!==clientId||String(businessInvite.email).toLowerCase()!==email)return json({error:'cross_client_denied'},403);
      if(businessInvite.requested_role!=='Client'||businessInvite.status!=='pending')return json({error:'Invitation métier invalide.'},409);
      const{data:existingProfile,error:existingError}=await admin.from('utilisateurs').select('auth_user_id,client_id,role,invitation_statut,premiere_connexion_le').eq('courriel',email).maybeSingle();
      if(existingError)throw existingError;
      if(existingProfile&&Number(existingProfile.client_id)!==clientId)return json({error:'cross_client_denied'},403);
      if(existingProfile&&(existingProfile.premiere_connexion_le||String(existingProfile.invitation_statut||'').toLowerCase()==='compte activé'))return json({error:'Un compte existe déjà pour cette adresse.'},409);
    }

    const allowedRoles=['Administrateur','Coordonnateur','Installateur','Client-Admin','Client'];
    if(!allowedRoles.includes(role))return json({error:'Rôle invalide.'},400);
    let authUser=await findUser(admin,email);
    if(clientAdminOrigin&&authUser?.email_confirmed_at)return json({error:'Un compte existe déjà pour cette adresse.'},409);
    let invitationSent=false;
    if(!authUser){
      const result=await admin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{nom,role,organisation,account_activated:false}});
      if(result.error){
        authUser=await findUser(admin,email);
        if(!authUser||authUser.email_confirmed_at)return json({error:`Invitation impossible : ${result.error.message}`,redirect_to:redirectTo},409);
      }else authUser=result.data.user;
      invitationSent=true;
    }
    if(authUser&&!authUser.email_confirmed_at&&!invitationSent){
      const{error}=await admin.auth.resend({type:'invite',email,options:{emailRedirectTo:redirectTo}});
      if(error)return json({error:`Invitation impossible : ${error.message}`},400);
      invitationSent=true;
    }
    const lifecycle=authUser?.email_confirmed_at?'Actif':'Invitation envoyée';
    const{data:profile,error:profileError}=await admin.from('utilisateurs').upsert({auth_user_id:authUser?.id||null,nom,courriel:email,role,organisation,statut:authUser?.banned_until?'Désactivé':'Actif',invitation_statut:lifecycle,invitation_envoyee_le:invitationSent?new Date().toISOString():null,client_id:clientId,updated_at:new Date().toISOString()},{onConflict:'courriel'}).select().single();
    if(profileError)return json({error:`Profil non enregistré : ${profileError.message}`},500);
    return json({ok:true,invitation_sent:invitationSent,redirect_to:redirectTo,profile,message:`Invitation envoyée vers ${redirectTo}`});
  }catch(error){console.error(error);return json({error:error.message||String(error)},500);}
});
