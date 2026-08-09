import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { getSignedPhotoUrls } from './photoAccessService';

export async function listSupportPhotosForValidation() {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('support_photos')
    .select('*')
    .order('prise_le', { ascending: false })
    .limit(50);
  if (error) throw error;
  return getSignedPhotoUrls(data || [], { purpose:'preview' });
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
