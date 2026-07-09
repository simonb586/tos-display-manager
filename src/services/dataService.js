import { supabase, supabaseConfigured } from '../lib/supabaseClient';

export async function loadTable(tableName, fallbackData = []) {
  if (!supabaseConfigured || !supabase) {
    return { rows: fallbackData, source: 'json', error: null };
  }

  const { data, error } = await supabase.from(tableName).select('*');
  if (error) {
    console.warn(`[TDM] Supabase indisponible pour ${tableName}. Fallback JSON.`, error.message);
    return { rows: fallbackData, source: 'json', error };
  }

  return { rows: Array.isArray(data) ? data : fallbackData, source: 'supabase', error: null };
}

export async function loadManyTables(tableConfig) {
  const entries = await Promise.all(
    Object.entries(tableConfig).map(async ([label, cfg]) => {
      const result = await loadTable(cfg.table, cfg.fallback);
      return [label, { ...cfg, ...result }];
    })
  );

  return Object.fromEntries(entries);
}
