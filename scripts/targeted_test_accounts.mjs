import crypto from 'node:crypto';
export async function fixtureSession(access,{role='Client',clientId=1,profileId=-92101,missingProfile=false}={}){
 const email='cutover-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomBytes(24).toString('base64url')+'aA1!';
 const existing=await access.admin.from('utilisateurs').select('id').eq('id',profileId);if(existing.error||existing.data.length)throw Error('Fixture id unavailable');
 const created=await access.admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{account_activated:true}});
 if(created.error)throw Error(created.error.message);
 const uid=created.data.user.id;
 const cleanup=async()=>{
  const p=await access.admin.from('utilisateurs').delete().eq('auth_user_id',uid);if(p.error)throw Error('Fixture profile cleanup failed');
  const u=await access.admin.auth.admin.deleteUser(uid);if(u.error)throw Error('Fixture Auth cleanup failed');
 };
 try{
  if(!missingProfile){const p=await access.admin.from('utilisateurs').insert({id:profileId,auth_user_id:uid,nom:'Cutover controlled fixture',courriel:email,role,client_id:clientId,statut:'Actif',invitation_statut:'Compte activé'});if(p.error)throw Error(p.error.message)}
  const client=access.userClient(),auth=await client.auth.signInWithPassword({email,password});if(auth.error)throw Error(auth.error.message);
  return {client,session:auth.data.session,uid,profileId,cleanup};
 }catch(error){await cleanup();throw error}
}
