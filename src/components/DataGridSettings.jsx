import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Columns3, RotateCcw } from 'lucide-react';
const keyFor = gridId => `tdm-grid-preferences:v126:${gridId}`;
const read = gridId => { if (typeof localStorage === 'undefined') return {}; try { return JSON.parse(localStorage.getItem(keyFor(gridId))) || {}; } catch { return {}; } };
export function useDataGridSettings(gridId, availableColumns) {
  const signature = availableColumns.join('|');
  const [preferences, setPreferences] = useState(() => read(gridId));
  useEffect(() => setPreferences(read(gridId)), [gridId]);
  useEffect(() => { if (typeof localStorage !== 'undefined') localStorage.setItem(keyFor(gridId), JSON.stringify(preferences)); }, [gridId, preferences]);
  const columns = useMemo(() => { const order = [...(preferences.order || []).filter(column => availableColumns.includes(column)), ...availableColumns.filter(column => !(preferences.order || []).includes(column))]; return order.filter(column => !(preferences.hidden || []).includes(column)); }, [preferences, signature]);
  const reset = () => { if (typeof localStorage !== 'undefined') localStorage.removeItem(keyFor(gridId)); setPreferences({}); };
  return { columns, widths: preferences.widths || {}, preferences, setPreferences, reset };
}
export default function DataGridSettings({ gridId, columns, labels, preferences, setPreferences, onReset }) {
  const [open, setOpen] = useState(false);
  const order = [...(preferences.order || []).filter(column => columns.includes(column)), ...columns.filter(column => !(preferences.order || []).includes(column))];
  const move = (column, delta) => setPreferences(current => { const next = [...order]; const index = next.indexOf(column); const target = index + delta; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, order: next }; });
  const hide = (column, hidden) => setPreferences(current => ({ ...current, hidden: hidden ? [...new Set([...(current.hidden || []), column])] : (current.hidden || []).filter(value => value !== column) }));
  const width = (column, value) => setPreferences(current => ({ ...current, widths: { ...(current.widths || {}), [column]: Number(value) } }));
  return <div className="grid-settings"><button type="button" onClick={() => setOpen(true)}><Columns3/> Modifier la grille</button>{open && <div className="grid-settings-backdrop" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><section role="dialog" aria-modal="true" aria-label={`Modifier la grille ${gridId}`}><header><div><h2>Modifier la grille</h2><small>Préférences propres à cette table.</small></div><button type="button" aria-label="Fermer" onClick={() => setOpen(false)}>×</button></header><div className="grid-settings-list">{order.map((column, index) => <div key={column}><label><input type="checkbox" checked={!(preferences.hidden || []).includes(column)} onChange={event => hide(column, !event.target.checked)}/><span>{labels[column] || column}</span></label><label>Largeur <input type="number" min="100" max="480" step="10" value={preferences.widths?.[column] || 160} onChange={event => width(column, event.target.value)}/></label><button aria-label={`Monter ${labels[column] || column}`} disabled={!index} onClick={() => move(column, -1)}><ArrowUp/></button><button aria-label={`Descendre ${labels[column] || column}`} disabled={index === order.length - 1} onClick={() => move(column, 1)}><ArrowDown/></button></div>)}</div><footer><button type="button" onClick={onReset}><RotateCcw/> Réinitialiser la grille</button><button type="button" onClick={() => setOpen(false)}>Terminer</button></footer></section></div>}</div>;
}
