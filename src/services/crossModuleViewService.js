import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { friendlyError } from '../config/businessLanguage';

function ready() {
  if (!supabaseConfigured || !supabase) throw new Error('Le service de configuration est momentanément indisponible.');
}

const fromRow = row => {
  const definition = row.definition || {};
  return {
    id: row.id, name: row.name, status: row.status, priority: row.priority,
    updated_at: row.updated_at, description: definition.description || '',
    source: definition.source || '', destination: definition.destination || '',
    fields: definition.fields || [], locations: definition.locations || [],
    mode: definition.mode || 'readonly', conditions: definition.conditions || [],
    conditionMode: definition.conditionMode || 'all'
  };
};

export async function listCrossModuleViews() {
  ready();
  const { data, error } = await supabase.from('automation_definitions').select('*').order('updated_at', { ascending: false });
  if (error) throw new Error(friendlyError(error, 'Impossible de charger les vues configurées.'));
  return (data || []).filter(item => item.definition?.kind === 'cross_module_view').map(fromRow);
}

export async function saveCrossModuleView(view) {
  ready();
  if (!view.name?.trim() || !view.source || !view.destination) {
    throw new Error('Le nom, la provenance et l’emplacement d’affichage sont obligatoires.');
  }
  if (!view.fields?.length) throw new Error('Sélectionnez au moins un champ à afficher.');
  const payload = {
    name: view.name.trim(),
    status: view.status === 'active' ? 'draft' : (view.status || 'draft'),
    priority: view.priority || 'normal',
    definition: {
      kind: 'cross_module_view', description: view.description || '',
      source: view.source, destination: view.destination, fields: view.fields || [],
      locations: view.locations || [], mode: view.mode || 'readonly',
      conditions: view.conditions || [], conditionMode: view.conditionMode || 'all'
    },
    schema_version: 1,
    updated_at: new Date().toISOString()
  };
  const query = view.id
    ? supabase.from('automation_definitions').update(payload).eq('id', view.id)
    : supabase.from('automation_definitions').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw new Error(friendlyError(error, 'Impossible d’enregistrer cette vue.'));
  return fromRow(data);
}

export async function setCrossModuleViewStatus(id, status) {
  ready();
  const { data, error } = await supabase.from('automation_definitions')
    .update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw new Error(friendlyError(error, 'Impossible de modifier l’état de cette vue.'));
  return fromRow(data);
}

export async function deleteCrossModuleView(id) {
  ready();
  const { error } = await supabase.from('automation_definitions').delete().eq('id', id);
  if (error) throw new Error(friendlyError(error, 'Impossible de supprimer cette vue.'));
  const { data:remaining, error:verifyError } = await supabase.from('automation_definitions').select('id').eq('id',id).maybeSingle();
  if (verifyError) throw new Error(friendlyError(verifyError, 'Impossible de confirmer la suppression.'));
  if (remaining) throw new Error('La vue existe toujours après la suppression. Réessayez ou communiquez avec un administrateur.');
}
