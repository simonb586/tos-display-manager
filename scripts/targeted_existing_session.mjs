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
