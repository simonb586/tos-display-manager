import { supabase, supabaseConfigured } from '../lib/supabaseClient';

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase n’est pas configuré.');
}

export async function listRelationFields() {
  ensureSupabase();
  const { data, error } = await supabase
    .from('relation_fields')
    .select('*')
    .order('module_name')
    .order('field_label');
  if (error) throw error;
  return data || [];
}

export async function listRelationRules() {
  ensureSupabase();
  const { data, error } = await supabase
    .from('relation_rules')
    .select('*')
    .order('source_module')
    .order('source_field');
  if (error) throw error;
  return data || [];
}

export async function saveRelationField(field) {
  ensureSupabase();
  const payload = {
    module_name: field.module_name,
    table_name: field.table_name,
    field_name: field.field_name,
    field_label: field.field_label || field.field_name,
    is_primary_source: Boolean(field.is_primary_source),
    source_table: field.is_primary_source ? null : (field.source_table || null),
    source_field: field.is_primary_source ? null : (field.source_field || null),
    triggers_updates: Boolean(field.triggers_updates),
    visible_terrain: Boolean(field.visible_terrain),
    terrain_roles: field.terrain_roles || [],
    terrain_section: field.terrain_section || null,
    terrain_readonly: field.terrain_readonly !== false,
    validation_status: field.validation_status || 'À confirmer',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('relation_fields')
    .upsert(payload, { onConflict: 'table_name,field_name' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveRelationRule(rule) {
  ensureSupabase();
  const payload = {
    source_module: rule.source_module,
    source_table: rule.source_table,
    source_field: rule.source_field,
    destination_module: rule.destination_module,
    destination_table: rule.destination_table,
    destination_field: rule.destination_field,
    enabled: rule.enabled !== false,
    create_history: Boolean(rule.create_history),
    requires_confirmation: Boolean(rule.requires_confirmation),
    condition_json: rule.condition_json || {},
    confidence: rule.confidence || 'Manuelle',
    validation_status: rule.validation_status || 'À confirmer',
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from('relation_rules')
    .upsert(payload, {
      onConflict: 'source_table,source_field,destination_table,destination_field'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function testRelationRule(rule) {
  ensureSupabase();
  const { data, error } = await supabase.rpc('test_relation_rule', { p_rule_id: rule.id });
  if (error) throw error;
  return data;
}
