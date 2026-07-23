import { useEffect, useMemo, useState } from 'react';
import { defaultSortForColumn, sortRows } from '../lib/gridSorting';

export default function useSortableRows(rows, initialState = null, storageKey = '') {
  const [sortState, setSortState] = useState(() => {
    if (!storageKey || typeof sessionStorage === 'undefined') return initialState;
    try {
      return JSON.parse(sessionStorage.getItem(`tdm-grid-sort:${storageKey}`)) || initialState;
    } catch {
      return initialState;
    }
  });
  const sortedRows = useMemo(() => sortRows(rows || [], sortState), [rows, sortState]);

  useEffect(() => {
    if (!storageKey || typeof sessionStorage === 'undefined') return;
    if (sortState) sessionStorage.setItem(`tdm-grid-sort:${storageKey}`, JSON.stringify(sortState));
    else sessionStorage.removeItem(`tdm-grid-sort:${storageKey}`);
  }, [sortState, storageKey]);

  function sortColumn(column, patch = {}) {
    setSortState(current => {
      const base = current?.column === column
        ? current
        : defaultSortForColumn(rows || [], column);
      return { ...base, ...patch, column };
    });
  }

  return { sortedRows, sortState, setSortState, sortColumn };
}
