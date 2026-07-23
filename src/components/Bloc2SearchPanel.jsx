import React, { useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { universalSearch } from '../services/searchService';

export default function Bloc2SearchPanel() {
  const [type, setType] = useState('infrastructure');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const title = useMemo(() => {
    if (type === 'arret') return 'Recherche Arrêt';
    if (type === 'edt') return 'Recherche EDT';
    return 'Recherche Infrastructure';
  }, [type]);

  async function handleSearch(e) {
    e?.preventDefault?.();
    setStatus('loading');
    setError('');

    try {
      const data = await universalSearch(type, query, 75);
      setRows(data);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Erreur de recherche');
      setRows([]);
      setStatus('error');
    }
  }

  function labelFor(row) {
    if (type === 'arret') return row.no_arret || row.data?.["# d'Arrêt"] || 'Arrêt';
    if (type === 'edt') return row.no_edt || row.data?.['No EDT'] || 'EDT';
    return row.support_id || row.data?.['Support ID'] || 'Infrastructure';
  }

  function subLabelFor(row) {
    return (
      row.emplacement_visibilite ||
      row.site ||
      row.campagne ||
      row.client ||
      row.data?.['Emplacement/Visibilité'] ||
      row.data?.['Site'] ||
      ''
    );
  }

  return (
    <section className="bloc2-card">
      <div className="bloc2-header">
        <div>
          <h2>{title}</h2>
          <p>Recherche unifiée — Infrastructure, arrêt ou EDT.</p>
        </div>
      </div>

      <form className="bloc2-searchbar" onSubmit={handleSearch}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="infrastructure">Infrastructure</option>
          <option value="arret">Arrêt</option>
          <option value="edt">EDT</option>
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex. Numéro du support, numéro d’arrêt, campagne…"
        />

        <button type="submit">
          {status === 'loading' ? <Loader2 size={18} /> : <Search size={18} />}
          Rechercher
        </button>
      </form>

      {error && <div className="bloc2-error">{error}</div>}

      <div className="bloc2-results-meta">
        {status === 'done' && `${rows.length} résultat(s)`}
        {status === 'idle' && 'Prêt à rechercher'}
        {status === 'loading' && 'Recherche en cours...'}
      </div>

      <div className="bloc2-results">
        {rows.map((row, idx) => (
          <article className="bloc2-result" key={row.id || `${type}-${idx}`}>
            <strong>{labelFor(row)}</strong>
            <span>{subLabelFor(row)}</span>
            <small>
              {type === 'infrastructure' && (row.type_support || row.format_affichage || '')}
              {type === 'arret' && (row.statut || row.type_support || '')}
              {type === 'edt' && (row.statut || row.avancement !== undefined ? `Avancement ${row.avancement}%` : '')}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
