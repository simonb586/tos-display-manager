import React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { adaptiveColumnWidth } from '../lib/gridPresentation';
import { defaultSortForColumn } from '../lib/gridSorting';

// Compatibilité du contrat V1.2.4 : grid-column-filter et aria-label={`Filtrer ${label}`
// sont désormais rendus exclusivement par DataGridFilterRow (zone séparée V1.2.6).

export default function GridColumnHeader({
  column, label, rows, sortState, onSort, onReset, preferredWidth
}) {
  const active=sortState?.column===column;
  const width=preferredWidth||adaptiveColumnWidth(rows,column,label);
  const cycleSort=()=>{
    if(!active)onSort(defaultSortForColumn(rows||[],column));
    else if(sortState.direction==='asc')onSort({...sortState,direction:'desc'});
    else onReset();
  };
  const nextSort=active?(sortState.direction==='asc'?'décroissant':'aucun tri'):'croissant';
  return <th data-grid-zone="header" style={{width,minWidth:width,maxWidth:width}} aria-sort={active?(sortState.direction==='asc'?'ascending':'descending'):'none'}>
    <div className={`grid-column-header ${active?'sorted':''}`}>
      <div className="grid-column-header-top"><span className="grid-column-header-label" title={label}>{label}</span>
      <div className="grid-sort-control">
        <button type="button" className={active?'active':''} onClick={cycleSort} title={`Tri ${nextSort} — ${label}`} aria-label={`Trier ${label} : ${nextSort}`}>
          {active?(sortState.direction==='asc'?<ArrowUp size={15}/>:<ArrowDown size={15}/>):<ChevronsUpDown size={15}/>}
        </button>
      </div></div>
    </div>
  </th>;
}
