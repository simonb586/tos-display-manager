import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import {allPhotoProjectionRows,readPhotoProjection} from './photoProjectionService';

export async function countSupportPhotos() {
  if (!supabaseConfigured || !supabase) throw new Error('Service photo indisponible.');
  return (await readPhotoProjection('support_photos',{deleted_at:null},0,1)).total;
}

export async function listSupportPhotosForValidation() {
  if (!supabaseConfigured || !supabase) return [];
  const photos=await allPhotoProjectionRows('support_photos',{deleted_at:null});
  const campaignIds=[...new Set(photos.map(p=>p.campagne_id).filter(Boolean))],visualIds=[...new Set(photos.map(p=>p.visuel_id).filter(Boolean))];
  const [campaigns,visuals]=await Promise.all([
    campaignIds.length?supabase.from('campagnes_maitres').select('id,nom_campagne,business_context').in('id',campaignIds):{data:[]},
    visualIds.length?supabase.from('campagne_visuels_formats').select('id,nom_visuel').in('id',visualIds):{data:[]}
  ]);
  if(campaigns.error)throw campaigns.error;if(visuals.error)throw visuals.error;
  const campaignById=new Map(campaigns.data.map(c=>[String(c.id),c])),visualById=new Map(visuals.data.map(v=>[String(v.id),v]));
  const edts=[];
  for(let offset=0;;offset+=500){const {data,error}=await supabase.from('suivi_des_edt').select('id,no_edt').order('id').range(offset,offset+499);if(error)throw error;edts.push(...data);if(data.length<500)break;}
  const byId=new Map(edts.map(e=>[String(e.id),e.no_edt]));
  return photos.map(p=>({...p,campagne:campaignById.get(String(p.campagne_id)),visuel:visualById.get(String(p.visuel_id)),edt_number:byId.get(String(p.edt_id))||p.metadata?.edt_number||null}));
}

export async function validateSupportPhoto(id, status, comment = '') {
  const payload = {
    statut_validation: status,
    commentaire_validation: comment || null,
    validee_le: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('support_photos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function makePrimaryPhoto(photo) {
  const { error: clearError } = await supabase
    .from('support_photos')
    .update({ est_principale: false })
    .eq('support_id', photo.support_id);

  if (clearError) throw clearError;

  const { data, error } = await supabase
    .from('support_photos')
    .update({
      est_principale: true,
      statut_validation: 'Validée',
      validee_le: new Date().toISOString()
    })
    .eq('id', photo.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listInventoryMovements() {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;
  return data || [];
}

export async function createInventoryMovement(payload) {
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      visual_id: payload.visual_id || null,
      item_reference: payload.item_reference || '',
      movement_type: payload.movement_type,
      quantity: Number(payload.quantity || 0),
      edt_number: payload.edt_number || '',
      support_id: payload.support_id || '',
      notes: payload.notes || ''
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
