import React, { useCallback, useEffect, useState } from 'react';
import { Image, Trash2, X } from 'lucide-react';
import { deleteSupportPhoto, listSupportPhotos } from '../services/photoLibraryService';

export default function SupportPhotoGallery({ supportId, canDelete = false }) {
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async () => {
    if (!supportId) return;
    setMessage('');
    try {
      setPhotos(await listSupportPhotos(supportId));
    } catch (error) {
      setMessage(error.message || 'Impossible de charger les photos.');
    }
  }, [supportId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function removePhoto(photo) {
    const confirmed = window.confirm(
      `Supprimer définitivement la photo « ${photo.nom_fichier || photo.id} » ?`
    );
    if (!confirmed) return;

    setBusyId(photo.id);
    setMessage('');
    try {
      await deleteSupportPhoto(photo);
      setSelected(current => current?.id === photo.id ? null : current);
      await refresh();
      setMessage('Photo supprimée avec succès.');
    } catch (error) {
      setMessage(error.message || 'La suppression de la photo a échoué.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="support-gallery">
      <h3><Image size={18}/> Galerie du support</h3>
      {message && <p role="status">{message}</p>}
      <div className="support-gallery-grid">
        {photos.map(photo => (
          <article className="support-gallery-item" key={photo.id}>
            <button className="support-gallery-open" type="button" onClick={() => setSelected(photo)}>
              <img src={photo.thumbnail_url || photo.photo_url} alt={photo.nom_fichier || 'Photo du support'}/>
              <span>{photo.prise_le ? new Date(photo.prise_le).toLocaleDateString('fr-CA') : 'Date inconnue'}</span>
            </button>
            {canDelete && (
              <button
                className="support-gallery-delete"
                type="button"
                disabled={busyId === photo.id}
                onClick={() => removePhoto(photo)}
                aria-label={`Supprimer ${photo.nom_fichier || 'la photo'}`}
              >
                <Trash2 size={16}/>
                {busyId === photo.id ? 'Suppression…' : 'Supprimer'}
              </button>
            )}
          </article>
        ))}
        {!photos.length && !message && <p>Aucune photo associée à ce support.</p>}
      </div>
      {selected && (
        <div className="photo-lightbox" role="dialog" aria-modal="true">
          <button type="button" className="close" onClick={() => setSelected(null)} aria-label="Fermer"><X/></button>
          <img src={selected.photo_url} alt={selected.nom_fichier || 'Photo du support'}/>
          <div>
            <strong>{selected.nom_fichier}</strong>
            <span>{selected.prise_le ? new Date(selected.prise_le).toLocaleString('fr-CA') : 'Date inconnue'}</span>
            <span>{selected.type_photo}</span>
            {canDelete && (
              <button
                className="support-gallery-delete"
                type="button"
                disabled={busyId === selected.id}
                onClick={() => removePhoto(selected)}
              >
                <Trash2 size={16}/> {busyId === selected.id ? 'Suppression…' : 'Supprimer cette photo'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
