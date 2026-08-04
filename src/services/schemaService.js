import { supabase, supabaseConfigured } from '../lib/supabaseClient.js';
import {
  groupSchemaFieldNames,
  groupSchemaMetadata
} from '../lib/schemaMetadata.js';

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }
}

// Contrat historique conservé pour le Studio des relations et ses consommateurs.
export async function listAvailableTablesAndFields() {
  ensureSupabase();
  const { data, error } = await supabase.rpc('list_public_schema_fields');
  if (error) throw error;
  return groupSchemaFieldNames(data || []);
}

// Nouveau contrat 13.1-A1. Il conserve les propriétés physiques sans les interpréter.
export async function listAvailableSchemaMetadata() {
  ensureSupabase();
  const { data, error } = await supabase.rpc('list_public_schema_fields_v0131a');
  if (error) throw error;
  return groupSchemaMetadata(data || []);
}
