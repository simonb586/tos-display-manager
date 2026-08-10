import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export const EMPTY_FILTER_VALUE = '__TDM_EMPTY__';

export function gridFilterValue(value) {
  return value === null || value === undefined || value === '' ? EMPTY_FILTER_VALUE : String(value);
}

export function matchesGridFilters(row, filters) {
  return Object.entries(filters || {}).every(([column, selected]) =>
    !selected?.length || selected.includes(gridFilterValue(row?.[column]))
  );
}

export default function DataGridColumnFilter({ column, label, rows, selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef(null);
  const options = useMemo(() => {
    const values = new Map();
    (rows || []).forEach(row => {
      const value = gridFilterValue(row?.[column]);
      if (!values.has(value)) values.set(value, value === EMPTY_FILTER_VALUE ? 'Valeur vide' : value);
    });
    return [...values].map(([value, text]) => ({ value, text })).sort((a, b) =>
      new Intl.Collator('fr-CA', { numeric: true, sensitivity: 'base' }).compare(a.text, b.text)
    );
  }, [rows, column]);
  const visible = useMemo(() => options.filter(option => option.text.toLocaleLowerCase('fr-CA').includes(query.toLocaleLowerCase('fr-CA'))), [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const close = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  const toggle = value => onChange(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
  const allVisibleSelected = visible.length > 0 && visible.every(option => selected.includes(option.value));
  const toggleVisible = () => onChange(allVisibleSelected
    ? selected.filter(value => !visible.some(option => option.value === value))
    : [...new Set([...selected, ...visible.map(option => option.value)])]);

  return <div className="grid-filter" ref={root}>
    <button type="button" className={selected.length ? 'grid-filter-trigger active' : 'grid-filter-trigger'} aria-label={`Filtrer ${label}${selected.length ? `, ${selected.length} valeur(s)` : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span>{selected.length ? `${label} (${selected.length})` : label}</span><ChevronDown size={15}/>
    </button>
    {open && <div className="grid-filter-dropdown" role="dialog" aria-label={`Options de filtre ${label}`}>
      {options.length > 8 && <label className="grid-filter-search"><Search size={14}/><span className="sr-only">Rechercher dans {label}</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher..."/></label>}
      <div className="grid-filter-actions"><label><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible}/> Tout sélectionner</label><button type="button" disabled={!selected.length} onClick={() => onChange([])}><X size={13}/> Effacer</button></div>
      <div className="grid-filter-options" role="group" aria-label={`Valeurs de ${label}`}>
        {visible.map(option => <label key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)}/><span title={option.text}>{option.text}</span></label>)}
        {!visible.length && <p>Aucune valeur.</p>}
      </div>
    </div>}
  </div>;
}
