import { supabase, supabaseConfigured } from '../lib/supabaseClient';

const PAGE_SIZE = 1000;

async function fetchPage(tableName, from, to, attempt = 1) {
  const { data, error } = await supabase.from(tableName).select('*').range(from, to);
  if (!error) return Array.isArray(data) ? data : [];
  if (attempt >= 4) throw error;
  await new Promise(resolve => setTimeout(resolve, 500 * attempt));
  return fetchPage(tableName, from, to, attempt + 1);
}

export async function loadAllRows(tableName, pageSize = PAGE_SIZE) {
  const rows = [];
  for (let page = 0; page < 1000; page += 1) {
    const batch = await fetchPage(tableName, page * pageSize, page * pageSize + pageSize - 1);
    rows.push(...batch);
    console.log(`[TDM] ${tableName}: ${rows.length.toLocaleString('fr-CA')} ligne(s)`);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export async function loadTable(tableName, fallbackData = []) {
  if (!supabaseConfigured || !supabase) {
    return { rows: fallbackData, source: 'json', error: null, complete: true };
  }
  try {
    const rows = await loadAllRows(tableName);
    return { rows, source: 'supabase', error: null, complete: true };
  } catch (error) {
    console.warn(`[TDM] Fallback JSON pour ${tableName}:`, error.message);
    return { rows: fallbackData, source: 'json', error, complete: false };
  }
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
