import React from 'react';
import {
  ArrowDownAZ,
  ArrowDownNarrowWide,
  ArrowUpAZ,
  ArrowUpNarrowWide,
  RotateCcw
} from 'lucide-react';
import { defaultSortForColumn } from '../lib/gridSorting';

export default function SortMenuSection({
  rows,
  column,
  sortState,
  onSort,
  onReset
}) {
  const active = sortState?.column === column
    ? sortState
    : defaultSortForColumn(rows || [], column);
  const numeric = ['number', 'date'].includes(active.type);

  const apply = patch => onSort({ ...active, ...patch, column });

  return <section className="column-sort-section">
    <strong>Trier cette colonne</strong>
    <small>Type détecté : {active.type}</small>
    <div className="column-sort-actions">
      <button type="button" className={sortState?.column === column && sortState.direction === 'asc' ? 'active' : ''} onClick={() => apply({direction:'asc'})}>
        {numeric ? <ArrowUpNarrowWide size={16}/> : <ArrowUpAZ size={16}/>}
        {active.type === 'date' ? 'Plus ancienne d’abord' : 'Croissant'}
      </button>
      <button type="button" className={sortState?.column === column && sortState.direction === 'desc' ? 'active' : ''} onClick={() => apply({direction:'desc'})}>
        {numeric ? <ArrowDownNarrowWide size={16}/> : <ArrowDownAZ size={16}/>}
        {active.type === 'date' ? 'Plus récente d’abord' : 'Décroissant'}
      </button>
    </div>
    <div className="column-empty-actions">
      <button type="button" className={sortState?.column === column && sortState.emptyPlacement === 'first' ? 'active' : ''} onClick={() => apply({emptyPlacement:'first'})}>Vides en premier</button>
      <button type="button" className={sortState?.column === column && sortState.emptyPlacement === 'last' ? 'active' : ''} onClick={() => apply({emptyPlacement:'last'})}>Vides en dernier</button>
    </div>
    <button type="button" className="column-sort-reset" disabled={sortState?.column !== column} onClick={onReset}><RotateCcw size={15}/> Réinitialiser le tri</button>
  </section>;
}
