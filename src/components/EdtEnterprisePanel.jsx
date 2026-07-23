import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ListPlus, RefreshCw, Trash2, Users } from 'lucide-react';
import {
  assignSupportsToEdt,
  parseSupportIds,
  refreshEdtEnterprise,
  removeSupportFromEdt,
  updateEdtSupport
} from '../services/operationsService';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';
import EdtIntegrityDiagnostics from './EdtIntegrityDiagnostics';

export default function EdtEnterprisePanel({ edt, data, canManage, busy, run }) {
  const [supportText, setSupportText] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('Normale');
  const [targetDate, setTargetDate] = useState('');
  const [generateWorkOrders, setGenerateWorkOrders] = useState(true);

  const supports = useMemo(
    () => (data.edtSupports || []).filter(item => String(item.edt_id) === String(edt.id)),
    [data.edtSupports, edt.id]
  );
  const phases = useMemo(
    () => data.phases.filter(item => String(item.edt_id) === String(edt.id)),
    [data.phases, edt.id]
  );
  const { sortedRows: sortedSupports, sortState, setSortState } = useSortableRows(supports, null, `edt-supports-${edt.id}`);
  const dashboard = (data.dashboard || []).find(item => String(item.edt_id) === String(edt.id));
  const parsedCount = parseSupportIds(supportText).length;

  async function submit(event) {
    event.preventDefault();
    await run(async () => {
      const result = await assignSupportsToEdt({
        edtId: edt.id,
        supportIds: supportText,
        phaseId,
        priority,
        assignedTo,
        targetDate,
        generateWorkOrders
      });
      setSupportText('');
      const missing = result?.supports_introuvables?.length
        ? ` Introuvables : ${result.supports_introuvables.join(', ')}.`
        : '';
      return `Supports affectés : ${result?.supports_affectes ?? parsedCount}.${missing}`;
    }, 'Supports ajoutés à l’EDT et progression recalculée.');
  }

  return (
    <section className="v07-card operations-wide edt-enterprise">
      <div className="edt-enterprise-head">
        <div>
          <h2>Moteur EDT Enterprise</h2>
          <p>Affectation massive des supports, génération automatique des bons et avancement réel.</p>
        </div>
        {canManage && (
          <button disabled={busy} onClick={() => run(() => refreshEdtEnterprise(edt.id), 'Progression EDT resynchronisée.')}>
            <RefreshCw size={16}/> Resynchroniser
          </button>
        )}
      </div>

      <div className="edt-enterprise-kpis">
        <Metric label="Supports" value={dashboard?.total ?? supports.length}/>
        <Metric label="Planifiés" value={dashboard?.planifies ?? supports.filter(x => x.statut === 'Planifié').length}/>
        <Metric label="En cours" value={dashboard?.en_cours ?? supports.filter(x => x.statut === 'En cours').length}/>
        <Metric label="Bloqués" value={dashboard?.bloques ?? supports.filter(x => x.bloque).length} warning/>
        <Metric label="Terminés" value={dashboard?.termines ?? supports.filter(x => x.statut === 'Terminé').length}/>
        <Metric label="Progression" value={`${dashboard?.progression ?? edt.progression ?? 0}%`} warning={dashboard?.en_retard}/>
      </div>

      {dashboard?.en_retard && (
        <div className="edt-overdue"><AlertTriangle size={17}/> Cet EDT est en retard selon sa date de fin prévue.</div>
      )}

      {canManage && (
        <form className="edt-support-import" onSubmit={submit}>
          <div className="edt-support-import-main">
            <label>Support ID à ajouter
              <textarea
                value={supportText}
                onChange={e => setSupportText(e.target.value)}
                placeholder={'Un identifiant par ligne, ou séparés par virgule\nEx. 10001, 10002, 10003'}
                rows={5}
              />
            </label>
            <small>{parsedCount} identifiant(s) unique(s) détecté(s).</small>
          </div>
          <div className="edt-support-import-options">
            <label>Phase
              <select value={phaseId} onChange={e => setPhaseId(e.target.value)}>
                <option value="">Sans phase précise</option>
                {phases.map(item => <option key={item.id} value={item.id}>{item.ordre}. {item.nom}</option>)}
              </select>
            </label>
            <label>Assigné à
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">Non assigné</option>
                {data.users.filter(u => u.statut === 'Actif').map(u => (
                  <option key={u.id} value={u.courriel}>{u.nom || u.courriel}</option>
                ))}
              </select>
            </label>
            <label>Priorité
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {['Basse','Normale','Haute','Urgente'].map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Date cible
              <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}/>
            </label>
            <label className="edt-checkbox">
              <input type="checkbox" checked={generateWorkOrders} onChange={e => setGenerateWorkOrders(e.target.checked)}/>
              Générer automatiquement un bon de travail par support
            </label>
            <button className="v07-primary" disabled={busy || !parsedCount}>
              <ListPlus size={17}/> Affecter les supports
            </button>
          </div>
        </form>
      )}

      <div className="edt-support-table tableWrap">
        <table>
          <thead><tr>
            <SortableHeader label="Support" column="support_id" rows={supports} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
            <SortableHeader label="Phase" column="phase_id" rows={supports} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
            <SortableHeader label="Statut" column="statut" rows={supports} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
            <SortableHeader label="Progression" column="progression" rows={supports} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
            <SortableHeader label="Assigné à" column="assigne_a" rows={supports} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
            <SortableHeader label="Date cible" column="date_cible" rows={supports} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
            <SortableHeader label="BT" column="bon_de_travail_id" rows={supports} sortState={sortState} onSort={setSortState} onReset={() => setSortState(null)}/>
            {canManage && <th>Actions</th>}
          </tr></thead>
          <tbody>
            {sortedSupports.map(item => {
              const phase = phases.find(p => String(p.id) === String(item.phase_id));
              const bt = data.workOrders.find(b => String(b.id) === String(item.bon_de_travail_id));
              return (
                <tr key={item.id}>
                  <td><strong>{item.support_id}</strong>{item.bloque && <span className="blocked-tag">Bloqué</span>}</td>
                  <td>{phase?.nom || '—'}</td>
                  <td>
                    {canManage ? (
                      <select value={item.statut} onChange={e => run(() => updateEdtSupport(item.id, { statut:e.target.value }), 'Statut du support mis à jour.')}>
                        {['Planifié','En cours','Bloqué','Terminé','Annulé'].map(status => <option key={status}>{status}</option>)}
                      </select>
                    ) : item.statut}
                  </td>
                  <td>
                    {canManage ? (
                      <input className="progress-input" type="number" min="0" max="100" value={item.progression || 0}
                        onChange={e => run(() => updateEdtSupport(item.id, { progression:Number(e.target.value), statut:Number(e.target.value) >= 100 ? 'Terminé' : item.statut }), 'Progression du support mise à jour.')}/>
                    ) : `${item.progression || 0}%`}
                  </td>
                  <td>{item.assigne_a || '—'}</td>
                  <td>{item.date_cible || '—'}</td>
                  <td>{bt?.no_bt || '—'}</td>
                  {canManage && <td><button className="danger-link" onClick={() => run(() => removeSupportFromEdt(edt.id, item.support_id), 'Support retiré de l’EDT.')}><Trash2 size={15}/> Retirer</button></td>}
                </tr>
              );
            })}
            {!supports.length && <tr><td colSpan={canManage ? 8 : 7}>Aucun support n’est encore affecté à cet EDT.</td></tr>}
          </tbody>
        </table>
      </div>
      {canManage && <EdtIntegrityDiagnostics edtId={edt.id}/>}
    </section>
  );
}

function Metric({ label, value, warning }) {
  return <div className={warning ? 'warning' : ''}>{warning ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}<span>{label}</span><strong>{value}</strong></div>;
}
