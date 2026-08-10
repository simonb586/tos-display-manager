import React from 'react';
import DataGridColumnFilter from './DataGridColumnFilter';

export default function DataGridFilterRow({ columns, rows, filters, onFilter, leadingCells = 0, trailingCells = 0 }) {
  return <tr className="data-grid-filter-row" data-grid-zone="filters">
    {Array.from({ length: leadingCells }, (_, index) => <th key={index} aria-hidden="true"/>)}
    {columns.map(column => <th key={column.key} scope="col">
      {column.filterable === false ? null : <DataGridColumnFilter column={column.key} label={column.label} rows={rows} selected={filters[column.key] || []} onChange={value => onFilter(column.key, value)}/>}
    </th>)}
    {Array.from({ length: trailingCells }, (_, index) => <th key={`trailing-${index}`} aria-hidden="true"/>)}
  </tr>;
}
