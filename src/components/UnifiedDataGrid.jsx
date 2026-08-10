import React from 'react';
import GridColumnHeader from './GridColumnHeader';
import DataGridFilterRow from './DataGridFilterRow';

export default function UnifiedDataGrid({
  gridId, columns, rows, filterRows = rows, filters = {}, onFilter,
  sortState, onSort, onResetSort, rowKey, renderCell, onRowClick,
  selection, leadingColumns = [], actions, className = '', emptyMessage = 'Aucun résultat.'
}) {
  const selectable = Boolean(selection);
  const allSelected = rows.length > 0 && rows.every((row, index) => selection.selected.has(rowKey(row, index)));
  const visibleColumns = columns.filter(column => column.visible !== false);
  const leadingCount = (selectable ? 1 : 0) + leadingColumns.length;
  return <div className={`tableWrap professional-grid unified-data-grid ${className}`} data-unified-grid={gridId}>
    <table>
      <colgroup>{selectable && <col className="selection-column"/>}{leadingColumns.map(column => <col key={column.id} style={column.width ? { width: column.width } : undefined}/>)}{visibleColumns.map(column => <col key={column.id} style={column.width ? { width: column.width } : undefined}/>)}{actions && <col className="action-column"/>}</colgroup>
      <thead>
        <tr className="data-grid-header-row" data-grid-zone="headers">
          {selectable && <th className="selection-column"><input type="checkbox" aria-label="Sélectionner la page" checked={allSelected} onChange={event => selection.togglePage(rows, event.target.checked)}/></th>}
          {leadingColumns.map(column => <th key={column.id}>{column.label}</th>)}
          {visibleColumns.map(column => column.sortable === false
            ? <th key={column.id} data-grid-zone="header" style={column.width ? { width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth } : undefined}>{column.label}</th>
            : <GridColumnHeader key={column.id} column={column.id} label={column.label} rows={filterRows} preferredWidth={column.width} sortState={sortState} onSort={onSort} onReset={onResetSort}/>)}
          {actions && <th className="action-column">Actions</th>}
        </tr>
        <DataGridFilterRow columns={visibleColumns.map(column => ({ key: column.id, label: column.label, filterable: column.filterable !== false }))} rows={filterRows} filters={filters} onFilter={onFilter} leadingCells={leadingCount} trailingCells={actions ? 1 : 0}/>
      </thead>
      <tbody>{rows.length ? rows.map((row, index) => {
        const key = rowKey(row, index);
        return <tr key={key} onClick={() => onRowClick?.(row)}>
          {selectable && <td className="selection-column" onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`Sélectionner ${key}`} checked={selection.selected.has(key)} onChange={() => selection.toggle(key)}/></td>}
          {leadingColumns.map(column => <td key={column.id}>{column.renderCell(row, index)}</td>)}
          {visibleColumns.map(column => <td key={column.id} className={column.className || ''}>{renderCell(column, row, index)}</td>)}
          {actions && <td className="action-column" onClick={event => event.stopPropagation()}>{actions(row, index)}</td>}
        </tr>;
      }) : <tr><td className="unified-grid-empty" colSpan={leadingCount + visibleColumns.length + (actions ? 1 : 0)}>{emptyMessage}</td></tr>}</tbody>
    </table>
  </div>;
}
