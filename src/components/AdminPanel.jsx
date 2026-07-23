import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Pencil, Plus, RefreshCw, Shield, UserCheck, UserX, Users } from 'lucide-react';
import { listClients, listUsers, saveClient, saveUser, toggleUserStatus } from '../services/adminService';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';

const roles = ['Administrateur', 'Coordonnateur', 'Installateur', 'Client-Admin', 'Client'];
const emptyUser = { nom: '', courriel: '', role: 'Client', organisation: '', statut: 'Actif', client_id: '' };
const emptyClient = { nom_client: '', type_client: '', statut: 'Actif', notes: '' };

export default function AdminPanel({ currentRole }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [userForm, setUserForm] = useState(emptyUser);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const isAdmin = currentRole === 'Administrateur';
  const { sortedRows: sortedUsers, sortState: userSort, setSortState: setUserSort } = useSortableRows(users, null, 'admin-users');

  async function reload() {
    setStatus('loading');
    setMessage('');
    try {
      const [userRows, clientRows] = await Promise.all([listUsers(), listClients()]);
      setUsers(userRows);
      setClients(clientRows);
      setStatus('done');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Erreur de chargement');
    }
  }

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'Administrateur').length,
    installers: users.filter(u => u.role === 'Installateur').length,
    inactive: users.filter(u => String(u.statut || '').toLowerCase() !== 'actif').length
  }), [users]);

  async function submitUser(e) {
    e.preventDefault();
    setStatus('saving');
    setMessage('');
    try {
      await saveUser(userForm);
      setUserForm(emptyUser);
      await reload();
      setMessage('Utilisateur enregistré.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Erreur d’enregistrement');
    }
  }

  async function submitClient(e) {
    e.preventDefault();
    setStatus('saving');
    setMessage('');
    try {
      await saveClient(clientForm);
      setClientForm(emptyClient);
      await reload();
      setMessage('Client enregistré.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Erreur d’enregistrement');
    }
  }

  async function changeStatus(user) {
    try {
      await toggleUserStatus(user);
      await reload();
    } catch (error) {
      setMessage(error.message || 'Erreur de mise à jour');
    }
  }

  if (!isAdmin) {
    return <div className="admin-page"><section className="admin-panel"><h1><Shield /> Accès réservé</h1><p>Le centre d’administration est réservé au rôle Administrateur.</p></section></div>;
  }

  return (
    <div className="admin-page">
      <header className="admin-hero">
        <div><h1>TOS Control Center</h1><p>Gestion interne des utilisateurs, des clients et des rôles.</p></div>
        <button onClick={reload}><RefreshCw size={18} /> Actualiser</button>
      </header>

      <div className="admin-stats">
        <Stat icon={<Users />} label="Utilisateurs" value={stats.total} />
        <Stat icon={<Shield />} label="Administrateurs" value={stats.admins} />
        <Stat icon={<UserCheck />} label="Installateurs" value={stats.installers} />
        <Stat icon={<UserX />} label="Inactifs" value={stats.inactive} />
      </div>

      <nav className="admin-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><Users size={18} /> Utilisateurs</button>
        <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}><Building2 size={18} /> Clients</button>
      </nav>

      {message && <div className={status === 'error' ? 'admin-message error' : 'admin-message'}>{message}</div>}

      {tab === 'users' ? (
        <div className="admin-layout">
          <section className="admin-panel">
            <h2><Plus size={20} /> {userForm.id ? 'Modifier l’utilisateur' : 'Ajouter un utilisateur'}</h2>
            <form onSubmit={submitUser} className="admin-form">
              <label>Nom<input value={userForm.nom} onChange={e => setUserForm({ ...userForm, nom: e.target.value })} /></label>
              <label>Courriel<input type="email" required value={userForm.courriel} onChange={e => setUserForm({ ...userForm, courriel: e.target.value })} /></label>
              <label>Rôle<select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>{roles.map(r => <option key={r}>{r}</option>)}</select></label>
              <label>Organisation<input value={userForm.organisation} onChange={e => setUserForm({ ...userForm, organisation: e.target.value })} /></label>
              <label>Client<select value={userForm.client_id || ''} onChange={e => setUserForm({ ...userForm, client_id: e.target.value })}><option value="">Aucun</option>{clients.map(c => <option key={c.id} value={c.id}>{c.nom_client}</option>)}</select></label>
              <label>Statut<select value={userForm.statut} onChange={e => setUserForm({ ...userForm, statut: e.target.value })}><option>Actif</option><option>Inactif</option></select></label>
              <div className="admin-form-actions">
                <button type="submit" disabled={status === 'saving'}>{userForm.id ? 'Enregistrer' : 'Créer le profil'}</button>
                {userForm.id && <button type="button" className="secondary" onClick={() => setUserForm(emptyUser)}>Annuler</button>}
              </div>
              <small>Ce bloc gère le profil applicatif. L’invitation Auth automatisée arrivera dans le Bloc 4.1.</small>
            </form>
          </section>

          <section className="admin-panel wide">
            <h2>Utilisateurs</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr>
                  <SortableHeader label="Nom" column="nom" rows={users} sortState={userSort} onSort={setUserSort} onReset={() => setUserSort(null)}/>
                  <SortableHeader label="Courriel" column="courriel" rows={users} sortState={userSort} onSort={setUserSort} onReset={() => setUserSort(null)}/>
                  <SortableHeader label="Rôle" column="role" rows={users} sortState={userSort} onSort={setUserSort} onReset={() => setUserSort(null)}/>
                  <SortableHeader label="Organisation" column="organisation" rows={users} sortState={userSort} onSort={setUserSort} onReset={() => setUserSort(null)}/>
                  <SortableHeader label="Statut" column="statut" rows={users} sortState={userSort} onSort={setUserSort} onReset={() => setUserSort(null)}/>
                  <th>Actions</th>
                </tr></thead>
                <tbody>{sortedUsers.map(user => <tr key={user.id}>
                  <td>{user.nom}</td><td>{user.courriel}</td><td>{user.role}</td><td>{user.organisation}</td><td>{user.statut}</td>
                  <td className="row-actions">
                    <button onClick={() => setUserForm({ ...emptyUser, ...user, client_id: user.client_id || '' })}><Pencil size={16} /></button>
                    <button onClick={() => changeStatus(user)}>{String(user.statut).toLowerCase() === 'actif' ? <UserX size={16} /> : <UserCheck size={16} />}</button>
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="admin-layout">
          <section className="admin-panel">
            <h2><Plus size={20} /> {clientForm.id ? 'Modifier le client' : 'Ajouter un client'}</h2>
            <form onSubmit={submitClient} className="admin-form">
              <label>Nom du client<input required value={clientForm.nom_client} onChange={e => setClientForm({ ...clientForm, nom_client: e.target.value })} /></label>
              <label>Type<input value={clientForm.type_client} onChange={e => setClientForm({ ...clientForm, type_client: e.target.value })} /></label>
              <label>Statut<select value={clientForm.statut} onChange={e => setClientForm({ ...clientForm, statut: e.target.value })}><option>Actif</option><option>Inactif</option></select></label>
              <label>Notes<textarea value={clientForm.notes} onChange={e => setClientForm({ ...clientForm, notes: e.target.value })} /></label>
              <div className="admin-form-actions">
                <button type="submit">{clientForm.id ? 'Enregistrer' : 'Créer le client'}</button>
                {clientForm.id && <button type="button" className="secondary" onClick={() => setClientForm(emptyClient)}>Annuler</button>}
              </div>
            </form>
          </section>

          <section className="admin-panel wide">
            <h2>Clients</h2>
            <div className="client-cards">{clients.map(client => <article key={client.id} className="client-card">
              <div><strong>{client.nom_client}</strong><span>{client.type_client || 'Client'}</span><small>{client.statut}</small></div>
              <button onClick={() => setClientForm({ ...emptyClient, ...client })}><Pencil size={16} /> Modifier</button>
            </article>)}</div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return <div className="admin-stat">{icon}<span>{label}</span><strong>{Number(value || 0).toLocaleString('fr-CA')}</strong></div>;
}
