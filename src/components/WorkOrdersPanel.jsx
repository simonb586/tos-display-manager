import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, Pencil, Plus, RefreshCw, Search, Trash2, UserRound } from 'lucide-react';
import { createWorkOrder, deleteWorkOrder, listInstallers, listWorkOrders, updateWorkOrder } from '../services/workOrderService';

const emptyOrder = {
  no_bt: '',
  type_bt: 'Inspection',
  support_id: '',
  no_edt: '',
  priorite: 'Normale',
  statut: 'À faire',
  assigne_a: '',
  date_cible: '',
  client: '',
  description: ''
};

const statuses = ['À faire', 'En cours', 'En attente', 'Terminée', 'Annulée'];
const priorities = ['Basse', 'Normale', 'Haute', 'Urgente'];

export default function WorkOrdersPanel({ dataStore, role, session }) {
  const [orders, setOrders] = useState([]);
  const [installers, setInstallers] = useState([]);
  const [form, setForm] = useState(emptyOrder);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle');

  const canManage = ['Administrateur', 'Coordonnateur'].includes(role);

  async function reload() {
    setState('loading');
    setMessage('');
    try {
      const [workOrders, users] = await Promise.all([listWorkOrders(), listInstallers()]);
      setOrders(workOrders);
      setInstallers(users);
      setState('done');
    } catch (error) {
      setState('error');
      setMessage(error.message || 'Erreur de chargement');
    }
  }

  useEffect(() => { reload(); }, []);

  const stats = useMemo(() => ({
    total: orders.length,
    todo: orders.filter(o => o.statut === 'À faire').length,
    doing: orders.filter(o => o.statut === 'En cours').length,
    done: orders.filter(o => o.statut === 'Terminée').length
  }), [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(order => {
      const matchesQuery = !q || [
        order.no_bt,
        order.support_id,
        order.no_edt,
        order.assigne_a,
        order.client,
        order.description
      ].some(value => String(value || '').toLowerCase().includes(q));

      return matchesQuery
        && (!statusFilter || order.statut === statusFilter)
        && (!priorityFilter || order.priorite === priorityFilter);
    });
  }, [orders, query, statusFilter, priorityFilter]);

  async function submit(e) {
    e.preventDefault();
    if (!canManage) return;

    setState('saving');
    setMessage('');

    try {
      const payload = {
        ...form,
        created_by: session?.user?.email || ''
      };

      if (form.id) {
        await updateWorkOrder(form.id, payload);
        setMessage('Bon de travail modifié.');
      } else {
        await createWorkOrder(payload);
        setMessage('Bon de travail créé.');
      }

      setForm(emptyOrder);
      await reload();
    } catch (error) {
      setState('error');
      setMessage(error.message || 'Erreur d’enregistrement');
    }
  }

  async function quickStatus(order, statut) {
    try {
      await updateWorkOrder(order.id, { statut });
      await reload();
    } catch (error) {
      setMessage(error.message || 'Erreur de mise à jour');
    }
  }

  async function remove(order) {
    if (!window.confirm(`Supprimer ${order.no_bt || 'ce bon de travail'}?`)) return;
    try {
      await deleteWorkOrder(order.id);
      await reload();
    } catch (error) {
      setMessage(error.message || 'Erreur de suppression');
    }
  }

  return (
    <div className="workorders-page">
      <header className="workorders-hero">
        <div>
          <h1>Bons de travail</h1>
          <p>Création, assignation, priorités et suivi des interventions.</p>
        </div>
        <button onClick={reload}><RefreshCw size={18} /> Actualiser</button>
      </header>

      <div className="workorders-stats">
        <Stat icon={<ClipboardList />} label="Total" value={stats.total} />
        <Stat icon={<Clock3 />} label="À faire" value={stats.todo} />
        <Stat icon={<UserRound />} label="En cours" value={stats.doing} />
        <Stat icon={<CheckCircle2 />} label="Terminés" value={stats.done} />
      </div>

      {message && <div className={state === 'error' ? 'workorders-message error' : 'workorders-message'}>{message}</div>}

      <div className="workorders-layout">
        {canManage && (
          <section className="workorders-card">
            <h2><Plus size={20} /> {form.id ? 'Modifier le bon' : 'Créer un bon de travail'}</h2>
            <form className="workorders-form" onSubmit={submit}>
              <label>No BT<input value={form.no_bt} onChange={e => setForm({ ...form, no_bt: e.target.value })} placeholder="Automatique si vide" /></label>
              <label>Type
                <select value={form.type_bt} onChange={e => setForm({ ...form, type_bt: e.target.value })}>
                  <option>Inspection</option>
                  <option>Installation</option>
                  <option>Retrait</option>
                  <option>Entretien</option>
                  <option>Réparation</option>
                </select>
              </label>
              <label>Numéro du support<input value={form.support_id} onChange={e => setForm({ ...form, support_id: e.target.value })} /></label>
              <label>No EDT<input value={form.no_edt} onChange={e => setForm({ ...form, no_edt: e.target.value })} /></label>
              <label>Priorité<select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value })}>{priorities.map(p => <option key={p}>{p}</option>)}</select></label>
              <label>Statut<select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
              <label>Assigné à
                <select value={form.assigne_a} onChange={e => setForm({ ...form, assigne_a: e.target.value })}>
                  <option value="">Non assigné</option>
                  {installers.map(user => <option key={user.id} value={user.courriel || user.nom}>{user.nom || user.courriel}</option>)}
                </select>
              </label>
              <label>Date cible<input type="date" value={form.date_cible || ''} onChange={e => setForm({ ...form, date_cible: e.target.value })} /></label>
              <label>Client<input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} /></label>
              <label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
              <div className="workorders-actions">
                <button type="submit">{form.id ? 'Enregistrer' : 'Créer le bon'}</button>
                {form.id && <button type="button" className="secondary" onClick={() => setForm(emptyOrder)}>Annuler</button>}
              </div>
            </form>
          </section>
        )}

        <section className="workorders-card wide">
          <div className="workorders-toolbar">
            <div className="workorders-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="BT, support, EDT, assigné, client..." /></div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tous les statuts</option>{statuses.map(s => <option key={s}>{s}</option>)}</select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="">Toutes les priorités</option>{priorities.map(p => <option key={p}>{p}</option>)}</select>
          </div>

          <div className="workorders-list">
            {filtered.map(order => (
              <article className="workorder-item" key={order.id}>
                <div className="workorder-main">
                  <div className="workorder-title">
                    <strong>{order.no_bt || `BT-${order.id}`}</strong>
                    <span className={`priority ${String(order.priorite || '').toLowerCase()}`}>{order.priorite || 'Normale'}</span>
                    <span className="status">{order.statut || 'À faire'}</span>
                  </div>
                  <p>{order.description || order.type_bt || 'Intervention'}</p>
                  <div className="workorder-meta">
                    <span>Support : {order.support_id || '—'}</span>
                    <span>EDT : {order.no_edt || '—'}</span>
                    <span>Assigné : {order.assigne_a || 'Non assigné'}</span>
                    <span><CalendarDays size={15} /> {order.date_cible || 'Sans date'}</span>
                  </div>
                </div>

                <div className="workorder-buttons">
                  {order.statut !== 'En cours' && <button onClick={() => quickStatus(order, 'En cours')}>Démarrer</button>}
                  {order.statut !== 'Terminée' && <button className="done" onClick={() => quickStatus(order, 'Terminée')}>Terminer</button>}
                  {canManage && <button className="icon" onClick={() => setForm({ ...emptyOrder, ...order })}><Pencil size={16} /></button>}
                  {canManage && <button className="icon danger" onClick={() => remove(order)}><Trash2 size={16} /></button>}
                </div>
              </article>
            ))}
            {!filtered.length && <div className="workorders-empty">Aucun bon de travail correspondant.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }) {
  return <div className="workorders-stat">{icon}<span>{label}</span><strong>{Number(value || 0).toLocaleString('fr-CA')}</strong></div>;
}
