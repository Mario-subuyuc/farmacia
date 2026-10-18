import { branchField, medicineField, paymentField, reasonField, can, inBranch } from './modules.js';
import { today } from '../utils/format.js';

const clientField = { name: 'id_cliente', label: 'Cliente', type: 'select', lookup: 'clientes', numeric: true };
const prescription = { name: 'receta_referencia', label: 'Referencia de receta verificada', maxLength: 255 };

export function newOperation(module, profile) {
  if (module === 'inventario' && can(profile, ['ADMIN', 'GERENTE', 'BODEGA'])) return {
    title: 'Registrar entrada', description: 'Recibe medicamentos indicando lote, vencimiento y motivo.', path: '/inventario/entradas',
    fields: [branchField, medicineField, { name: 'lote', label: 'Código del lote', required: true, maxLength: 80 },
      { name: 'fecha_vencimiento', label: 'Fecha de vencimiento', type: 'date', required: true },
      { name: 'cantidad', label: 'Unidades recibidas', type: 'number', min: 1, step: 1, required: true },
      { name: 'costo_unitario', label: 'Costo unitario (Q), opcional', type: 'number', min: 0, step: 0.01 }, reasonField],
  };
  if (module === 'ventas' && can(profile, ['ADMIN', 'GERENTE', 'VENDEDOR', 'CAJERO'])) return {
    title: 'Registrar venta', description: 'El servidor confirma el stock, calcula el total y registra el ingreso.', path: '/ventas', items: true,
    fields: [branchField, clientField, paymentField, prescription],
  };
  if (module === 'pedidos' && can(profile, ['ADMIN', 'GERENTE', 'VENDEDOR', 'CALL_CENTER'])) return {
    title: 'Crear pedido', description: 'Reserva existencias en la sucursal que atenderá al cliente.', path: '/pedidos', items: true,
    fields: [branchField, { ...clientField, required: true }, paymentField,
      { name: 'canal', label: 'Canal de atención', type: 'select', options: ['TELEFONO', 'PORTAL', 'SUCURSAL'], defaultValue: 'TELEFONO', required: true },
      { name: 'direccion_entrega', label: 'Dirección de entrega', required: true, maxLength: 255 },
      { name: 'latitud', label: 'Latitud de entrega', type: 'number', min: -90, max: 90, step: 'any', required: true },
      { name: 'longitud', label: 'Longitud de entrega', type: 'number', min: -180, max: 180, step: 'any', required: true }, prescription],
  };
  if (module === 'traslados' && can(profile, ['ADMIN', 'GERENTE', 'BODEGA'])) return {
    title: 'Crear traslado', description: 'Se descuenta el origen; el destino suma stock al confirmar la recepción.', path: '/traslados', items: true,
    fields: [{ ...branchField, name: 'id_sucursal_origen', label: 'Sucursal origen' },
      { ...branchField, name: 'id_sucursal_destino', label: 'Sucursal destino', anyBranch: true }, reasonField],
  };
  if (module === 'movimientos-caja' && can(profile, ['ADMIN', 'GERENTE', 'CAJERO'])) return {
    title: 'Registrar movimiento', description: 'Registra un ingreso o egreso manual. Las ventas generan su ingreso automáticamente.', path: '/movimientos-caja',
    fields: [branchField, { name: 'tipo', label: 'Tipo de movimiento', type: 'select', options: ['INGRESO', 'EGRESO'], required: true, defaultValue: 'EGRESO' },
      { name: 'concepto', label: 'Concepto', required: true, maxLength: 255 }, { name: 'monto', label: 'Monto (Q)', type: 'number', min: 0.01, step: 0.01, required: true }, paymentField],
  };
  if (module === 'planillas' && can(profile, ['ADMIN', 'GERENTE'])) return {
    title: 'Pagar planilla', description: 'Incluye empleados activos y genera el egreso por transferencia. No permite pagar el mismo mes dos veces.', path: '/planillas', payroll: true,
    fields: [branchField, { name: 'periodo', label: 'Mes de pago', type: 'month', required: true, defaultValue: today().slice(0, 7) }],
  };
  return null;
}

export function recordActions(module, row, profile) {
  const actions = [];
  const local = inBranch(profile, row.id_sucursal);
  if (module === 'inventario' && local && can(profile, ['ADMIN', 'GERENTE'])) actions.push({
    title: 'Ajustar stock', description: 'Positivo agrega unidades; negativo resta. No puede afectar reservas.', path: `/inventario/${row.id_inventario}/ajustes`,
    fields: [{ name: 'diferencia', label: 'Diferencia de unidades', type: 'number', step: 1, required: true }, reasonField],
  });
  if (module === 'ventas' && local && can(profile, ['ADMIN', 'GERENTE']) && row.estado === 'PAGADA' && !row.id_pedido) actions.push({
    title: 'Anular venta', description: 'Devuelve las unidades al inventario y genera un egreso compensatorio por el total de la venta.', path: `/ventas/${row.id_venta}/anular`, fields: [reasonField],
  });
  if (module === 'traslados' && inBranch(profile, row.id_sucursal_destino) && can(profile, ['ADMIN', 'GERENTE', 'BODEGA']) && row.estado === 'EN_TRANSITO') actions.push({
    title: 'Confirmar recepción', description: 'Confirma que recibiste los medicamentos en la sucursal destino. Esta acción suma el stock recibido.', path: `/traslados/${row.id_traslado}/recibir`, fields: [],
  });
  if (module === 'movimientos-caja' && local && can(profile, ['ADMIN', 'GERENTE']) && !row.id_venta && !row.id_planilla && !row.id_reversion) actions.push({
    title: 'Revertir movimiento', description: 'Crea una contrapartida del mismo monto y conserva el movimiento original.', path: `/movimientos-caja/${row.id_movimiento}/revertir`, fields: [reasonField],
  });
  if (module === 'pedidos') {
    if(local && can(profile,['ADMIN','GERENTE','VENDEDOR'])){
      if(row.receta_estado==='PENDIENTE'||row.receta_estado==='RECHAZADA') for(const estado of ['APROBADA','RECHAZADA'])actions.push({title:estado==='APROBADA'?'Aprobar receta':'Rechazar receta',path:'/pedidos/'+row.id_pedido+'/gestion',fields:[],extra:{accion:'receta',estado},description:'Revisa el documento privado antes de decidir.'});
      if(row.estado==='EN_CAMINO' && row.expira_en && row.estado_pago!=='PAGADO') for(const estado of ['PAGADO','RECHAZADO'])actions.push({title:estado==='PAGADO'?'Cobrar y entregar':'Registrar pago rechazado',path:'/pedidos/'+row.id_pedido+'/gestion',fields:[{name:'referencia',label:'Referencia del cobro (obligatoria salvo efectivo)',maxLength:150}],extra:{accion:'pago',estado},description:'PAGADO confirma en una sola transacción el cobro recibido, la entrega y el ingreso de caja. No realiza un cargo bancario.'});
    }
    function statusAction(title, status, fields, description) {
      return { title, path: `/pedidos/${row.id_pedido}/estado`, method: 'PATCH', fields, extra: { estado: status }, description };
    }
    if (local && can(profile, ['ADMIN', 'GERENTE', 'VENDEDOR', 'BODEGA'])) {
      if (row.estado === 'PENDIENTE' && !['PENDIENTE','RECHAZADA'].includes(row.receta_estado)) actions.push(statusAction('Preparar pedido', 'PREPARANDO', [], 'Confirma que la sucursal comenzó a preparar los medicamentos.'));
      if (row.estado === 'PREPARANDO') actions.push(statusAction('Despachar pedido', 'EN_CAMINO', [{ name: 'repartidor', label: 'Nombre del repartidor', required: true, maxLength: 150 }], 'Asigna quién llevará el pedido al cliente.'));
      if (row.estado === 'EN_CAMINO') {
        if(!row.expira_en) actions.push(statusAction('Confirmar entrega', 'ENTREGADO', [], 'Confirma la entrega y el pago recibido. Se registra la venta y el ingreso.'));
        actions.push(statusAction('Registrar retorno', 'DEVUELTO', [reasonField], 'Usa esta opción cuando una entrega fallida ya regresó físicamente a la sucursal. No se registra cobro.'));
      }
    }
    if (['PENDIENTE', 'PREPARANDO'].includes(row.estado)) {
      if (profile.rol === 'CALL_CENTER' || (local && can(profile, ['ADMIN', 'GERENTE', 'VENDEDOR']))) actions.push(statusAction('Cancelar pedido', 'CANCELADO', [reasonField], 'Libera las reservas antes del despacho.'));
      if (can(profile, ['ADMIN', 'CALL_CENTER'])) actions.push({ title: 'Reasignar sucursal', path: `/pedidos/${row.id_pedido}/reasignar`,
        description: 'Mueve las reservas y actualiza el tiempo estimado. Si falta stock en destino, se conserva la asignación original.',
        fields: [{ ...branchField, anyBranch: true }, reasonField] });
    }
  }
  return actions;
}
