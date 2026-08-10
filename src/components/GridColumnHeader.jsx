import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, X } from 'lucide-react';
import SortMenuSection from './SortMenuSection';
import { adaptiveColumnWidth } from '../lib/gridPresentation';

export default function GridColumnHeader({
  column, label, rows, filterValue, onFilter, sortState, onSort, onReset, preferredWidth
}) {
  const [open,setOpen]=useState(false);
  const active=sortState?.column===column;
  const width=preferredWidth||adaptiveColumnWidth(rows,column,label);
  return <th style={{width,minWidth:Math.min(width,160),maxWidth:width}} aria-sort={active?(sortState.direction==='asc'?'ascending':'descending'):'none'}>
    <div className={`grid-column-header ${active?'sorted':''}`}>
      <div className="grid-column-header-main"><span title={label}>{label}</span><input placeholder="Filtrer" value={filterValue||''} onChange={event=>onFilter(event.target.value)}/></div>
      <div className="grid-sort-control">
        <button type="button" className={active?'active':''} onClick={()=>setOpen(value=>!value)} title={`Classer par ${label}`} aria-label={`Classer par ${label}`}>
          {active?(sortState.direction==='asc'?<ArrowUp size={15}/>:<ArrowDown size={15}/>):<ChevronsUpDown size={15}/>}
        </button>
        {open&&<div className="grid-sort-popover"><button type="button" className="grid-sort-close" onClick={()=>setOpen(false)}><X size={14}/></button><SortMenuSection rows={rows} column={column} sortState={sortState} onSort={value=>{onSort(value);setOpen(false);}} onReset={()=>{onReset();setOpen(false);}}/></div>}
      </div>
    </div>
  </th>;
}
