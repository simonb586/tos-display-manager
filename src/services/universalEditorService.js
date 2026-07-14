import { supabase, supabaseConfigured } from '../lib/supabaseClient';

const SYSTEM_FIELDS = new Set([
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'raw_data'
]);

export function editableColumns(row, visibleColumns = []) {
  const columns = visibleColumns.length ? visibleColumns : Object.keys(row || {});
  return columns.filter(column => !SYSTEM_FIELDS.has(column));
}

export function inferInputType(value, columnName = '') {
  const name = String(columnName).toLowerCase();

  if (typeof value === 'boolean') return 'boolean';
  if (name.includes('date') || name.endsWith('_le') || name.endsWith('_at')) return 'date';
  if (
    name.includes('comment') ||
    name.includes('description') ||
    name.includes('enjeu') ||
    name.includes('adresse') ||
    String(value ?? '').length > 120
  ) return 'textarea';
  if (typeof value === 'number') return 'number';
  return 'text';
}

export function primaryKeyFor(config, row) {
  const candidates = [
    config?.idField,
    'id',
    'support_id',
    'no_arret',
    'record_id',
    'uuid'
  ].filter(Boolean);

  const field = candidates.find(candidate =>
    Object.prototype.hasOwnProperty.call(row || {}, candidate) &&
    row?.[candidate] !== null &&
    row?.[candidate] !== undefined &&
    String(row?.[candidate]) !== ''
  );

  if (!field) {
    throw new Error(
      `Impossible d’identifier la ligne. Ajoute idField à la configuration de la table ${config?.table || ''}.`
    );
  }

  return { field, value: row[field] };
}

function cleanChanges(changes) {
  return Object.fromEntries(
    Object.entries(changes || {})
      .filter(([column]) => !SYSTEM_FIELDS.has(column))
      .map(([column, value]) => [column, value === '' ? null : value])
  );
}

export async function updateUniversalRow({ config, originalRow, changes }) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré. Les modifications ne peuvent pas être enregistrées.');
  }

  const payload = cleanChanges(changes);
  if (!Object.keys(payload).length) return originalRow;

  const key = primaryKeyFor(config, originalRow);

  const { data, error } = await supabase
    .from(config.table)
    .update(payload)
    .eq(key.field, key.value)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUniversalRows({ config, entries, onProgress }) {
  const updated = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const result = await updateUniversalRow({
      config,
      originalRow: entry.originalRow,
      changes: entry.changes
    });
    updated.push(result);
    onProgress?.(index + 1, entries.length);
  }

  return updated;
}

export async function loadAutomaticFieldRules(tableName) {
  if (!supabaseConfigured || !supabase) return {};

  const { data, error } = await supabase
    .from('relation_fields')
    .select('field_name,is_primary_source,triggers_updates,source_table,source_field')
    .eq('table_name', tableName);

  if (error) {
    console.warn('[TDM] Règles automatiques non disponibles:', error.message);
    return {};
  }

  return Object.fromEntries((data || []).map(rule => [rule.field_name, rule]));
}

export async function loadAdminChangeLog(limit = 300) {
  if (!supabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('admin_change_log')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
