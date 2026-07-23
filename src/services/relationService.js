import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { listAvailableTablesAndFields } from './schemaService';

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }
}

const humanize = value => String(value || '')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, letter => letter.toUpperCase());

export async function listRelationFields() {
  ensureSupabase();
  const { data, error } = await supabase
    .from('relation_fields')
    .select('*')
    .order('table_name')
    .order('field_name');

  if (error) throw error;
  return data || [];
}

export async function listRelationRules() {
  ensureSupabase();
  const { data, error } = await supabase
    .from('relation_rules')
    .select('*')
    .order('source_table')
    .order('source_field');

  if (error) throw error;
  return data || [];
}

export async function loadCompleteRelationCatalog() {
  ensureSupabase();

  const [schema, configuredFields, rules] = await Promise.all([
    listAvailableTablesAndFields(),
    listRelationFields(),
    listRelationRules()
  ]);

  const configuredMap = new Map(
    configuredFields.map(field => [
      `${field.table_name}.${field.field_name}`,
      field
    ])
  );

  const catalogFields = [];

  for (const tableName of Object.keys(schema).sort((a, b) => a.localeCompare(b, 'fr-CA'))) {
    for (const fieldName of [...schema[tableName]].sort((a, b) => a.localeCompare(b, 'fr-CA'))) {
      const configured = configuredMap.get(`${tableName}.${fieldName}`);

      catalogFields.push(configured || {
        id: `virtual:${tableName}.${fieldName}`,
        module_name: humanize(tableName),
        table_name: tableName,
        field_name: fieldName,
        field_label: humanize(fieldName),
        is_primary_source: true,
        source_table: null,
        source_field: null,
        triggers_updates: false,
        visible_terrain: false,
        terrain_roles: [],
        terrain_section: null,
        terrain_readonly: true,
        validation_status: 'Non configuré',
        is_virtual: true
      });
    }
  }

  return {
    schema,
    fields: catalogFields,
    rules
  };
}

export async function synchronizeRelationCatalog() {
  ensureSupabase();
  const schema = await listAvailableTablesAndFields();

  const payload = [];

  for (const [tableName, fieldNames] of Object.entries(schema)) {
    for (const fieldName of fieldNames) {
      payload.push({
        module_name: humanize(tableName),
        table_name: tableName,
        field_name: fieldName,
        field_label: humanize(fieldName),
        is_primary_source: true,
        triggers_updates: false,
        visible_terrain: false,
        terrain_roles: [],
        terrain_readonly: true,
        validation_status: 'À confirmer',
        updated_at: new Date().toISOString()
      });
    }
  }

  if (!payload.length) return [];

  const { data, error } = await supabase
    .from('relation_fields')
    .upsert(payload, {
      onConflict: 'table_name,field_name',
      ignoreDuplicates: true
    })
    .select();

  if (error) throw error;
  return data || [];
}

export async function saveRelationField(field) {
  ensureSupabase();

  const payload = {
    module_name: field.module_name || humanize(field.table_name),
    table_name: field.table_name,
    field_name: field.field_name,
    field_label: field.field_label || humanize(field.field_name),
    is_primary_source: Boolean(field.is_primary_source),
    source_table: field.is_primary_source ? null : (field.source_table || null),
    source_field: field.is_primary_source ? null : (field.source_field || null),
    triggers_updates: Boolean(field.triggers_updates),
    visible_terrain: Boolean(field.visible_terrain),
    terrain_roles: field.terrain_roles || [],
    terrain_section: field.terrain_section || null,
    terrain_readonly: field.terrain_readonly !== false,
    validation_status: field.validation_status === 'Non configuré'
      ? 'À confirmer'
      : (field.validation_status || 'À confirmer'),
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
    source_module: rule.source_module || humanize(rule.source_table),
    source_table: rule.source_table,
    source_field: rule.source_field,
    destination_module: rule.destination_module || humanize(rule.destination_table),
    destination_table: rule.destination_table,
    destination_field: rule.destination_field,
    enabled: rule.enabled !== false,
    create_history: Boolean(rule.create_history),
    requires_confirmation: Boolean(rule.requires_confirmation),
    condition_json: rule.condition_json || {},
    confidence: rule.confidence || 'Manuelle',
    validation_status: rule.validation_status || 'À confirmer',
    propagation_mode: rule.propagation_mode || 'automatique',
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

export async function inspectRelationDependencies(rule) {
  ensureSupabase();
  const { data, error } = await supabase.from('automation_definitions').select('id,name,definition,status');
  if (error) throw error;
  const tokens=[rule?.id,rule?.source_table,rule?.source_field,rule?.destination_table,rule?.destination_field].filter(Boolean).map(String);
  const dependencies=(data||[]).filter(item=>{
    const content=JSON.stringify(item.definition||{});
    return tokens.some(token=>content.includes(token));
  });
  return {
    automations:dependencies.filter(item=>item.definition?.kind!=='cross_module_view'),
    views:dependencies.filter(item=>item.definition?.kind==='cross_module_view')
  };
}

export async function deleteRelationRule(rule) {
  ensureSupabase();
  const dependencies=await inspectRelationDependencies(rule);
  if(dependencies.automations.length||dependencies.views.length){
    const error=new Error(`Cette relation est utilisée par ${dependencies.views.length} vue(s) et ${dependencies.automations.length} automatisation(s). Retirez d’abord ces dépendances.`);
    error.dependencies=dependencies;
    throw error;
  }
  const { error } = await supabase
    .from('relation_rules')
    .delete()
    .eq('id', rule.id);

  if (error) throw error;
  const {data:remaining,error:verifyError}=await supabase.from('relation_rules').select('id').eq('id',rule.id).maybeSingle();
  if(verifyError)throw verifyError;
  if(remaining)throw new Error('La relation existe toujours après la suppression.');
}

export async function testRelationRule(rule) {
  ensureSupabase();

  if (!rule.id) {
    return {
      message: 'Enregistre d’abord cette relation avant de lancer un test.'
    };
  }

  const { data, error } = await supabase.rpc('test_relation_rule', {
    p_rule_id: rule.id
  });

  if (error) throw error;
  return data;
}

export async function executeRelationRule(ruleId, sourceRecord, dryRun = false) {
  ensureSupabase();
  const { data, error } = await supabase.rpc('executer_relation_rule_v0129', {
    p_rule_id: ruleId, p_source_record: sourceRecord, p_dry_run: dryRun
  });
  if (error) throw error;
  return data;
}

export async function installRelationTriggers() {
  ensureSupabase();
  const { data, error } = await supabase.rpc('installer_declencheurs_relations_v0129');
  if (error) throw error;
  return data;
}
