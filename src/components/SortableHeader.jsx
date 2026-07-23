import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, X } from 'lucide-react';
import SortMenuSection from './SortMenuSection';

export default function SortableHeader({
  label,
  column,
  rows,
  sortState,
  onSort,
  onReset,
  children
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const active = sortState?.column === column;

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return <th aria-sort={active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <div className={`sortable-header ${active ? 'sorted' : ''}`} ref={rootRef}>
      <div className="sortable-header-label">{label}{children}</div>
      <button type="button" className="sortable-header-trigger" title={`Trier ${label}`} onClick={() => setOpen(value => !value)}>
        {active
          ? sortState.direction === 'asc' ? <ArrowUp size={15}/> : <ArrowDown size={15}/>
          : <ChevronsUpDown size={15}/>}
      </button>
      {open && <div className="sortable-header-popover">
        <div className="sortable-header-popover-head"><strong>{label}</strong><button type="button" onClick={() => setOpen(false)}><X size={15}/></button></div>
        <SortMenuSection rows={rows} column={column} sortState={sortState} onSort={onSort} onReset={onReset}/>
      </div>}
    </div>
  </th>;
}
