import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import {readPhotoProjection} from './photoProjectionService';
import { prepareRecentBusinessActivity, RECENT_ACTIVITY_LIMIT } from '../lib/recentActivity.js';

const PAGE_SIZES = new Set([25,50,100,200]);
export function normalizeActivityPageSize(value) { return PAGE_SIZES.has(Number(value)) ? Number(value) : 50; }

export async function listActivityEvents({ page=1,pageSize=50,query='',filters={} }={}) {
  if (!supabaseConfigured || !supabase) throw new Error('Le journal centralisé est indisponible.');
  const size=normalizeActivityPageSize(pageSize),from=(Math.max(1,page)-1)*size;
  const criteria=Object.fromEntries(Object.entries({...filters,query}).filter(([,value])=>Boolean(value)));
  const {rows,total}=await readPhotoProjection('activity_events',criteria,from,size);
  return {rows,total,page:Math.max(1,page),pageSize:size};
}


export async function listRecentBusinessActivity() {
  if (!supabaseConfigured || !supabase) throw new Error('L’activité récente est indisponible.');
  const {rows}=await readPhotoProjection('activity_events',{recent:true},0,RECENT_ACTIVITY_LIMIT);
  return prepareRecentBusinessActivity(rows);
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
