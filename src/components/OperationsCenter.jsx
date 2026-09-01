import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react';
import EdtEnterprisePanel from './EdtEnterprisePanel';
import EdtLifecyclePanel from './EdtLifecyclePanel';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';
import { filterSupportOperations } from '../lib/supportNavigationContext';
import { friendlyError } from '../config/businessLanguage';
import {
  assignUser,
  closeEdt,
  computeEdtProgress,
  convertRequestToWorkOrder,
  createClientRequest,
  createEdt,
  createPhase,
  createWorkOrderV11,
  deleteOrArchiveEdt,
  inspectEdtDeletion,
  loadEdtLifecycleData,
  loadOperationsData,
  updateEdt,
  updatePhase,
  updateWorkOrderV11
} from '../services/operationsService';

const emptyEdt = {
  no_edt: '',
  nom: '',
  campagne: '',
  campagne_id: '',
  lifecycle_status: 'brouillon',
  client: '',
  statut: 'Planifié',
  priorite: 'Normale',
  date_debut_prevue: '',
  date_retrait_prevue: '',
  creer_retrait: false,
  coordonnateur: '',
  supports_prevus: 0,
  description: ''
};

const emptyRequest = {
  client: '',
  demandeur_nom: '',
  demandeur_courriel: '',
  type_requete: 'Installation',
  priorite: 'Normale',
  support_id: '',
  description: ''
};

const emptyWorkOrder = {
  no_bt: '',
  type_bt: 'Installation',
  support_id: '',
  edt_id: '',
  no_edt: '',
  phase_id: '',
  priorite: 'Normale',
  statut: 'À faire',
  assigne_a: '',
  date_cible: '',
  client: '',
  description: '',
  progression: 0
};

export default function OperationsCenter({ role, supportId = '', onClearSupportContext }) {
  const [tab, setTab] = useState('edt');
  const [data, setData] = useState({
    edts: [],
    workOrders: [],
    requests: [],
    phases: [],
    assignments: [],
    history: [],
    users: [],
    edtSupports: [],
    dashboard: []
    ,campaigns: [], phaseReports: []
  });
  const [selectedEdtId, setSelectedEdtId] = useState('');
  const [lifecycleDetail, setLifecycleDetail] = useState(null);
  const [lifecycleError, setLifecycleError] = useState(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleRevision, setLifecycleRevision] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const selectionRequest = useRef(0);
  const [edtForm, setEdtForm] = useState(emptyEdt);
  const [requestForm, setRequestForm] = useState(emptyRequest);
  const [btForm, setBtForm] = useState(emptyWorkOrder);
  const [phaseForm, setPhaseForm] = useState({
    nom: '',
    ordre: 1,
    statut: 'À faire',
    date_debut_prevue: '',
    date_fin_prevue: '',
    progression: 0,
    notes: ''
  });
  const [assignment, setAssignment] = useState({
    user_email: '',
    role_assignment: 'Installateur',
    date_debut: '',
    date_fin: ''
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const {sortedRows:sortedHistory,sortState:historySort,setSortState:setHistorySort}=useSortableRows(data.history, null, 'operations-history');

  const canManage = ['Administrateur', 'Coordonnateur'].includes(role);
  const canDeleteEdt = role === 'Administrateur';
  const selectedEdt = data.edts.find(item => String(item.id) === String(selectedEdtId)) || null;
  const contextual=useMemo(()=>filterSupportOperations(data,supportId),[data,supportId]);
  const {edts:visibleEdts,workOrders:visibleWorkOrders,requests:visibleRequests,history:visibleHistory}=contextual;

  async function reload() {
    try {
      setData(await loadOperationsData());
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Erreur de chargement.');
    }
  }

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (!supportId) return;
    setSelectedEdtId(current => visibleEdts.some(row => String(row.id) === String(current)) ? current : String(visibleEdts[0]?.id || ''));
  }, [supportId, visibleEdts]);

  useEffect(() => {
    const requestId = ++selectionRequest.current;
    setLifecycleDetail(null);
    setLifecycleError(null);
    if (!selectedEdtId) { setLifecycleLoading(false); return; }
    setLifecycleLoading(true);
    loadEdtLifecycleData(selectedEdtId).then(detail => {
      if (requestId === selectionRequest.current) setLifecycleDetail(detail);
    }).catch(error => {
      console.error('Impossible de charger le cycle de vie EDT', { edtId: selectedEdtId, error });
      if (requestId === selectionRequest.current) setLifecycleError(error);
      if (requestId === selectionRequest.current) setMessage(friendlyError(error));
    }).finally(() => {
      if (requestId === selectionRequest.current) setLifecycleLoading(false);
    });
    return () => { selectionRequest.current += 1; };
  }, [selectedEdtId, lifecycleRevision]);

  const stats = useMemo(() => ({
    activeEdts: data.edts.filter(item => !['Terminé', 'Annulé'].includes(item.statut)).length,
    openOrders: data.workOrders.filter(item => !['Terminée', 'Annulée'].includes(item.statut)).length,
    newRequests: data.requests.filter(item => item.statut === 'Nouvelle').length,
    assignedUsers: data.assignments.filter(item => item.statut !== 'Retiré').length
  }), [data]);

  async function run(action, success) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await reload();
      setLifecycleRevision(value => value + 1);
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function openDeleteDialog(edt) {
    if (busy || !canDeleteEdt) return;
    setBusy(true);
    setMessage('');
    try { setDeleteDialog({ edt, impact: await inspectEdtDeletion(edt.id) }); }
    catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  }

  async function confirmDeleteEdt() {
    if (!deleteDialog || busy) return;
    const edtId = deleteDialog.edt.id;
    setBusy(true);
    try {
      const result = await deleteOrArchiveEdt(edtId);
      setDeleteDialog(null);
      setSelectedEdtId('');
      setLifecycleDetail(null);
      await reload();
      setMessage(result.result === 'deleted' ? 'EDT supprim\u00e9.' : 'EDT archiv\u00e9.');
    } catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  }

  async function submitEdt(event) {
    event.preventDefault();
    await run(async () => {
      if (edtForm.id) await updateEdt(edtForm.id, edtForm);
      else await createEdt(edtForm);
      setEdtForm(emptyEdt);
    }, edtForm.id ? 'EDT modifié.' : 'EDT créé.');
  }

  async function submitRequest(event) {
    event.preventDefault();
    await run(async () => {
      await createClientRequest(requestForm);
      setRequestForm(emptyRequest);
    }, 'Requête client créée.');
  }

  async function submitWorkOrder(event) {
    event.preventDefault();
    await run(async () => {
      await createWorkOrderV11(btForm);
      setBtForm(emptyWorkOrder);
    }, 'Bon de travail créé.');
  }

  async function submitPhase(event) {
    event.preventDefault();
    if (!selectedEdt) return;
    await run(async () => {
      await createPhase({ ...phaseForm, edt_id: selectedEdt.id });
      setPhaseForm({
        nom: '',
        ordre: 1,
        statut: 'À faire',
        date_debut_prevue: '',
        date_fin_prevue: '',
        progression: 0,
        notes: ''
      });
    }, 'Phase ajoutée.');
  }

  async function submitAssignment(event) {
    event.preventDefault();
    if (!selectedEdt || !assignment.user_email) return;
    const user = data.users.find(item => item.courriel === assignment.user_email);
    await run(async () => {
      await assignUser({
        ...assignment,
        edt_id: selectedEdt.id,
        user_id: user?.id || null
      });
      setAssignment({
        user_email: '',
        role_assignment: 'Installateur',
        date_debut: '',
        date_fin: ''
      });
    }, 'Utilisateur assigné.');
  }

  return (
    <div className="operations-page">
      <header className="operations-hero">
        <div>
          <h1><ClipboardList/> Centre EDT et bons de travail</h1>
          <p>Requêtes clients, phases, assignations, progression et clôture opérationnelle.</p>
        </div>
        <button onClick={reload}><RefreshCw size={17}/> Actualiser</button>
      </header>

      {message && <div className="v07-message">{message}</div>}
      {supportId && <div className="v07-message">Support {supportId} uniquement. {onClearSupportContext && <button onClick={onClearSupportContext}>Retirer le filtre</button>}</div>}

      <div className="operations-kpis">
        <Kpi icon={<Layers3/>} label="EDT actifs" value={stats.activeEdts}/>
        <Kpi icon={<ClipboardList/>} label="BT ouverts" value={stats.openOrders}/>
        <Kpi icon={<AlertTriangle/>} label="Requêtes nouvelles" value={stats.newRequests}/>
        <Kpi icon={<Users/>} label="Assignations actives" value={stats.assignedUsers}/>
      </div>

      <div className="operations-tabs">
        <button className={tab === 'edt' ? 'active' : ''} onClick={() => setTab('edt')}>EDT</button>
        <button className={tab === 'bt' ? 'active' : ''} onClick={() => setTab('bt')}>Bons de travail</button>
        <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Requêtes clients</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Historique</button>
      </div>

      {tab === 'edt' && (
        <div className="operations-layout">
          {canManage && (
            <form className="v07-card operations-form" onSubmit={submitEdt}>
              <h2><Plus/> {edtForm.id ? 'Modifier l’EDT' : 'Créer un EDT'}</h2>
              <label>No EDT<input value={edtForm.no_edt} onChange={e => setEdtForm({...edtForm, no_edt:e.target.value})}/></label>
              <label>Nom<input value={edtForm.nom} onChange={e => setEdtForm({...edtForm, nom:e.target.value})}/></label>
              <label>Campagne<select required value={edtForm.campagne_id||''} onChange={e=>{const campaign=data.campaigns.find(item=>String(item.id)===e.target.value);setEdtForm({...edtForm,campagne_id:e.target.value,campagne:campaign?.nom_campagne||''})}}><option value="">Choisir une campagne</option>{data.campaigns.map(item=><option key={item.id} value={item.id}>{item.nom_campagne}</option>)}</select></label>
              <label>Client<input value={edtForm.client} onChange={e => setEdtForm({...edtForm, client:e.target.value})}/></label>
              <label>Statut<select value={edtForm.statut} onChange={e => setEdtForm({...edtForm, statut:e.target.value})}>
                {['Planifié','En préparation','En cours','En attente','Terminé','Annulé'].map(item => <option key={item}>{item}</option>)}
              </select></label>
              <label>Priorité<select value={edtForm.priorite} onChange={e => setEdtForm({...edtForm, priorite:e.target.value})}>
                {['Basse','Normale','Haute','Urgente'].map(item => <option key={item}>{item}</option>)}
              </select></label>
              <label>Date de début de l’installation<input required type="date" value={edtForm.date_debut_prevue || ''} onChange={e => setEdtForm({...edtForm, date_debut_prevue:e.target.value})}/></label>
              {!edtForm.id && <label className="edt-checkbox"><input type="checkbox" checked={edtForm.creer_retrait} onChange={e=>setEdtForm({...edtForm,creer_retrait:e.target.checked,date_retrait_prevue:e.target.checked?edtForm.date_retrait_prevue:''})}/> Créer également une phase Retrait ?</label>}
              {!edtForm.id && edtForm.creer_retrait && <label>Date prévue du retrait<input required type="date" min={edtForm.date_debut_prevue||''} value={edtForm.date_retrait_prevue || ''} onChange={e => setEdtForm({...edtForm, date_retrait_prevue:e.target.value})}/></label>}
              <label>Coordonnateur<input value={edtForm.coordonnateur} onChange={e => setEdtForm({...edtForm, coordonnateur:e.target.value})}/></label>
              <label>Supports prévus<input type="number" value={edtForm.supports_prevus} onChange={e => setEdtForm({...edtForm, supports_prevus:e.target.value})}/></label>
              <label>Description<textarea value={edtForm.description} onChange={e => setEdtForm({...edtForm, description:e.target.value})}/></label>
              <button className="v07-primary" disabled={busy}>{edtForm.id ? 'Enregistrer' : 'Créer l’EDT'}</button>
            </form>
          )}

          <section className="v07-card operations-wide">
            <h2>EDT et progression</h2>
            <div className="edt-list">
              {visibleEdts.map(edt => {
                const progress = computeEdtProgress(edt, data.workOrders, data.phases);
                return <article key={edt.id} className={String(selectedEdtId) === String(edt.id) ? 'selected' : ''}>
                  <button className="edt-select" onClick={() => setSelectedEdtId(String(edt.id))}>
                    <div><strong>{edt.no_edt || `EDT-${edt.id}`}</strong><span>{edt.nom || edt.campagne || 'EDT'}</span></div>
                    <span>{edt.statut || 'Planifié'}</span>
                  </button>
                  <div className="progress-track"><i style={{width:`${progress}%`}}/></div>
                  <small>{progress}% — {edt.client || 'Client non précisé'} — fin prévue {edt.date_fin_prevue || '—'}</small>
                  {canManage && <div className="edt-actions">
                    <button onClick={() => setEdtForm({...emptyEdt, ...edt})}>Modifier</button>
                    {canDeleteEdt && <button className="danger" disabled={busy} onClick={() => openDeleteDialog(edt)}><Trash2 size={15}/> Supprimer l'EDT</button>}
                    <button onClick={() => run(() => closeEdt(edt.id), 'EDT clôturé.')}>Clôturer</button>
                  </div>}
                </article>;
              })}
              {!visibleEdts.length && <p className="executive-empty">Aucun EDT pour ce support</p>}
            </div>
          </section>

          {selectedEdt && (
            <section className="v07-card operations-wide edt-detail">
              <h2>{selectedEdt.no_edt} — Phases et assignations</h2>
              <div className="edt-detail-columns">
                <div>
                  <h3>Phases</h3>
                  {data.phases.filter(item => String(item.edt_id) === String(selectedEdt.id)).map(phase => (
                    <article className="phase-item" key={phase.id}>
                      <strong>{phase.ordre}. {phase.nom}</strong>
                      <span>{phase.statut} — {phase.progression || 0}%</span>
                      {canManage && <input type="range" min="0" max="100" value={phase.progression || 0} onChange={e => run(() => updatePhase(phase.id, { progression:Number(e.target.value), statut:Number(e.target.value) === 100 ? 'Terminée' : 'En cours' }), 'Progression mise à jour.')}/>}
                    </article>
                  ))}
                  {canManage && <form className="mini-form" onSubmit={submitPhase}>
                    <input placeholder="Nom de la phase" value={phaseForm.nom} onChange={e => setPhaseForm({...phaseForm, nom:e.target.value})}/>
                    <input type="number" min="1" value={phaseForm.ordre} onChange={e => setPhaseForm({...phaseForm, ordre:e.target.value})}/>
                    <button><Plus size={15}/> Ajouter</button>
                  </form>}
                </div>

                <div>
                  <h3>Assignations</h3>
                  {data.assignments.filter(item => String(item.edt_id) === String(selectedEdt.id)).map(item => (
                    <article className="assignment-item" key={item.id}>
                      <UserPlus size={17}/><div><strong>{item.user_email}</strong><span>{item.role_assignment} — {item.statut}</span></div>
                    </article>
                  ))}
                  {canManage && <form className="mini-form" onSubmit={submitAssignment}>
                    <select value={assignment.user_email} onChange={e => setAssignment({...assignment, user_email:e.target.value})}>
                      <option value="">Choisir un utilisateur</option>
                      {data.users.filter(user => user.statut === 'Actif').map(user => <option key={user.id} value={user.courriel}>{user.nom || user.courriel}</option>)}
                    </select>
                    <select value={assignment.role_assignment} onChange={e => setAssignment({...assignment, role_assignment:e.target.value})}>
                      <option>Installateur</option><option>Coordonnateur</option><option>Validateur</option>
                    </select>
                    <button><UserPlus size={15}/> Assigner</button>
                  </form>}
                </div>
              </div>
            </section>
          )}

          {selectedEdt && (
            <EdtLifecyclePanel
              edt={lifecycleDetail?.edt || selectedEdt}
              data={lifecycleDetail ? {...data,...lifecycleDetail} : {...data,phases:[],phaseReports:[],history:[]}}
              canManage={canManage}
              busy={busy}
              run={run}
              loading={lifecycleLoading}
              error={lifecycleError}
              onRetry={() => setLifecycleRevision(value => value + 1)}
            />
          )}

          {selectedEdt && (
            <EdtEnterprisePanel
              edt={selectedEdt}
              data={data}
              canManage={canManage}
              busy={busy}
              run={run}
            />
          )}
        </div>
      )}

      {tab === 'bt' && (
        <div className="operations-layout">
          {canManage && (
            <form className="v07-card operations-form" onSubmit={submitWorkOrder}>
              <h2><Plus/> Créer un bon de travail</h2>
              <label>No BT<input value={btForm.no_bt} onChange={e => setBtForm({...btForm, no_bt:e.target.value})}/></label>
              <label>Type<select value={btForm.type_bt} onChange={e => setBtForm({...btForm, type_bt:e.target.value})}>
                {['Installation','Inspection','Retrait','Entretien','Réparation'].map(item => <option key={item}>{item}</option>)}
              </select></label>
              <label>EDT<select value={btForm.edt_id} onChange={e => {
                const edt = data.edts.find(item => String(item.id) === e.target.value);
                setBtForm({...btForm, edt_id:e.target.value, no_edt:edt?.no_edt || ''});
              }}><option value="">Sans EDT</option>{data.edts.map(item => <option key={item.id} value={item.id}>{item.no_edt}</option>)}</select></label>
              <label>Numéro du support<input value={btForm.support_id} onChange={e => setBtForm({...btForm, support_id:e.target.value})}/></label>
              <label>Assigné à<select value={btForm.assigne_a} onChange={e => setBtForm({...btForm, assigne_a:e.target.value})}><option value="">Non assigné</option>{data.users.filter(u => u.statut === 'Actif').map(u => <option key={u.id} value={u.courriel}>{u.nom || u.courriel}</option>)}</select></label>
              <label>Date cible<input type="date" value={btForm.date_cible} onChange={e => setBtForm({...btForm, date_cible:e.target.value})}/></label>
              <label>Description<textarea value={btForm.description} onChange={e => setBtForm({...btForm, description:e.target.value})}/></label>
              <button className="v07-primary" disabled={busy}>Créer le bon</button>
            </form>
          )}

          <section className="v07-card operations-wide">
            <h2>Bons de travail</h2>
            <div className="bt-grid">
              {visibleWorkOrders.map(order => (
                <article key={order.id} id={`bt-${order.id}`}>
                  <div><strong>{order.no_bt || `BT-${order.id}`}</strong><span>{order.statut}</span></div>
                  <p>{order.description || order.type_bt}</p>
                  <small>Support {order.support_id || '—'} · EDT {order.no_edt || '—'} · {order.assigne_a || 'Non assigné'}</small>
                  <div className="progress-track"><i style={{width:`${Number(order.progression || (order.statut === 'Terminée' ? 100 : 0))}%`}}/></div>
                  {canManage && <div className="bt-actions">
                    <button onClick={() => run(() => updateWorkOrderV11(order.id, {statut:'En cours', progression:Math.max(10, Number(order.progression || 0))}), 'Bon démarré.')}>Démarrer</button>
                    <button onClick={() => run(() => updateWorkOrderV11(order.id, {statut:'Terminée'}), 'Bon terminé.')}>Terminer</button>
                  </div>}
                </article>
              ))}
              {!visibleWorkOrders.length && <p className="executive-empty">Aucun bon de travail pour ce support</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'requests' && (
        <div className="operations-layout">
          <form className="v07-card operations-form" onSubmit={submitRequest}>
            <h2><Send/> Nouvelle requête client</h2>
            <label>Client<input value={requestForm.client} onChange={e => setRequestForm({...requestForm, client:e.target.value})}/></label>
            <label>Demandeur<input value={requestForm.demandeur_nom} onChange={e => setRequestForm({...requestForm, demandeur_nom:e.target.value})}/></label>
            <label>Courriel<input type="email" value={requestForm.demandeur_courriel} onChange={e => setRequestForm({...requestForm, demandeur_courriel:e.target.value})}/></label>
            <label>Type<select value={requestForm.type_requete} onChange={e => setRequestForm({...requestForm, type_requete:e.target.value})}><option>Installation</option><option>Inspection</option><option>Réparation</option><option>Retrait</option></select></label>
            <label>Priorité<select value={requestForm.priorite} onChange={e => setRequestForm({...requestForm, priorite:e.target.value})}><option>Basse</option><option>Normale</option><option>Haute</option><option>Urgente</option></select></label>
            <label>Numéro du support<input value={requestForm.support_id} onChange={e => setRequestForm({...requestForm, support_id:e.target.value})}/></label>
            <label>Description<textarea value={requestForm.description} onChange={e => setRequestForm({...requestForm, description:e.target.value})}/></label>
            <button className="v07-primary" disabled={busy}>Créer la requête</button>
          </form>

          <section className="v07-card operations-wide">
            <h2>Requêtes reçues</h2>
            <div className="request-list">
              {visibleRequests.map(request => (
                <article key={request.id}>
                  <div><strong>REQ-{request.id} — {request.client || 'Client'}</strong><span>{request.statut}</span></div>
                  <p>{request.description}</p>
                  <small>{request.type_requete} · {request.priorite} · Support {request.support_id || '—'}</small>
                  {canManage && request.statut !== 'Convertie' && <button onClick={() => run(() => convertRequestToWorkOrder(request), 'Requête convertie en bon de travail.')}>Convertir en BT</button>}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'history' && (
        <section className="v07-card">
          <h2>Historique des opérations</h2>
          <div className="tableWrap"><table><thead><tr>
            <SortableHeader label="Date" column="created_at" rows={data.history} sortState={historySort} onSort={setHistorySort} onReset={()=>setHistorySort(null)}/>
            <SortableHeader label="Type" column="entity_type" rows={data.history} sortState={historySort} onSort={setHistorySort} onReset={()=>setHistorySort(null)}/>
            <SortableHeader label="Référence" column="entity_reference" rows={data.history} sortState={historySort} onSort={setHistorySort} onReset={()=>setHistorySort(null)}/>
            <SortableHeader label="Action" column="action" rows={data.history} sortState={historySort} onSort={setHistorySort} onReset={()=>setHistorySort(null)}/>
            <SortableHeader label="Utilisateur" column="user_email" rows={data.history} sortState={historySort} onSort={setHistorySort} onReset={()=>setHistorySort(null)}/>
            <SortableHeader label="Détails" column="details" rows={data.history} sortState={historySort} onSort={setHistorySort} onReset={()=>setHistorySort(null)}/>
          </tr></thead><tbody>
            {(supportId?visibleHistory:sortedHistory).map(item => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString('fr-CA')}</td><td>{item.entity_type}</td><td>{item.entity_reference}</td><td>{item.action}</td><td>{item.user_email || '—'}</td><td>{item.details || '—'}</td></tr>)}
          </tbody></table></div>
        </section>
      )}
      {deleteDialog && <div className="edt-delete-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && setDeleteDialog(null)}>
        <section className="edt-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="edt-delete-title">
          <h2 id="edt-delete-title">Supprimer cet EDT ?</h2>
          <dl><div><dt>No EDT</dt><dd>{deleteDialog.impact.no_edt}</dd></div><div><dt>Client</dt><dd>{deleteDialog.impact.client || '-'}</dd></div><div><dt>Campagne / communication</dt><dd>{deleteDialog.impact.campagne || '-'}</dd></div><div><dt>Phases</dt><dd>{deleteDialog.impact.phase_count}</dd></div><div><dt>Supports</dt><dd>{deleteDialog.impact.support_count}</dd></div><div><dt>Bons de travail</dt><dd>{deleteDialog.impact.work_order_count ? 'Oui' : 'Non'}</dd></div><div><dt>Rapports</dt><dd>{deleteDialog.impact.report_count ? 'Oui' : 'Non'}</dd></div></dl>
          <p>{deleteDialog.impact.decision === 'deleted' ? "Cet EDT n'a aucun historique op\u00e9rationnel. Il peut \u00eatre supprim\u00e9 d\u00e9finitivement." : "Cet EDT poss\u00e8de d\u00e9j\u00e0 un historique et ne peut pas \u00eatre supprim\u00e9 d\u00e9finitivement. Il sera archiv\u00e9 afin de pr\u00e9server les rapports et les op\u00e9rations associ\u00e9es."}</p>
          <footer><button disabled={busy} onClick={() => setDeleteDialog(null)}>Annuler</button><button className="danger" disabled={busy} onClick={confirmDeleteEdt}>{deleteDialog.impact.decision === 'deleted' ? "Supprimer l'EDT" : "Archiver l'EDT"}</button></footer>
        </section>
      </div>}
    </div>
  );
}

function Kpi({ icon, label, value }) {
  return <div className="operations-kpi">{icon}<span>{label}</span><strong>{Number(value || 0).toLocaleString('fr-CA')}</strong></div>;
}
