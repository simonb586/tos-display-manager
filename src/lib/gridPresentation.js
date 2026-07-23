const compactPattern = /(^id$|_id$|num[eé]ro|support|edt|statut|status|date|quantit|total|progress|pourcent)/i;
const widePattern = /(description|comment|note|instruction|d[eé]tail|adresse|emplacement)/i;

export function defaultSortColumnForTable(tableName, columns = []) {
  const normalized = String(tableName || '').toLowerCase();
  const preferred = normalized.includes('infrastructure') ? ['support_id','no_support']
    : normalized.includes('campagne') ? ['nom_campagne','numero_campagne','name']
    : normalized.includes('visuel') || normalized.includes('affiche') ? ['nom_visuel','name']
    : normalized.includes('edt') ? ['numero_edt','no_edt','edt_number']
    : normalized.includes('bon') ? ['numero_bon','no_bt','reference']
    : normalized.includes('enjeu') ? ['date_declaration','created_at','id']
    : normalized.includes('photo') ? ['prise_le','created_at']
    : normalized.includes('historique') ? ['date','changed_at','created_at']
    : normalized.includes('automatisation') || normalized.includes('vue') ? ['name','nom']
    : [];
  return preferred.find(candidate => columns.includes(candidate)) || columns[0] || '';
}

export function adaptiveColumnWidth(rows, column, label = '') {
  const values = (rows || []).slice(0, 100).map(row => String(row?.[column] ?? ''));
  const longest = Math.max(String(label || column).length, ...values.map(value => value.length), 8);
  const key = `${column} ${label}`;
  const min = compactPattern.test(key) ? 110 : 140;
  const max = widePattern.test(key) ? 360 : 260;
  return Math.max(min, Math.min(max, longest * 8 + 34));
}
