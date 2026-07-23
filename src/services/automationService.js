import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { listAvailableTablesAndFields } from './schemaService';
import { friendlyError } from '../config/businessLanguage';

function ready() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Le service de configuration est momentanément indisponible.');
  }
}

export async function listAutomationDefinitions() {
  ready();
  const { data, error } = await supabase
    .from('automation_definitions')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(friendlyError(error, 'Impossible de charger les automatisations.'));
  return (data || []).filter(item => item.definition?.kind !== 'cross_module_view');
}

export async function loadAutomationSchema() {
  return listAvailableTablesAndFields();
}

export async function saveAutomationDefinition(automation) {
  ready();
  const requestedStatus = automation.status || 'draft';
  const status = requestedStatus === 'active' ? 'pending_validation' : requestedStatus;
  const payload = {
    name: automation.name.trim(),
    status,
    priority: automation.priority || 'normal',
    definition: {
      kind: 'automation',
      description: automation.description || automation.definition?.description || '',
      ...automation.definition
    },
    schema_version: 1,
    updated_at: new Date().toISOString()
  };
  if (!payload.name) throw new Error('Le nom de l’automatisation est obligatoire.');
  if (!payload.definition?.triggers?.length) throw new Error('Sélectionnez au moins un déclencheur.');
  if (!payload.definition?.targets?.length) throw new Error('Sélectionnez au moins un module à mettre à jour.');
  const query = automation.id
    ? supabase.from('automation_definitions').update(payload).eq('id', automation.id)
    : supabase.from('automation_definitions').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw new Error(friendlyError(error, 'Impossible d’enregistrer cette automatisation.'));
  return data;
}

export async function duplicateAutomationDefinition(automation) {
  return saveAutomationDefinition({
    name: `${automation.name} — copie`,
    description: automation.description || automation.definition?.description || '',
    status: 'draft',
    priority: automation.priority,
    definition: structuredClone(automation.definition)
  });
}

export async function approveAutomationDefinition(id) {
  ready();
  const { data, error } = await supabase.rpc('approve_automation_definition_v0131', { p_automation_id: id });
  if (error) throw new Error(friendlyError(error, 'Impossible d’activer cette automatisation.'));
  return data;
}

export async function deactivateAutomationDefinition(id) {
  ready();
  const { data, error } = await supabase
    .from('automation_definitions')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(friendlyError(error, 'Impossible de désactiver cette automatisation.'));
  return data;
}

export async function deleteAutomationDefinition(id) {
  ready();
  const { error } = await supabase.from('automation_definitions').delete().eq('id', id);
  if (error) throw new Error(friendlyError(error, 'Impossible de supprimer cette automatisation.'));
  const { data:remaining, error:verifyError } = await supabase.from('automation_definitions').select('id').eq('id',id).maybeSingle();
  if (verifyError) throw new Error(friendlyError(verifyError, 'Impossible de confirmer la suppression.'));
  if (remaining) throw new Error('La configuration existe toujours après la suppression. Réessayez ou communiquez avec un administrateur.');
}
