// Time-only business values retain their written wall-clock time, including ISO timestamps.
export function formatTimeHHMMSS(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? '' : [value.getHours(),value.getMinutes(),value.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');
  const match=String(value).trim().match(/^(?:\d{4}-\d{2}-\d{2}[T ])?(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  if (!match || Number(match[1])>23 || Number(match[2])>59 || Number(match[3]||0)>59) return '';
  return `${match[1].padStart(2,'0')}:${match[2]}:${match[3]||'00'}`;
}
export function isTimeOnlyColumn(column) {
  if (column?.type === 'time') return true;
  const key=String(column?.key||column?.id||column||'').toLowerCase();
  const label=String(column?.label||'').toLowerCase();
  const hourName=value=>!/date|timestamp|duration|duree/.test(value)&&/^(heure|time)([_\s]|$)|([_\s]heure|[_\s]time)$/.test(value);
  return hourName(key)||hourName(label);
}
export const formatBusinessValue = (value,column) => isTimeOnlyColumn(column) ? formatTimeHHMMSS(value) : value;
