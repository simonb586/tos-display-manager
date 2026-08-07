import { supabase, supabaseConfigured } from '../lib/supabaseClient';

const PAGE_SIZES = new Set([25,50,100,200]);
export function normalizeActivityPageSize(value) { return PAGE_SIZES.has(Number(value)) ? Number(value) : 50; }

export async function listActivityEvents({ page=1,pageSize=50,query='',filters={} }={}) {
  if (!supabaseConfigured || !supabase) throw new Error('Le journal centralisé est indisponible.');
  const size=normalizeActivityPageSize(pageSize),from=(Math.max(1,page)-1)*size;
  let request=supabase.from('activity_events').select('*',{count:'exact'});
  if(query) request=request.or(`action.ilike.%${query}%,actor_email.ilike.%${query}%,entity_id.ilike.%${query}%,support_id.ilike.%${query}%`);
  for(const [field,value] of Object.entries(filters)) if(value&&!['date_from','date_to'].includes(field)) request=request.eq(field,value);
  if(filters.date_from) request=request.gte('occurred_at',`${filters.date_from}T00:00:00`);
  if(filters.date_to) request=request.lte('occurred_at',`${filters.date_to}T23:59:59.999`);
  const {data,error,count}=await request.order('occurred_at',{ascending:false}).order('id',{ascending:false}).range(from,from+size-1);
  if(error) throw error;
  return {rows:data||[],total:count||0,page:Math.max(1,page),pageSize:size};
}

export async function recordActivityEvent(event) {
  if (!event?.action || !event?.module || !event?.sourceRecordId || !event?.occurredAt) throw new Error('Événement non traçable refusé.');
  if (!['exact','derived'].includes(event.confidence)) throw new Error('Événement de confiance inconnue refusé.');
  const {data:{user}}=await supabase.auth.getUser();
  const row={occurred_at:event.occurredAt,actor_id:user?.id||null,actor_email:event.actorEmail||user?.email||null,actor_role:event.actorRole||null,action:event.action,module:event.module,entity_type:event.entityType||null,entity_id:event.entityId||null,old_value:event.oldValue||null,new_value:event.newValue||null,campaign_id:event.campaignId||null,edt_id:event.edtId||null,support_id:event.supportId||null,client_id:event.clientId||null,source:event.source,source_system:event.source,source_record_id:String(event.sourceRecordId),source_occurred_at:event.occurredAt,reconstruction_method:event.confidence==='exact'?'direct':'derived',confidence:event.confidence,status:event.status||null,metadata:event.metadata||{}};
  const {data,error}=await supabase.from('activity_events').insert(row).select().single();
  if(error?.code==='23505') return {duplicate:true};
  if(error) throw error;
  return data;
}
