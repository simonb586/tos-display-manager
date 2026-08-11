import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const SENDER='noreply@groupetos.com',EVENT='edt_completed_report_sent',MAX_ATTEMPTS=5,ATTACHMENT_LIMIT=2_500_000;
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-worker-secret,content-type'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const validEmail=(v:string)=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)&&v.length<=254;
const base64=(bytes:Uint8Array)=>{let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(out)};
const pdfText=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').replace(/([\\()])/g,'\\$1').slice(0,110);
function simpleEdtPdf(lines:string[]){const stream=['BT','/F1 11 Tf','50 750 Td',...lines.flatMap((line,index)=>index?['0 -22 Td',`(${pdfText(line)}) Tj`]:[`(${pdfText(line)}) Tj`]),'ET'].join('\n'),objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`});const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(value=>String(value).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new TextEncoder().encode(pdf)}

async function authorize(request:Request,userClient:any){
 const worker=Deno.env.get('EDT_EMAIL_WORKER_SECRET');
 if(worker&&request.headers.get('x-worker-secret')===worker)return 'worker';
 const {data}=await userClient.auth.getUser();if(!data.user)return null;
 const {data:profile}=await userClient.from('utilisateurs').select('role,statut').eq('auth_user_id',data.user.id).maybeSingle();
 return profile?.statut==='Actif'&&['Administrateur','Coordonnateur'].includes(profile.role)?'staff':null;
}
async function graphToken(){
 const tenant=Deno.env.get('MS_TENANT_ID'),client=Deno.env.get('MS_CLIENT_ID'),secret=Deno.env.get('MS_CLIENT_SECRET');
 if(!tenant||!client||!secret)throw new Error('microsoft_graph_not_configured');
 const body=new URLSearchParams({client_id:client,client_secret:secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'});
 const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
 const result=await response.json();if(!response.ok)throw new Error(`graph_token_error:${result.error||response.status}`);return result.access_token as string;
}
async function sendGraph(message:any){
 const token=await graphToken();
 const response=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message,saveToSentItems:true})});
 if(response.status!==202){const detail=(await response.text()).slice(0,500);throw new Error(`graph_send_error:${response.status}:${detail}`)}
 return response.headers.get('request-id')||response.headers.get('client-request-id');
}

Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers});
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const auth=request.headers.get('authorization')||'';
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 if(!await authorize(request,userClient))return reply({error:'access_denied'},403);
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const input=await request.json().catch(()=>({}));const edtId=input.edt_id?Number(input.edt_id):null;
 const {data:jobs,error:jobsError}=await admin.rpc('claim_edt_completion_email_v131',{p_edt_id:edtId,p_limit:edtId?10:20});if(jobsError)return reply({error:'outbox_claim_failed'},500);
 const results=[];
 for(const job of jobs||[]){
  const attempt=job.attempt_count;
  let edt:any=null,report:any=null,recipient='';
  try{
   const {data,error}=await admin.from('suivi_des_edt').select('id,no_edt,statut,date_debut,date_fin,client,campagne,campagne_id,requester_contact_id,client_visible').eq('id',job.edt_id).single();if(error||!data)throw new Error('edt_not_found');edt=data;
   if(edt.statut!=='Complété')throw new Error('edt_not_completed');
   if(!edt.requester_contact_id)throw new Error('Requérant sans adresse courriel');
   const {data:contact}=await admin.from('utilisateurs').select('id,nom,courriel,client_id,auth_user_id,statut').eq('id',edt.requester_contact_id).maybeSingle();
   const {data:campaign}=await admin.from('campagnes_maitres').select('id,client_id,nom_campagne').eq('id',edt.campagne_id).maybeSingle();
   if(!contact||contact.statut!=='Actif'||contact.client_id!==campaign?.client_id)throw new Error('requester_client_mismatch');recipient=String(contact.courriel||'').trim().toLowerCase();
   if(!validEmail(recipient))throw new Error(recipient?'invalid_recipient_email':'Requérant sans adresse courriel');
   const {data:reports}=await admin.from('edt_reports').select('*').eq('edt_id',edt.id).in('status',['generated','ready']).order('report_version',{ascending:false}).order('updated_at',{ascending:false}).limit(1);
   report=reports?.[0];if(!report){const [{count:supportCount},{count:photoCount},{count:issueCount},{data:versions}]=await Promise.all([admin.from('edt_supports').select('*',{count:'exact',head:true}).eq('edt_id',edt.id),admin.from('support_photos').select('*',{count:'exact',head:true}).eq('edt_id',String(edt.id)),admin.from('enjeux_terrain').select('*',{count:'exact',head:true}).in('support_id',(await admin.from('edt_supports').select('support_id').eq('edt_id',edt.id)).data?.map((x:any)=>x.support_id)||['']),admin.from('edt_reports').select('report_version').eq('edt_id',edt.id).order('report_version',{ascending:false}).limit(1)]);const version=(versions?.[0]?.report_version||0)+1,path=`${String(edt.no_edt).replace(/[^a-zA-Z0-9_-]/g,'_')}/${Date.now()}-rapport-final-auto.pdf`,bytes=simpleEdtPdf(['GROUPE TOS - RAPPORT FINAL EDT',`EDT: ${edt.no_edt}`,`Client: ${edt.client||''}`,`Campagne / Communication: ${campaign?.nom_campagne||edt.campagne||''}`,`Requerant: ${contact.nom||''} - ${recipient}`,`Date debut: ${edt.date_debut||''}`,`Date de completion: ${edt.date_fin||new Date().toISOString().slice(0,10)}`,`Supports concernes: ${supportCount||0}`,`Photos pertinentes: ${photoCount||0}`,`Enjeux / ecarts: ${issueCount||0}`,'Statut final: Complete','Conclusion: travaux associes a l EDT completes.']);const{error:uploadError}=await admin.storage.from('final-reports').upload(path,bytes,{contentType:'application/pdf',upsert:false});if(uploadError)throw new Error('automatic_report_generation_failed');const{data:created,error:createError}=await admin.from('edt_reports').insert({edt_id:edt.id,report_version:version,status:'ready',storage_bucket:'final-reports',report_path:path,requester_contact_id:contact.id,generated_at:new Date().toISOString(),client_visible:Boolean(edt.client_visible)}).select().single();if(createError)throw new Error('automatic_report_record_failed');report=created}
   if(!job.manual_resend){const {data:sent}=await admin.from('email_delivery_log').select('id').eq('edt_id',edt.id).eq('event_type',EVENT).eq('report_version',report.report_version).eq('status','sent').eq('manual_resend',false).maybeSingle();if(sent){await admin.from('email_outbox').update({status:'sent',report_id:report.id,report_version:report.report_version,last_error:null,updated_at:new Date().toISOString()}).eq('id',job.id);results.push({id:job.id,status:'duplicate_skipped'});continue}}
   if(report.storage_bucket!=='final-reports')throw new Error('invalid_report_bucket');
   const portalUrl=Deno.env.get('CLIENT_PORTAL_URL');const canLink=Boolean(contact.auth_user_id&&report.status==='ready'&&report.client_visible&&portalUrl);
   let attachment:any=null;const bucket=report.storage_bucket;const path=report.report_path;
   if(!canLink&&bucket&&path){const {data:file,error:fileError}=await admin.storage.from(bucket).download(path);if(fileError||!file)throw new Error('report_file_unavailable');const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>ATTACHMENT_LIMIT)throw new Error('report_too_large_without_portal');attachment={name:`Rapport-final-${edt.no_edt}.pdf`,contentType:'application/pdf',contentBytes:base64(bytes)}}
   if(!canLink&&!attachment)throw new Error('report_delivery_unavailable');
   const name=esc(contact.nom||'');const number=esc(edt.no_edt);const client=esc(edt.client||'');const campaignName=esc(campaign?.nom_campagne||edt.campagne||'');const completed=esc(edt.date_fin||new Date().toISOString().slice(0,10));
   const link=canLink?`${portalUrl.replace(/\/$/,'')}/?section=reports`:'';
   const html=`<div style="font-family:Arial,sans-serif;color:#172033;max-width:640px;margin:auto"><div style="background:#172554;color:#fff;padding:24px"><h1 style="margin:0;font-size:22px">EDT complété</h1></div><div style="padding:24px;border:1px solid #dbe3ef"><p>Bonjour ${name},</p><p>L’EDT <strong>${number}</strong> est maintenant complété.</p><table style="width:100%;border-collapse:collapse"><tr><td>Client</td><td><strong>${client}</strong></td></tr><tr><td>Campagne / communication</td><td><strong>${campaignName}</strong></td></tr><tr><td>Date de complétion</td><td><strong>${completed}</strong></td></tr></table><p>Le rapport final est disponible ${canLink?`<a href="${esc(link)}" style="color:#1d4ed8">dans votre portail sécurisé</a>`:'en pièce jointe'}.</p><p>Merci,<br><strong>Groupe TOS</strong></p></div></div>`;
   const text=`Bonjour ${contact.nom||''},\n\nL’EDT ${edt.no_edt} est maintenant complété.\nClient : ${edt.client||''}\nCampagne / communication : ${campaign?.nom_campagne||edt.campagne||''}\nDate de complétion : ${edt.date_fin||new Date().toISOString().slice(0,10)}\n\nRapport final : ${canLink?link:'voir la pièce jointe'}\n\nMerci,\nGroupe TOS`;
   const message:any={subject:`EDT complété — ${edt.no_edt} — ${edt.client||campaign?.nom_campagne||''}`,body:{contentType:'HTML',content:html},toRecipients:[{emailAddress:{address:recipient}}],attachments:attachment?[{'@odata.type':'#microsoft.graph.fileAttachment',...attachment}]:[]};
   message.internetMessageHeaders=[{name:'X-TOS-Plain-Text',value:btoa(unescape(encodeURIComponent(text)))}];
   const providerId=await sendGraph(message);const now=new Date().toISOString();
   await admin.from('email_delivery_log').insert({outbox_id:job.id,event_type:EVENT,edt_id:edt.id,report_id:report.id,report_version:report.report_version,recipient_email:recipient,provider_message_id:providerId,status:'sent',attempt_count:attempt,sent_at:now,manual_resend:job.manual_resend});
   await admin.from('email_outbox').update({status:'sent',report_id:report.id,report_version:report.report_version,last_error:null,updated_at:now}).eq('id',job.id);
   results.push({id:job.id,status:'sent'});
  }catch(error){const message=error instanceof Error?error.message:String(error);const terminal=['Requérant sans adresse courriel','invalid_recipient_email','requester_client_mismatch','invalid_report_bucket','missing_final_report','report_delivery_unavailable','report_too_large_without_portal'].includes(message)||attempt>=MAX_ATTEMPTS;const next=new Date(Date.now()+Math.min(60,2**attempt)*60_000).toISOString();await admin.from('email_delivery_log').insert({outbox_id:job.id,event_type:EVENT,edt_id:job.edt_id,report_id:report?.id||null,report_version:report?.report_version||null,recipient_email:recipient||null,status:'failed',attempt_count:attempt,last_error:message.slice(0,500),manual_resend:job.manual_resend});await admin.from('email_outbox').update({status:'failed',report_id:report?.id||null,report_version:report?.report_version||null,last_error:message.slice(0,500),next_attempt_at:terminal?'9999-12-31T00:00:00Z':next,updated_at:new Date().toISOString()}).eq('id',job.id);results.push({id:job.id,status:'failed',error:message})}
 }
 return reply({processed:results.length,results});
});
