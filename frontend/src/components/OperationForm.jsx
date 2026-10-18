import {confirmAction} from '../services/user-feedback.js';
import { useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Field from './Field.jsx';
import ItemsEditor from './ItemsEditor.jsx';
import PayrollEditor from './PayrollEditor.jsx';
import { Notice } from './Feedback.jsx';
import { initialValues, formPayload, parseItems, operationKey } from '../utils/forms.js';

export default function OperationForm({ operation, client, references, profile, branch, onClose, onSaved }) {
  const [values, setValues] = useState(() => initialValues(operation.fields, { id_sucursal: profile.id_sucursal || branch || '', id_sucursal_origen: profile.id_sucursal || branch || '', ...operation.initial }));
  const [items, setItems] = useState(operation.initial?.items || [{ id_medicamento: '', cantidad: 1 }]);
  const [adjustments, setAdjustments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previous = useRef(null);
  function change(name, value) {
    setValues(old => ({ ...old, [name]: value }));
    if (name === 'id_sucursal') setAdjustments([]);
  }
  async function submit(event) {
    event.preventDefault(); 
    setError(''); setBusy(true);
    try {
      const body = { ...formPayload(operation.fields, values), ...operation.extra };
      if (operation.items) body.items = parseItems(items);
      if (operation.payroll) {
        const seen = new Set();
        body.ajustes = adjustments.map(row => {
          const id = Number(row.id_empleado);
          if (seen.has(id)) throw new Error('No repitas ajustes de un empleado.');
          seen.add(id);
          return { id_empleado: id, bonificacion: Number(row.bonificacion), deduccion: Number(row.deduccion) };
        });
      }
      if (operation.path === '/traslados' && body.id_sucursal_origen === body.id_sucursal_destino) throw new Error('El origen y el destino deben ser diferentes.');
      if (operation.path.endsWith('/ajustes') && body.diferencia === 0) throw new Error('La diferencia no puede ser cero.');
      if ((/\/(anular|revertir)$/.test(operation.path)||body.diferencia<0)&&!await confirmAction({title:operation.title+' — confirmar',text:operation.description,confirmText:'Sí, aplicar operación',danger:true}))return;
      // Conserva la clave al reintentar el mismo cuerpo en esta ventana.
      previous.current = operationKey(previous.current, operation.path, body);
      const result = await client.write(operation.method || 'POST', operation.path, body, previous.current.key);
      const identifier = result.data.id_venta || result.data.id_pedido || result.data.id_traslado || result.data.id_planilla || result.data.id_movimiento || result.data.id_inventario;
      onSaved(`${operation.title}: operación completada${identifier ? ` · referencia #${identifier}` : ''}.`);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <Modal title={operation.title} description={operation.description} onClose={onClose} busy={busy} wide={operation.items || operation.payroll}>
    <form onSubmit={submit}><Notice>{error}</Notice>
      <div className="form-grid">{operation.fields.map(field => <Field key={field.name} field={field} value={values[field.name]} onChange={change} references={references} profile={profile} disabled={busy} />)}</div>
      {operation.items && <ItemsEditor rows={items} onChange={setItems} medicines={references.medicamentos || []} disabled={busy} />}
      {operation.payroll && <PayrollEditor rows={adjustments} onChange={setAdjustments} employees={references.empleados || []} branch={values.id_sucursal} disabled={busy} />}
      <div className="form-footer"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="button primary" disabled={busy}>{busy ? 'Procesando…' : 'Confirmar operación'}</button></div>
    </form>
  </Modal>;
}
