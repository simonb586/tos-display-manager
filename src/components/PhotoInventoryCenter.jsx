import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Image,
  Package,
  RefreshCw,
  Star,
  Trash2,
  XCircle
} from 'lucide-react';
import {
  createInventoryMovement,
  listInventoryMovements,
  listSupportPhotosForValidation,
  makePrimaryPhoto,
  validateSupportPhoto
} from '../services/photoInventoryService';
import { deleteSupportPhoto } from '../services/photoLibraryService';
import { friendlyError } from '../config/businessLanguage';
import SortableHeader from './SortableHeader';
import useSortableRows from '../hooks/useSortableRows';

export default function PhotoInventoryCenter({ role }) {
  const [tab, setTab] = useState('photos');
  const [photos, setPhotos] = useState([]);
  const [movements, setMovements] = useState([]);
  const [message, setMessage] = useState('');
  const {sortedRows:sortedMovements,sortState:movementSort,setSortState:setMovementSort}=useSortableRows(movements, null, 'inventory-movements');
  const [movement, setMovement] = useState({
    item_reference: '',
    movement_type: 'Entrée',
    quantity: 1,
    edt_number: '',
    support_id: '',
    notes: ''
  });

  const canManage = ['Administrateur', 'Coordonnateur'].includes(role);

  async function reload() {
    try {
      const [nextPhotos, nextMovements] = await Promise.all([
        listSupportPhotosForValidation(),
        listInventoryMovements()
      ]);
      setPhotos(nextPhotos);
      setMovements(nextMovements);
      setMessage('');
    } catch (error) {
      setMessage(friendlyError(error, 'Impossible de charger les photos et l’inventaire.'));
    }
  }

  useEffect(() => { reload(); }, []);

  async function setStatus(photo, status) {
    const comment = status === 'Rejetée'
      ? window.prompt('Motif du rejet :', '') || ''
      : '';

    try {
      await validateSupportPhoto(photo.id, status, comment);
      setMessage(`Photo ${status.toLowerCase()}.`);
      await reload();
    } catch (error) {
      setMessage(friendlyError(error, 'Impossible de modifier l’état de cette photo.'));
    }
  }

  async function removePhoto(photo) {
    if (!canManage) return;
    const confirmed = window.confirm(
      `Supprimer définitivement la photo « ${photo.nom_fichier || photo.id} » ? Cette action est irréversible.`
    );
    if (!confirmed) return;

    try {
      await deleteSupportPhoto(photo);
      setMessage('Photo supprimée définitivement.');
      await reload();
    } catch (error) {
      setMessage(friendlyError(error, 'Impossible de supprimer cette photo.'));
    }
  }

  async function setPrimary(photo) {
    try {
      await makePrimaryPhoto(photo);
      setMessage('Photo principale mise à jour.');
      await reload();
    } catch (error) {
      setMessage(friendlyError(error, 'Impossible de définir cette photo comme principale.'));
    }
  }

  async function addMovement(event) {
    event.preventDefault();
    try {
      await createInventoryMovement(movement);
      setMovement({
        item_reference: '',
        movement_type: 'Entrée',
        quantity: 1,
        edt_number: '',
        support_id: '',
        notes: ''
      });
      setMessage('Mouvement d’inventaire enregistré.');
      await reload();
    } catch (error) {
      setMessage(error.message || 'Erreur d’inventaire.');
    }
  }

  return (
    <div className="photo-inventory-page">
      <header className="editor-hero">
        <div>
          <h1><Image/> Photos et inventaire</h1>
          <p>Validation des preuves terrain, photo principale et mouvements d’affiches.</p>
        </div>
        <button onClick={reload}><RefreshCw size={17}/> Actualiser</button>
      </header>

      {message && <div className="v07-message">{message}</div>}

      <div className="editor-tabs">
        <button className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>
          <Image size={17}/> Photos
        </button>
        <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>
          <Package size={17}/> Inventaire
        </button>
      </div>

      {tab === 'photos' ? (
        <div className="photo-review-grid">
          {photos.map(photo => (
            <article key={photo.id}>
              <div className="photo-review-image">
                {photo.signed_thumbnail_url
                  ? <img loading="lazy" src={photo.signed_thumbnail_url} alt={photo.nom_fichier}/>
                  : <span>Aperçu indisponible</span>}
              </div>
              <div className="photo-review-body">
                <strong>{photo.support_id}</strong>
                <span>{photo.nom_fichier}</span>
                <small>{photo.statut_validation} — {new Date(photo.prise_le).toLocaleString('fr-CA')}</small>
                {photo.commentaire_validation && <small>{photo.commentaire_validation}</small>}
                {canManage && (
                  <div className="photo-review-actions">
                    <button onClick={() => setStatus(photo, 'Validée')}><CheckCircle2/> Valider</button>
                    <button onClick={() => setStatus(photo, 'Rejetée')}><XCircle/> Rejeter</button>
                    <button onClick={() => setPrimary(photo)}><Star/> Principale</button>
                    <button className="danger" onClick={() => removePhoto(photo)}><Trash2/> Supprimer</button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {!photos.length && <p>Aucune photo à afficher.</p>}
        </div>
      ) : (
        <div className="inventory-layout">
          <form className="v07-card" onSubmit={addMovement}>
            <h2>Nouveau mouvement</h2>
            <label>Référence du visuel
              <input value={movement.item_reference} onChange={e => setMovement({...movement, item_reference: e.target.value})}/>
            </label>
            <label>Type
              <select value={movement.movement_type} onChange={e => setMovement({...movement, movement_type: e.target.value})}>
                <option>Entrée</option>
                <option>Installation</option>
                <option>Retrait</option>
                <option>Retour</option>
                <option>Ajustement</option>
              </select>
            </label>
            <label>Quantité
              <input type="number" value={movement.quantity} onChange={e => setMovement({...movement, quantity: e.target.value})}/>
            </label>
            <label>EDT
              <input value={movement.edt_number} onChange={e => setMovement({...movement, edt_number: e.target.value})}/>
            </label>
            <label>Numéro du support
              <input value={movement.support_id} onChange={e => setMovement({...movement, support_id: e.target.value})}/>
            </label>
            <label>Notes
              <textarea value={movement.notes} onChange={e => setMovement({...movement, notes: e.target.value})}/>
            </label>
            <button className="v07-primary" disabled={!canManage}>Enregistrer</button>
          </form>

          <section className="v07-card">
            <h2>Historique des mouvements</h2>
            <div className="tableWrap">
              <table>
                <thead><tr>
                  <SortableHeader label="Date" column="created_at" rows={movements} sortState={movementSort} onSort={setMovementSort} onReset={()=>setMovementSort(null)}/>
                  <SortableHeader label="Référence" column="item_reference" rows={movements} sortState={movementSort} onSort={setMovementSort} onReset={()=>setMovementSort(null)}/>
                  <SortableHeader label="Type" column="movement_type" rows={movements} sortState={movementSort} onSort={setMovementSort} onReset={()=>setMovementSort(null)}/>
                  <SortableHeader label="Qté" column="quantity" rows={movements} sortState={movementSort} onSort={setMovementSort} onReset={()=>setMovementSort(null)}/>
                  <SortableHeader label="EDT" column="edt_number" rows={movements} sortState={movementSort} onSort={setMovementSort} onReset={()=>setMovementSort(null)}/>
                  <SortableHeader label="Support" column="support_id" rows={movements} sortState={movementSort} onSort={setMovementSort} onReset={()=>setMovementSort(null)}/>
                </tr></thead>
                <tbody>{sortedMovements.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString('fr-CA')}</td>
                    <td>{item.item_reference}</td>
                    <td>{item.movement_type}</td>
                    <td>{item.quantity}</td>
                    <td>{item.edt_number}</td>
                    <td>{item.support_id}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
