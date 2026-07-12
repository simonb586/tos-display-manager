import React, { useEffect, useState } from 'react';
import { Image, X } from 'lucide-react';
import { listSupportPhotos } from '../services/photoLibraryService';

export default function SupportPhotoGallery({ supportId }) {
  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supportId) return;
    listSupportPhotos(supportId)
      .then(setPhotos)
      .catch(error => setMessage(error.message || 'Impossible de charger les photos.'));
  }, [supportId]);

  return (
    <section className="support-gallery">
      <h3><Image size={18}/> Galerie du support</h3>
      {message && <p>{message}</p>}
      <div className="support-gallery-grid">
        {photos.map(photo => (
          <button key={photo.id} type="button" onClick={() => setSelected(photo)}>
            <img src={photo.thumbnail_url || photo.photo_url} alt={photo.nom_fichier}/>
            <span>{photo.prise_le ? new Date(photo.prise_le).toLocaleDateString('fr-CA') : 'Date inconnue'}</span>
          </button>
        ))}
        {!photos.length && !message && <p>Aucune photo associée à ce support.</p>}
      </div>
      {selected && (
        <div className="photo-lightbox">
          <button type="button" className="close" onClick={() => setSelected(null)}><X/></button>
          <img src={selected.photo_url} alt={selected.nom_fichier}/>
          <div>
            <strong>{selected.nom_fichier}</strong>
            <span>{selected.prise_le ? new Date(selected.prise_le).toLocaleString('fr-CA') : 'Date inconnue'}</span>
            <span>{selected.type_photo}</span>
          </div>
        </div>
      )}
    </section>
  );
}
