const naturalCollator = new Intl.Collator('fr-CA', {
  numeric: true,
  sensitivity: 'base'
});

export const isEmptySortValue = value =>
  value === null || value === undefined ||
  (typeof value === 'string' && value.trim() === '');

export function parseNumericSortValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const source = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/%$/, '')
    .replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(source)) return null;
  const parsed = Number(source);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDateSortValue(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.valueOf();
  const source = String(value ?? '').trim();
  if (!source) return null;

  let match = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (match) {
    const parsed = Date.parse(source.length === 10 ? `${source}T00:00:00` : source);
    return Number.isNaN(parsed) ? null : parsed;
  }

  match = source.match(/^(\d{2})[/-](\d{2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = match;
    const parsed = new Date(
      Number(year), Number(month) - 1, Number(day),
      Number(hour), Number(minute), Number(second)
    );
    if (
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day)
    ) return parsed.valueOf();
  }

  return null;
}

export function inferColumnSortType(rows, column, configuredType) {
  if (configuredType) return configuredType;
  const name = String(column || '').toLowerCase();
  if (
    name === 'id' || name.endsWith('_id') || name.startsWith('no_') ||
    name.includes('identifiant') || name.includes('référence') ||
    name.includes('reference')
  ) return 'identifier';
  if (
    name.includes('date') || name.endsWith('_at') || name.endsWith('_le') ||
    name.includes('created') || name.includes('updated')
  ) return 'date';
  if (
    name.includes('quantit') || name.includes('progress') ||
    name.includes('avancement') || name.includes('nombre') ||
    name.includes('total') || name.includes('pourcent')
  ) return 'number';

  const sample = rows
    .map(row => row?.[column])
    .filter(value => !isEmptySortValue(value))
    .slice(0, 60);
  if (!sample.length) return 'text';
  if (sample.every(value => typeof value === 'boolean')) return 'boolean';

  const numericRatio = sample.filter(value => parseNumericSortValue(value) !== null).length / sample.length;
  if (numericRatio >= .9) return 'number';
  const dateRatio = sample.filter(value => parseDateSortValue(value) !== null).length / sample.length;
  if (dateRatio >= .9) return 'date';
  if (sample.some(value => /\d/.test(String(value))) && sample.some(value => /[a-z]/i.test(String(value)))) {
    return 'identifier';
  }
  return 'text';
}

function compareValues(left, right, type) {
  if (type === 'number') {
    const a = parseNumericSortValue(left);
    const b = parseNumericSortValue(right);
    if (a !== null && b !== null) return a - b;
  }
  if (type === 'date') {
    const a = parseDateSortValue(left);
    const b = parseDateSortValue(right);
    if (a !== null && b !== null) return a - b;
  }
  if (type === 'boolean') return Number(Boolean(left)) - Number(Boolean(right));
  return naturalCollator.compare(String(left ?? ''), String(right ?? ''));
}

export function sortRows(rows, sortState) {
  if (!sortState?.column) return [...rows];
  const direction = sortState.direction === 'desc' ? -1 : 1;
  const emptyPlacement = sortState.emptyPlacement === 'first' ? -1 : 1;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = left.row?.[sortState.column];
      const b = right.row?.[sortState.column];
      const aEmpty = isEmptySortValue(a);
      const bEmpty = isEmptySortValue(b);
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return left.index - right.index;
        return aEmpty ? emptyPlacement : -emptyPlacement;
      }
      const compared = compareValues(a, b, sortState.type || 'text');
      return compared === 0 ? left.index - right.index : compared * direction;
    })
    .map(item => item.row);
}

export function defaultSortForColumn(rows, column, configuredType) {
  return {
    column,
    type: inferColumnSortType(rows, column, configuredType),
    direction: 'asc',
    emptyPlacement: 'last'
  };
}
