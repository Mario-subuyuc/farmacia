import { Plus, Trash2 } from 'lucide-react';
import { money } from '../utils/format.js';

export default function ItemsEditor({ rows, onChange, medicines, disabled = false }) {
  // Recibimos las filas por props. Avisamos al padre con una nueva lista,
  // en lugar de modificar directamente la lista que recibimos.
  function change(index, field, value) { onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row)); }
  const total = rows.reduce((sum, row) => sum + Number(row.cantidad || 0) * Number(medicines.find(m => String(m.id_medicamento) === String(row.id_medicamento))?.precio_venta || 0), 0);
  const needsPrescription = rows.some(row => medicines.find(m => String(m.id_medicamento) === String(row.id_medicamento))?.requiere_receta);
  return <section className="items-editor"><div className="section-heading"><h3>Medicamentos</h3><button type="button" className="button subtle small" disabled={disabled || rows.length >= 50}
    onClick={() => onChange([...rows, { id_medicamento: '', cantidad: 1 }])}><Plus size={16} />Agregar línea</button></div>
    {rows.map((row, index) => <div className="item-line" key={index}>
      <label>Medicamento {index + 1}<select aria-label={`Medicamento ${index + 1}`} required value={row.id_medicamento} disabled={disabled} onChange={event => change(index, 'id_medicamento', event.target.value)}>
        <option value="">Seleccionar medicamento…</option>{medicines.filter(m => m.estado === 'ACTIVO').map(m => <option key={m.id_medicamento} value={m.id_medicamento}>{m.nombre} · {money(m.precio_venta)}</option>)}
      </select></label>
      <label>Unidades {index + 1}<input type="number" min="1" max="1000000" step="1" required value={row.cantidad} disabled={disabled} onChange={event => change(index, 'cantidad', event.target.value)} /></label>
      <button type="button" className="icon-button danger-text" aria-label={`Quitar medicamento ${index + 1}`} disabled={disabled || rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 size={18} /></button>
    </div>)}
    {needsPrescription && <p className="prescription-note">La selección incluye medicamentos con receta. Registra la referencia después de verificarla.</p>}
    <div className="estimate"><span>Precio de catálogo estimado <small>El servidor confirma el importe final.</small></span><strong>{money(total)}</strong></div>
  </section>;
}
