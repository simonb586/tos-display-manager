import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Microscope, RefreshCw } from 'lucide-react';
import { diagnoseEdtIntegrity, previewEdtRepair } from '../services/operationsService';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';

export default function EdtIntegrityDiagnostics({ edtId }) {
  const [issues, setIssues] = useState([]);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { sortedRows, sortState, setSortState } = useSortableRows(
    issues,
    null,
    `edt-integrity-${edtId}`
  );

  async function runDiagnostic() {
    setBusy(true);
    setMessage('');
    try {
      const rows = await diagnoseEdtIntegrity(edtId);
      setIssues(rows);
      setPreview(null);
    } catch (error) {
      setMessage(error.message || 'Diagnostic EDT indisponible.');
    } finally {
      setBusy(false);
    }
  }

  async function runDryRun() {
    setBusy(true);
    setMessage('');
    try {
      setPreview(await previewEdtRepair(edtId));
    } catch (error) {
      setMessage(error.message || 'Simulation de réparation indisponible.');
    } finally {
      setBusy(false);
    }
  }

  const header = (label, column) => (
    <SortableHeader
      label={label}
      column={column}
      rows={issues}
      sortState={sortState}
      onSort={setSortState}
      onReset={() => setSortState(null)}
    />
  );

  return <section className="edt-integrity-panel">
    <div className="edt-integrity-head">
      <div>
        <h3><Microscope size={18}/> Intégrité EDT–BT</h3>
        <p>Lecture seule. Source de vérité : <code>edt_supports</code>.</p>
      </div>
      <div className="edt-integrity-actions">
        <button type="button" disabled={busy} onClick={runDiagnostic}>
          <RefreshCw size={15}/> Diagnostiquer
        </button>
        <button type="button" disabled={busy} onClick={runDryRun}>
          <Microscope size={15}/> Simuler la réparation
        </button>
      </div>
    </div>

    {message && <div className="v07-message"><AlertTriangle size={16}/> {message}</div>}
    {preview && <div className="edt-dry-run-result">
      <CheckCircle2 size={17}/>
      Dry-run confirmé : {Number(preview.actions_proposees || 0)} action(s) proposée(s), aucune écriture.
    </div>}
    {!busy && issues.length === 0 && preview === null && (
      <p className="edt-integrity-empty">Lancez le diagnostic pour contrôler les liens, états et progressions.</p>
    )}
    {issues.length > 0 && <div className="tableWrap">
      <table>
        <thead><tr>
          {header('Sévérité', 'severite')}
          {header('Code', 'code')}
          {header('Support', 'support_id')}
          {header('Affectation', 'edt_support_id')}
          {header('BT', 'bon_de_travail_id')}
          <th>Détails</th>
        </tr></thead>
        <tbody>{sortedRows.map((issue, index) => <tr key={`${issue.code}-${issue.edt_support_id || index}`}>
          <td><span className={`edt-integrity-severity ${issue.severite}`}>{issue.severite}</span></td>
          <td><code>{issue.code}</code></td>
          <td>{issue.support_id || '—'}</td>
          <td>{issue.edt_support_id || '—'}</td>
          <td>{issue.bon_de_travail_id || '—'}</td>
          <td><code>{JSON.stringify(issue.details || {})}</code></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
