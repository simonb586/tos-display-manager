import React, { useMemo, useState } from 'react';
import { AlertTriangle, Database, Eye, Shield } from 'lucide-react';
import { filterCatalogFields } from '../lib/fieldCatalog';
import useFieldCatalog from '../hooks/useFieldCatalog';
import FieldCatalogList from './field-catalog/FieldCatalogList';
import FieldCatalogDrawer from './field-catalog/FieldCatalogDrawer';
import BrandLogo from './BrandLogo';

export default function FieldCatalogManager({ role }) {
  const [table, setTable] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const isAdmin = role === 'Administrateur';
  const catalog = useFieldCatalog({ enabled: isAdmin });
  const fields = catalog.data.fields;

  const tables = useMemo(
    () => [...new Set(fields.map(field => field.tableName))].sort((a, b) => a.localeCompare(b, 'fr-CA')),
    [fields]
  );
  const visible = useMemo(
    () => filterCatalogFields(fields, { table, query, filter }),
    [fields, table, query, filter]
  );
  const migrationWarning = catalog.warnings.find(item => item.code === 'migration_missing');
  const loadError = catalog.errors[0];

  if (!isAdmin) return <div className="field-catalog-page"><section className="field-catalog-card access-denied"><Shield/><h1>Accès réservé</h1><p>Le Gestionnaire des champs est réservé aux administrateurs.</p></section></div>;

  return <div className="field-catalog-page">
    <header className="field-catalog-hero">
      <div><BrandLogo className="field-catalog-brand-logo"/><span className="field-catalog-eyebrow"><Eye size={16}/> Consultation seulement</span><h1>Gestionnaire des champs</h1><p>Catalogue fonctionnel et métadonnées physiques des champs.</p></div>
      <Database size={42}/>
    </header>
    {migrationWarning && <div className="field-catalog-message warning" role="status"><AlertTriangle/><span>{migrationWarning.message}</span></div>}
    {loadError && <div className="field-catalog-message error" role="alert"><AlertTriangle/><span>{loadError.message}</span></div>}
    <FieldCatalogList
      fields={visible}
      tables={tables}
      table={table}
      query={query}
      filter={filter}
      loading={catalog.loading}
      onTableChange={setTable}
      onQueryChange={setQuery}
      onFilterChange={setFilter}
      onOpen={setSelected}
    />
    <FieldCatalogDrawer
      field={selected}
      role={role}
      catalogFields={fields}
      onClose={() => setSelected(null)}
      onSaved={async fieldId => {
        const refreshed = await catalog.invalidate();
        setSelected(refreshed.data.fields.find(field => field.fieldId === fieldId) || null);
      }}
    />
  </div>;
}
