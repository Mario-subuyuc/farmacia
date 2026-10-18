import { useId } from 'react';
import { words } from '../utils/format.js';

export function referenceOptions(field, references, profile) {
  let rows = references[field.lookup] || [];
  if (field.lookup === 'sucursales' && profile?.id_sucursal && !field.anyBranch && profile.rol !== 'AUDITOR') {
    rows = rows.filter(row => Number(row.id_sucursal) === Number(profile.id_sucursal));
  }
  const id = { compras:'id_compra',inventario:'id_inventario',solicitudes:'id_solicitud',ventas:'id_venta',detalle_venta:'id_detalle',proveedores:'id_proveedor',sucursales: 'id_sucursal', medicamentos: 'id_medicamento', clientes: 'id_cliente', empleados: 'id_empleado' }[field.lookup];
  return rows.map(row => ({ value: row[id], label: `${row.nombre}${row.apellido ? ` ${row.apellido}` : ''}${row.codigo ? ` · ${row.codigo}` : ''}` }));
}

export default function Field({ field, value, onChange, references = {}, profile, disabled = false }) {
  const id = useId();
  const type = field.type || 'text';
  const common = { id, name: field.name, required: field.required, disabled, 'aria-describedby':field.help?id+'-help':undefined,
    onChange: event => onChange(field.name, type === 'checkbox' ? event.target.checked : event.target.value) };
  if (type === 'checkbox') return <label className="checkbox-field" htmlFor={id}>
    <input {...common} type="checkbox" checked={Boolean(value)} /><span>{field.label}</span></label>;
  let options = field.lookup ? referenceOptions(field, references, profile) : (field.options || []).map(option => ({ value: option, label: words(option) }));
  // Para editar registros históricos, conservamos valores que ya no están en la lista.
  if (type === 'select' && value !== '' && value !== null && value !== undefined && !options.some(option => String(option.value) === String(value))) {
    options = [...options, { value, label: `Registro #${value}` }];
  }
  return <div className={`field ${type === 'textarea' ? 'full' : ''}`}>
    <label htmlFor={id}>{field.label}{field.required && <span className="required"> *</span>}</label>
    {type === 'select' ? <select {...common} value={value ?? ''}>
      <option value="">{field.required ? 'Seleccionar…' : 'Sin asignar'}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : type === 'textarea' ? <textarea {...common} value={value ?? ''} rows={3} maxLength={field.maxLength || 2000} />
      : <input {...common} type={type} value={value ?? ''} min={field.min} max={field.max} step={field.step} minLength={field.minLength} maxLength={field.maxLength || 255} autoComplete={type === 'password' ? 'new-password' : undefined} placeholder={field.placeholder} />}
    {field.help && <small id={id+'-help'}>{field.help}</small>}
  </div>;
}
