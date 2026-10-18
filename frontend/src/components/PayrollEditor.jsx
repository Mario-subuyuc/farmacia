import { Plus, Trash2 } from 'lucide-react';
import { money } from '../utils/format.js';

export default function PayrollEditor({ rows, onChange, employees, branch, disabled }) {
  const active = employees.filter(e => Number(e.id_sucursal) === Number(branch) && e.estado === 'ACTIVO');
  function change(index, field, value) { onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row)); }
  const total = active.reduce((sum, e) => sum + Number(e.salario), 0) + rows.reduce((sum, r) => sum + Number(r.bonificacion || 0) - Number(r.deduccion || 0), 0);
  return <section className="items-editor"><div className="section-heading"><h3>Ajustes opcionales</h3><button type="button" className="button subtle small" disabled={disabled || !active.length || rows.length >= active.length}
    onClick={() => onChange([...rows, { id_empleado: '', bonificacion: 0, deduccion: 0 }])}><Plus size={16} />Agregar ajuste</button></div>
    <p className="muted">Se incluye a los {active.length} empleados activos de esta sucursal. Agrega solo los ajustes necesarios.</p>
    {rows.map((row, index) => <div className="payroll-line" key={index}>
      <label>Empleado {index + 1}<select required disabled={disabled} value={row.id_empleado} onChange={e => change(index, 'id_empleado', e.target.value)}><option value="">Seleccionar…</option>
        {active.map(employee => <option key={employee.id_empleado} value={employee.id_empleado}>{employee.nombre} {employee.apellido}</option>)}</select></label>
      <label>Bonificación {index + 1}<input type="number" min="0" step="0.01" required disabled={disabled} value={row.bonificacion} onChange={e => change(index, 'bonificacion', e.target.value)} /></label>
      <label>Deducción {index + 1}<input type="number" min="0" step="0.01" required disabled={disabled} value={row.deduccion} onChange={e => change(index, 'deduccion', e.target.value)} /></label>
      <button type="button" className="icon-button" aria-label={`Quitar ajuste ${index + 1}`} disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 size={18} /></button>
    </div>)}
    <div className="estimate"><span>Neto estimado <small>El servidor valida los salarios y deducciones.</small></span><strong>{money(total)}</strong></div>
  </section>;
}
