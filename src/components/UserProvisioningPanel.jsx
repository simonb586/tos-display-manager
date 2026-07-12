import React, { useState } from 'react';
import { Send, UserPlus } from 'lucide-react';
import { inviteRealUser } from '../services/userProvisioningService';

const roles = ['Administrateur', 'Coordonnateur', 'Installateur', 'Client-Admin', 'Client'];
const emptyForm = { nom: '', courriel: '', role: 'Installateur', organisation: 'Groupe TOS', client_id: '' };

export default function UserProvisioningPanel({ role }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (role !== 'Administrateur') {
    return <div className="admin-page"><section className="admin-panel"><h1>Accès réservé</h1><p>La création de comptes réels est réservée aux administrateurs.</p></section></div>;
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await inviteRealUser(form);
      setMessage(`Invitation envoyée à ${form.courriel}.`);
      setForm(emptyForm);
    } catch (error) {
      setMessage(error.message || 'Invitation impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-hero"><div><h1>Utilisateurs réels</h1><p>Crée un compte Supabase Auth et envoie une invitation sécurisée.</p></div></header>
      {message && <div className="admin-message">{message}</div>}
      <section className="admin-panel production-user-panel">
        <h2><UserPlus size={20}/> Inviter un utilisateur</h2>
        <form className="admin-form" onSubmit={submit}>
          <label>Nom<input required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}/></label>
          <label>Courriel<input required type="email" value={form.courriel} onChange={e => setForm({ ...form, courriel: e.target.value })}/></label>
          <label>Rôle<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Organisation<input value={form.organisation} onChange={e => setForm({ ...form, organisation: e.target.value })}/></label>
          <label>Client ID (facultatif)<input type="number" min="1" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}/></label>
          <button type="submit" disabled={busy}><Send size={18}/> {busy ? 'Envoi...' : 'Créer et inviter'}</button>
        </form>
      </section>
    </div>
  );
}
