import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function GridPagination({ page, pageCount, pageSize, total, selectedCount = 0, onPage, onPageSize }) {
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(total, page * pageSize);
  const candidates = [1, page - 1, page, page + 1, pageCount].filter(value => value >= 1 && value <= pageCount);
  const pages = [...new Set(candidates)].sort((a, b) => a - b);

  return <nav className="grid-pagination" aria-label="Pagination de la grille">
    <div className="grid-pagination-summary"><strong>{start.toLocaleString('fr-CA')}–{end.toLocaleString('fr-CA')}</strong> sur {total.toLocaleString('fr-CA')}<span>{selectedCount.toLocaleString('fr-CA')} sélectionnée(s)</span></div>
    <div className="grid-pagination-controls">
      <button type="button" aria-label="Première page" disabled={page === 1} onClick={() => onPage(1)}><ChevronsLeft/> Première</button>
      <button type="button" aria-label="Page précédente" disabled={page === 1} onClick={() => onPage(page - 1)}><ChevronLeft/> Précédente</button>
      {pages.map((value, index) => <React.Fragment key={value}>{index > 0 && value - pages[index - 1] > 1 && <span>…</span>}<button type="button" className={value === page ? 'active' : ''} aria-current={value === page ? 'page' : undefined} onClick={() => onPage(value)}>{value}</button></React.Fragment>)}
      <button type="button" aria-label="Page suivante" disabled={page === pageCount} onClick={() => onPage(page + 1)}>Suivante <ChevronRight/></button>
      <button type="button" aria-label="Dernière page" disabled={page === pageCount} onClick={() => onPage(pageCount)}>Dernière <ChevronsRight/></button>
    </div>
    <label>Lignes par page <select value={pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[25, 50, 100, 200].map(value => <option key={value}>{value}</option>)}</select></label>
  </nav>;
}
