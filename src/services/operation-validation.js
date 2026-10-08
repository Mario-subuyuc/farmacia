import { idField, moneyField, paymentField } from '../config/resources.js';
import { validateFields } from '../utils/validation.js';
import { httpError } from '../utils/http-error.js';

const reason = { type: 'text', max: 255 };
const items = { type: 'array', max: 50 };
const coordinates = { latitud: { type: 'number', min: -90, max: 90 }, longitud: { type: 'number', min: -180, max: 180 } };
const optionalPerson = { ...idField, nullable: true };
const saleFields = { id_sucursal: idField, id_cliente: optionalPerson, id_empleado: optionalPerson,
  items, metodo_pago: paymentField, receta_referencia: { ...reason, nullable: true } };

const operations = {
  entrada: { required: ['id_sucursal', 'id_medicamento', 'lote', 'fecha_vencimiento', 'cantidad', 'motivo'],
    fields: { id_sucursal: idField, id_medicamento: idField, lote: { type: 'text', max: 80 }, fecha_vencimiento: { type: 'date' },
      cantidad: { type: 'number', min: 1, max: 1000000, integer: true }, costo_unitario: moneyField, motivo: reason } },
  ajuste: { required: ['id_inventario', 'diferencia', 'motivo'], fields: { id_inventario: idField,
    diferencia: { type: 'number', min: -1000000, max: 1000000, integer: true }, motivo: reason } },
  venta: { required: ['id_sucursal', 'items', 'metodo_pago'], fields: saleFields },
  anular_venta: { required: ['id_venta', 'motivo'], fields: { id_venta: idField, motivo: reason } },
  traslado: { required: ['id_sucursal_origen', 'id_sucursal_destino', 'items', 'motivo'],
    fields: { id_sucursal_origen: idField, id_sucursal_destino: idField, items, motivo: reason } },
  recibir_traslado: { required: ['id_traslado'], fields: { id_traslado: idField } },
  pedido: { required: ['id_sucursal', 'id_cliente', 'items', 'metodo_pago', 'canal', 'direccion_entrega', 'latitud', 'longitud'],
    fields: { ...saleFields, id_cliente: idField, id_empleado: undefined, ...coordinates, direccion_entrega: reason,
      canal: { type: 'enum', values: ['TELEFONO', 'PORTAL', 'SUCURSAL'] } } },
  estado_pedido: { required: ['id_pedido', 'estado'], fields: { id_pedido: idField,
    estado: { type: 'enum', values: ['PREPARANDO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO', 'DEVUELTO'] }, repartidor: { type: 'text', max: 150 }, motivo: reason } },
  reasignar_pedido: { required: ['id_pedido', 'id_sucursal', 'motivo'], fields: { id_pedido: idField, id_sucursal: idField, motivo: reason } },
  caja: { required: ['id_sucursal', 'tipo', 'concepto', 'monto', 'metodo_pago'], fields: { id_sucursal: idField,
    id_empleado: optionalPerson, tipo: { type: 'enum', values: ['INGRESO', 'EGRESO'] }, concepto: reason,
    monto: { ...moneyField, min: 0.01 }, metodo_pago: paymentField } },
  revertir_caja: { required: ['id_movimiento', 'motivo'], fields: { id_movimiento: idField, motivo: reason } },
  planilla: { required: ['id_sucursal', 'periodo'], fields: { id_sucursal: idField, periodo: { type: 'date' }, ajustes: { type: 'array', max: 500 } } },
  disponibilidad: { required: ['latitud', 'longitud', 'items'], fields: { ...coordinates, items } },
};

export function validateOperation(action, body) {
  const rules = operations[action];
  if (!rules) throw httpError(400, 'Operación desconocida.');
  const clean = validateFields(body, rules.fields, rules.required);
  if (clean.items) {
    if (!clean.items.length) throw httpError(400, 'Agrega al menos un medicamento.');
    const seen = new Set();
    clean.items = clean.items.map(function (item) {
      const line = validateFields(item, { id_medicamento: idField, cantidad: { type: 'number', min: 1, max: 1000000, integer: true } }, ['id_medicamento', 'cantidad']);
      if (seen.has(line.id_medicamento)) throw httpError(400, 'No repitas medicamentos.');
      seen.add(line.id_medicamento);
      return line;
    });
  }
  if (clean.ajustes) {
    const seen = new Set();
    clean.ajustes = clean.ajustes.map(function (item) {
      const line = validateFields(item, { id_empleado: idField, bonificacion: moneyField, deduccion: moneyField }, ['id_empleado']);
      if (seen.has(line.id_empleado)) throw httpError(400, 'No repitas ajustes de un empleado.');
      seen.add(line.id_empleado);
      return line;
    });
  }
  if (action === 'ajuste' && clean.diferencia === 0) throw httpError(400, 'diferencia no puede ser cero.');
  if (action === 'traslado' && clean.id_sucursal_origen === clean.id_sucursal_destino) throw httpError(400, 'Las sucursales deben ser distintas.');
  if (action === 'planilla' && !clean.periodo.endsWith('-01')) throw httpError(400, 'periodo debe ser el primer día del mes.');
  if (action === 'estado_pedido' && clean.estado === 'EN_CAMINO' && !clean.repartidor) throw httpError(400, 'repartidor es obligatorio.');
  if (action === 'estado_pedido' && clean.estado === 'DEVUELTO' && !clean.motivo) throw httpError(400, 'motivo es obligatorio.');
  return clean;
}
