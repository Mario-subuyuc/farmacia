import { useState } from 'react';
import Modal from './Modal.jsx';
import { Notice } from './Feedback.jsx';

export default function CatalogImageForm({ record, resource, client, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError('');
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5242880) {
      setError('Selecciona una imagen JPEG, PNG o WebP de hasta 5 MB.'); return;
    }
    setBusy(true);
    try { await (resource==='eventos'?client.uploadEventImage(record.id_evento,file):client.uploadImage(record.id_medicamento, file)); onSaved('Imagen guardada en el catálogo.'); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <Modal title={`Imagen de ${(record.nombre||record.titulo)}`} onClose={onClose} busy={busy}>
    <form onSubmit={submit} className="page-stack">
      {(record.imagen_url||record.foto_url) && <img className="catalog-image-preview" src={(record.imagen_url||record.foto_url)} alt={(record.nombre||record.titulo)} />}
      <p>Sube una fotografía. JPEG, PNG o WebP, hasta 5 MB.</p>
      <label>Imagen<input type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} onChange={event => setFile(event.target.files[0])} /></label>
      <Notice>{error}</Notice>
      <button className="button primary" disabled={busy}>{busy ? 'Subiendo…' : 'Guardar imagen'}</button>
    </form>
  </Modal>;
}
