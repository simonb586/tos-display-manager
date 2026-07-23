import React, { useEffect, useState } from 'react';
import {
  Ban,
  KeyRound,
  LoaderCircle,
  MailPlus,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  X
} from 'lucide-react';
import {
  inviteRealUser,
  listManagedUsers,
  manageUser,
  updateManagedUser
} from '../services/userProvisioningService';

const roles = ['Administrateur', 'Coordonnateur', 'Installateur', 'Client-Admin', 'Client'];
const emptyForm = {
  nom: '',
  courriel: '',
  role: 'Installateur',
  organisation: 'Groupe TOS',
  client_id: ''
};

export default function UserProvisioningPanel({ role }) {
  const [form, setForm] = useState(emptyForm);
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const isAdmin = role === 'Administrateur';

  async function reload() {
    if (!isAdmin) return;
    setBusyAction('list');
    try {
      setUsers(await listManagedUsers());
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Chargement impossible.');
    } finally {
      setBusyAction('');
    }
  }

  useEffect(() => {
    reload();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <section className="admin-panel">
          <h1>Accès réservé</h1>
          <p>La gestion des comptes réels est réservée aux administrateurs.</p>
        </section>
      </div>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setBusyAction('invite');
    setMessage('');

    try {
      const result = await inviteRealUser(form);
      setMessage(result.message || `Invitation envoyée à ${form.courriel}.`);
      setForm(emptyForm);
      await reload();
    } catch (error) {
      setMessage(error.message || 'Invitation impossible.');
    } finally {
      setBusyAction('');
    }
  }

  async function runAction(action, user, confirmation = '') {
    if (confirmation && !window.confirm(confirmation)) return;

    setBusyAction(`${action}:${user.courriel || user.email}`);
    setMessage('');

    try {
      const result = await manageUser(action, user);
      setMessage(result.message || 'Action terminée.');
      await reload();
    } catch (error) {
      setMessage(error.message || 'Action impossible.');
    } finally {
      setBusyAction('');
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setBusyAction(`update:${editing.courriel}`);

    try {
      await updateManagedUser(editing, {
        nom: editing.nom,
        role: editing.role,
        organisation: editing.organisation,
        statut: editing.statut
      });
      setEditing(null);
      setMessage('Utilisateur modifié.');
      await reload();
    } catch (error) {
      setMessage(error.message || 'Modification impossible.');
    } finally {
      setBusyAction('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-hero user-v2-hero">
        <div>
          <h1>Utilisateurs réels</h1>
          <p>Invitations de production, états réels et gestion complète des accès.</p>
        </div>
        <button onClick={reload} disabled={Boolean(busyAction)}>
          {busyAction === 'list'
            ? <LoaderCircle className="spin" size={18}/>
            : <RefreshCw size={18}/>}
          Actualiser
        </button>
      </header>

      {message && <div className="admin-message">{message}</div>}

      <div className="user-v2-layout">
        <section className="admin-panel production-user-panel">
          <h2><UserPlus size={20}/> Inviter un utilisateur</h2>
          <p className="user-production-note">
            Le lien d’invitation pointe toujours vers l’adresse publique configurée.
          </p>

          <form className="admin-form" onSubmit={submit}>
            <label>
              Nom
              <input
                required
                value={form.nom}
                onChange={event => setForm({ ...form, nom: event.target.value })}
              />
            </label>
            <label>
              Courriel
              <input
                required
                type="email"
                value={form.courriel}
                onChange={event => setForm({ ...form, courriel: event.target.value })}
              />
            </label>
            <label>
              Rôle
              <select
                value={form.role}
                onChange={event => setForm({ ...form, role: event.target.value })}
              >
                {roles.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Organisation
              <input
                value={form.organisation}
                onChange={event => setForm({ ...form, organisation: event.target.value })}
              />
            </label>
            <label>
              Client ID (facultatif)
              <input
                type="number"
                min="1"
                value={form.client_id}
                onChange={event => setForm({ ...form, client_id: event.target.value })}
              />
            </label>
            <button type="submit" disabled={Boolean(busyAction)}>
              {busyAction === 'invite'
                ? <LoaderCircle className="spin" size={18}/>
                : <Send size={18}/>}
              Créer et inviter
            </button>
          </form>
        </section>

        <section className="admin-panel user-v2-list-panel">
          <div className="user-v2-list-head">
            <div>
              <h2>Comptes et invitations</h2>
              <p>{users.length} utilisateur(s)</p>
            </div>
          </div>

          <div className="user-v2-list">
            {users.map(user => {
              const key = user.auth_user_id || user.profile_id || user.courriel;
              const pending = busyAction.endsWith(`:${user.courriel}`);
              const neverConnected = !user.last_sign_in_at;

              return (
                <article key={key}>
                  <div className="user-v2-identity">
                    <strong>{user.nom || user.courriel}</strong>
                    <span>{user.courriel}</span>
                    <small>{user.role} — {user.organisation || 'Aucune organisation'}</small>
                  </div>

                  <div className="user-v2-status">
                    <span className={`user-status ${String(user.lifecycle_status || '').toLowerCase().replaceAll(' ', '-')}`}>
                      {user.lifecycle_status || user.statut || 'Inconnu'}
                    </span>
                    <small>
                      {neverConnected
                        ? 'Jamais connecté'
                        : `Dernière activité : ${new Date(user.last_sign_in_at).toLocaleString('fr-CA')}`}
                    </small>
                  </div>

                  <div className="user-v2-actions user-v2-actions-visible">
                    <button disabled={pending} onClick={() => setEditing(user)}>
                      <Pencil size={15}/> Modifier
                    </button>

                    <button
                      disabled={pending}
                      onClick={() => runAction('resend_invite', user)}
                    >
                      <MailPlus size={15}/> Renvoyer
                    </button>

                    {String(user.statut || 'Actif') === 'Actif' ? (
                      <button
                        disabled={pending}
                        onClick={() => runAction(
                          'deactivate',
                          user,
                          `Désactiver ${user.courriel}?`
                        )}
                      >
                        <Ban size={15}/> Désactiver
                      </button>
                    ) : (
                      <button
                        disabled={pending}
                        onClick={() => runAction('reactivate', user)}
                      >
                        <UserCheck size={15}/> Réactiver
                      </button>
                    )}

                    <button
                      disabled={pending}
                      onClick={() => runAction('reset_password', user)}
                    >
                      <KeyRound size={15}/> Mot de passe
                    </button>

                    <button
                      className="danger user-delete-button"
                      disabled={pending}
                      title="Supprimer complètement cet utilisateur"
                      onClick={() => runAction(
                        'delete',
                        user,
                        `Supprimer complètement le compte Auth et le profil de ${user.courriel}? Les historiques opérationnels seront conservés.`
                      )}
                    >
                      <Trash2 size={15}/> Supprimer l’utilisateur
                    </button>
                  </div>
                </article>
              );
            })}

            {!users.length && <p>Aucun utilisateur à afficher.</p>}
          </div>
        </section>
      </div>

      {editing && (
        <div className="user-edit-modal">
          <form onSubmit={saveEdit}>
            <button type="button" className="user-edit-close" onClick={() => setEditing(null)}>
              <X/>
            </button>
            <h2>Modifier l’utilisateur</h2>
            <label>
              Nom
              <input
                value={editing.nom || ''}
                onChange={event => setEditing({ ...editing, nom: event.target.value })}
              />
            </label>
            <label>
              Rôle
              <select
                value={editing.role || 'Installateur'}
                onChange={event => setEditing({ ...editing, role: event.target.value })}
              >
                {roles.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Organisation
              <input
                value={editing.organisation || ''}
                onChange={event => setEditing({ ...editing, organisation: event.target.value })}
              />
            </label>
            <label>
              Statut
              <select
                value={editing.statut || 'Actif'}
                onChange={event => setEditing({ ...editing, statut: event.target.value })}
              >
                <option>Actif</option>
                <option>Désactivé</option>
              </select>
            </label>
            <button disabled={busyAction.startsWith('update:')}>
              {busyAction.startsWith('update:')
                ? <LoaderCircle className="spin" size={17}/>
                : <RotateCcw size={17}/>}
              Enregistrer
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
