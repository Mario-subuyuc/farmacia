import { ChevronLeft, ChevronRight } from 'lucide-react';
import { label } from '../config/modules.js';
import { dateOnly, dateTime, money, words, today } from '../utils/format.js';
import { Empty } from './Feedback.jsx';

const moneyFields = ['costo','pagado','reembolso','esperado','contado','diferencia','total', 'monto', 'salario', 'valor', 'valor_residual', 'precio_compra', 'precio_venta', 'costo_unitario', 'precio_unitario', 'subtotal', 'neto', 'salario_base', 'bonificacion', 'deduccion', 'valor_compra', 'saldo_inicial', 'ingresos', 'egresos', 'saldo_periodo', 'saldo_final', 'valor_adquisicion', 'valor_contable_estimado'];
const referenceFields = { id_proveedor:['proveedores','id_proveedor'], id_sucursal: ['sucursales', 'id_sucursal'], id_sucursal_origen: ['sucursales', 'id_sucursal'],
  id_sucursal_destino: ['sucursales', 'id_sucursal'], id_medicamento: ['medicamentos', 'id_medicamento'],
  id_cliente: ['clientes', 'id_cliente'], id_empleado: ['empleados', 'id_empleado'] };

export function Status({ value }) {
  const positive = ['ACTIVO', 'ACTIVA', 'PAGADA', 'ENTREGADO', 'RECIBIDO', 'INGRESO', 'CONFIRMADA', 'APROBADA', 'RECIBIDA', 'PAGADO', 'ENVIADO'];
  const warning = ['PENDIENTE', 'PREPARANDO', 'EN_TRANSITO', 'MANTENIMIENTO'];
  const negative=['CANCELADO','CANCELADA','RECHAZADO','RECHAZADA','ERROR','VENCIDO','VENCIDA','INACTIVO','INACTIVA','DEVUELTO','EGRESO'];
  const style = negative.includes(value)?'red':positive.includes(value) ? 'green' : warning.includes(value) ? 'amber' : value === 'EN_CAMINO' ? 'blue' : 'neutral';
  return <span className={`badge ${style}`}><span className="badge-dot" />{words(value)}</span>;
}

export function displayValue(field, value, references = {}, row = {}) {
  if (field === 'disponible' && row.cantidad !== undefined) {
    const medicine = references.medicamentos?.find(m => Number(m.id_medicamento) === Number(row.id_medicamento));
    return row.fecha_vencimiento > today() && medicine?.estado !== 'INACTIVO' ? Math.max(0, Number(row.cantidad) - Number(row.reservado)) : 0;
  }
  if (value === null || value === undefined || value === '') return '—';
  if (referenceFields[field]) {
    const [table, id] = referenceFields[field];
    const record = references[table]?.find(r => String(r[id]) === String(value));
    return record ? `${record.nombre}${record.apellido ? ` ${record.apellido}` : ''}` : `#${value}`;
  }
  if (moneyFields.includes(field)) return money(value);
  if (['fecha_vencimiento', 'fecha_adquisicion', 'periodo'].includes(field)) return dateOnly(value);
  if (['desde','hasta','inicio','fin','enviado_en','creado_en','fecha', 'entrega_estimada', 'entregado_en', 'recibido_en'].includes(field)) return dateTime(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export default function DataTable({ rows, columns, rowKey = 'id', references, renderActions, emptyText, sort, onSort }) {
  if (!rows.length) return <Empty description={emptyText} />;
  return <div className="table-scroll"><table><thead><tr>{columns.map(field => <th key={field} aria-sort={sort?.key===field?(sort.direction==='asc'?'ascending':'descending'):undefined}>{onSort?<button className="table-sort" onClick={()=>onSort(field)}>{label(field)} {sort?.key===field?(sort.direction==='asc'?'↑':'↓'):'↕'}</button>:label(field)}</th>)}{renderActions && <th className="actions-cell">Acciones</th>}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row[rowKey] ?? index}>{columns.map(field => <td key={field}>
      {['estado', 'tipo'].includes(field) ? <Status value={row[field]} />
        : field === 'fecha_vencimiento' && row[field] <= today() ? <span className="expired">{dateOnly(row[field])} · Vencido</span>
          : <span className={moneyFields.includes(field) ? 'amount' : ''}>{displayValue(field, row[field], references, row)}</span>}
    </td>)}{renderActions && <td className="actions-cell">{renderActions(row)}</td>}</tr>)}</tbody></table></div>;
}

export function Pagination({ page, total, limit = 25, onChange, loading }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return <div className="pagination"><span>{total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} de ${total} registros` : '0 registros'}</span>
    <div><button className="icon-button" disabled={page <= 1 || loading} onClick={() => onChange(page - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button>
      <span>Página {page} de {pages}</span><button className="icon-button" disabled={page >= pages || loading} onClick={() => onChange(page + 1)} aria-label="Página siguiente"><ChevronRight size={18} /></button></div></div>;
}
