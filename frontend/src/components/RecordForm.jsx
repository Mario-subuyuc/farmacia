import {confirmAction} from '../services/user-feedback.js';
import { useState } from 'react';
import Modal from './Modal.jsx';
import Field from './Field.jsx';
import { Notice } from './Feedback.jsx';
import { initialValues, formPayload } from '../utils/forms.js';

export default function RecordForm({ module, record, client, references, profile, branch, onClose, onSaved }) {
  const fields = module.fields.filter(field => !record || !field.createOnly);
  const [values, setValues] = useState(() => initialValues(fields, record || { id_sucursal: profile.id_sucursal || branch || '' }));
  const [dirty,setDirty]=useState(false);
  async function requestClose(){if(!dirty||await confirmAction({title:'¿Descartar los cambios?',text:'Los cambios que escribiste en este formulario todavía no se han guardado.',confirmText:'Sí, descartar cambios',danger:true}))onClose();}
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function change(name, value) { setDirty(true);setValues(old => ({ ...old, [name]: value })); }
  async function submit(event) {
    event.preventDefault();
    
    setError(''); setBusy(true);
    try {
      const body = formPayload(fields, values, Boolean(record));
      if (module.id === 'id_usuario' && !['ADMIN', 'AUDITOR', 'CALL_CENTER'].includes(body.rol) && !body.id_sucursal) throw new Error('Este rol necesita una sucursal.');
      const path = module.path === 'perfiles' && !record ? '/usuarios' : `/${module.path}${record ? `/${record[module.id]}` : ''}`;
      await client.write(record ? 'PATCH' : 'POST', path, body);
      onSaved(`${record ? 'Cambios guardados' : 'Registro creado'} correctamente.`);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <Modal title={`${record ? 'Editar' : 'Crear'} ${module.singular}`} description="Completa los campos marcados con asterisco." onClose={requestClose} busy={busy}>
    <form onSubmit={submit}><Notice>{error}</Notice>
      <div className="form-grid">{fields.map(field => <Field key={field.name} field={field} value={values[field.name]} onChange={change} references={references} profile={profile} disabled={busy} />)}</div>
      <div className="form-footer"><button type="button" className="button secondary" onClick={requestClose} disabled={busy}>Cancelar</button>
        <button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar cambios'}</button></div>
    </form>
  </Modal>;
}
