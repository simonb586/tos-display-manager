import React from 'react';
import { Search } from 'lucide-react';
import { FIELD_CATALOG_FILTERS, fieldBadges } from '../../lib/fieldCatalogPresentation';

function Badge({ tone = '', children }) {
  return <span className={`field-catalog-badge ${tone}`}>{children}</span>;
}

export default function FieldCatalogList({
  fields, tables, table, query, filter, loading,
  onTableChange, onQueryChange, onFilterChange, onOpen
}) {
  return <section className="field-catalog-card">
    <div className="field-catalog-toolbar">
      <label>Table<select value={table} onChange={event => onTableChange(event.target.value)}><option value="">Toutes les tables</option>{tables.map(name => <option key={name}>{name}</option>)}</select></label>
      <label className="field-catalog-search"><span>Recherche</span><div><Search size={18}/><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Nom, libellé, type ou statut"/></div></label>
    </div>
    <nav className="field-catalog-filters" aria-label="Filtres du catalogue">
      {FIELD_CATALOG_FILTERS.map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => onFilterChange(value)}>{label}</button>)}
    </nav>
    <p className="field-catalog-count">{loading ? 'Chargement du catalogue…' : `${fields.length} champ${fields.length === 1 ? '' : 's'} affiché${fields.length === 1 ? '' : 's'}`}</p>
    {!loading && !fields.length && <div className="field-catalog-empty">Aucun champ ne correspond à cette sélection.</div>}
    <div className="field-catalog-list">
      {fields.map(field => <button className="field-catalog-row" key={field.fieldId} onClick={() => onOpen(field)}>
        <div className="field-catalog-name"><strong>{field.label}</strong><code>{field.technicalName}</code></div>
        <div className="field-catalog-badges">
          {fieldBadges(field).map(badge => <Badge key={badge.id} tone={badge.tone}>{badge.label}</Badge>)}
        </div>
        <span className="field-catalog-table">{field.tableName}</span>
      </button>)}
    </div>
  </section>;
}
