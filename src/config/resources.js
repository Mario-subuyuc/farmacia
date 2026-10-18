// Configuración de los CRUD sencillos. Las operaciones de negocio van aparte.
// required se usa al crear. En PATCH solo validamos los campos recibidos.
export const idField = { type: 'number', min: 1, max: Number.MAX_SAFE_INTEGER, integer: true };
export const moneyField = { type: 'number', min: 0, max: 999999999, money: true };
export const paymentField = { type: 'enum', values: ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] };
const branchReaders = ['ADMIN', 'GERENTE', 'AUDITOR'];
const everyone = ['ADMIN', 'GERENTE', 'VENDEDOR', 'BODEGA', 'CAJERO', 'CALL_CENTER', 'AUDITOR'];

export const resources = {
 compras:{table:'compras',id:'id_compra',read:['ADMIN','GERENTE','BODEGA','CAJERO','AUDITOR'],filters:['id_sucursal','estado']},
 'solicitudes-stock':{table:'solicitudes_stock',id:'id_solicitud',read:['ADMIN','GERENTE','BODEGA','AUDITOR'],filters:['id_sucursal','estado','tipo']},
 'devoluciones-clientes':{table:'devoluciones_clientes',id:'id_devolucion',read:['ADMIN','GERENTE','AUDITOR'],filters:['id_sucursal']},
 'cierres-caja':{table:'cierres_caja',id:'id_cierre',read:['ADMIN','GERENTE','CAJERO','AUDITOR'],filters:['id_sucursal']},
 'permisos-operativos':{table:'permisos_operativos',id:'id_usuario',uuid:true,create:false,read:['ADMIN'],write:['ADMIN'],filters:[],required:[],fields:{aprobar_receta:{type:'boolean'},confirmar_pago:{type:'boolean'},aprobar_stock:{type:'boolean'},modificar_precio:{type:'boolean'}}},
 'plantillas-correo':{create:false,table:'plantillas_correo',id:'id_plantilla',read:['ADMIN'],write:['ADMIN'],required:['tipo'],filters:['tipo'],fields:{marca:{type:'text',max:80},lema:{type:'text',max:150},color_principal:{type:'color'},color_fondo:{type:'color'},color_alerta:{type:'color'},introduccion:{type:'text',max:500,nullable:true},pie:{type:'text',max:500},fuente:{type:'enum',values:['Arial','Georgia']}}},
 inscripciones:{table:'inscripciones',id:'id_inscripcion',read:['ADMIN'],filters:['id_evento','estado']},
 proveedores:{table:'proveedores',id:'id_proveedor',read:['ADMIN','GERENTE','BODEGA','AUDITOR'],write:['ADMIN'],required:['nombre'],filters:['activo'],fields:{nombre:{type:'text',max:150},contacto:{type:'text',max:150,nullable:true},email:{type:'text',max:150,nullable:true},telefono:{type:'text',max:30,nullable:true},direccion:{type:'text',max:255,nullable:true},activo:{type:'boolean'}}},
 eventos:{table:'eventos',id:'id_evento',read:['ADMIN','GERENTE','AUDITOR'],write:['ADMIN'],required:['id_sucursal','titulo','descripcion','inicio','fin'],filters:['id_sucursal','publicado'],fields:{id_sucursal:idField,titulo:{type:'text',max:150},descripcion:{type:'text',max:4000},inicio:{type:'datetime'},fin:{type:'datetime'},publicado:{type:'boolean'},cupo:{type:'number',min:1,max:10000,integer:true},recordatorio_horas:{type:'number',min:1,max:168,integer:true}}},
 'alertas-inventario':{table:'alertas_inventario',id:'id_alerta',read:['ADMIN','GERENTE','BODEGA','AUDITOR'],filters:['id_sucursal','tipo','estado']},
  contenidos: {table:'contenidos',id:'id_contenido',read:['ADMIN'],write:['ADMIN'],required:['tipo','titulo','cuerpo'],filters:['tipo','activo'],fields:{tipo:{type:'enum',values:['MISION','VISION','PROGRAMA','FAQ']},titulo:{type:'text',max:150},cuerpo:{type:'text',max:4000},orden:{type:'number',min:0,max:9999,integer:true},activo:{type:'boolean'}}},
  cupones: {table:'cupones',id:'id_cupon',read:['ADMIN'],write:['ADMIN'],required:['codigo','porcentaje'],filters:['activo','codigo'],fields:{codigo:{type:'text',max:30},porcentaje:{type:'number',min:0.01,max:90,money:true},minimo:moneyField,desde:{type:'date',nullable:true},hasta:{type:'date',nullable:true},max_usos:{type:'number',min:1,max:1000000,integer:true},activo:{type:'boolean'}}},
  notificaciones: {table:'notificaciones',id:'id_notificacion',read:['ADMIN','GERENTE','AUDITOR'],filters:['estado','id_sucursal','id_pedido']},
  sucursales: {
    table: 'sucursales', id: 'id_sucursal', read: everyone, write: ['ADMIN'],
    required: ['codigo', 'nombre', 'departamento', 'direccion', 'tipo', 'latitud', 'longitud'],
    fields: {
      costo_envio: moneyField, apertura:{type:'text',max:8},cierre:{type:'text',max:8},dias_entrega:{type:'text',max:13},
      codigo: { type: 'text', max: 30 }, nombre: { type: 'text', max: 100 },
      departamento: { type: 'text', max: 100 }, direccion: { type: 'text', max: 255 },
      telefono: { type: 'text', max: 20, nullable: true },
      tipo: { type: 'enum', values: ['FARMACIA', 'STAND'] }, estado: { type: 'enum', values: ['ACTIVA', 'INACTIVA'] },
      latitud: { type: 'number', min: -90, max: 90 }, longitud: { type: 'number', min: -180, max: 180 },
      radio_entrega_km: { type: 'number', min: 0.01, max: 10000 },
      preparacion_minutos: { type: 'number', min: 0, max: 1440, integer: true },
      velocidad_kmh: { type: 'number', min: 0.01, max: 200 }, acepta_pedidos: { type: 'boolean' },
    }, filters: ['estado', 'departamento', 'tipo'],
  },
  empleados: {
    table: 'empleados', id: 'id_empleado', read: branchReaders, write: ['ADMIN', 'GERENTE'],
    required: ['codigo', 'id_sucursal', 'nombre', 'apellido', 'puesto', 'salario'],
    fields: { codigo: { type: 'text', max: 30 }, id_sucursal: idField, nombre: { type: 'text', max: 100 },
      apellido: { type: 'text', max: 100 }, puesto: { type: 'text', max: 50 }, salario: moneyField,
      estado: { type: 'enum', values: ['ACTIVO', 'INACTIVO'] } }, filters: ['id_sucursal', 'estado'],
  },
  medicamentos: {
    table: 'medicamentos', id: 'id_medicamento', read: everyone, write: ['ADMIN'],
    required: ['codigo', 'nombre', 'categoria', 'principio_activo', 'precio_compra', 'precio_venta'],
    fields: { codigo: { type: 'text', max: 30 }, nombre: { type: 'text', max: 150 },
      descripcion: { type: 'text', max: 2000, nullable: true }, categoria: { type: 'text', max: 100 },
      id_proveedor:{...idField,nullable:true},
      descuento_porcentaje: { type: 'number', min: 0, max: 90, money: true },
      promocion_titulo: { type: 'text', max: 100, nullable: true },
      promocion_desde: { type: 'date', nullable: true }, promocion_hasta: { type: 'date', nullable: true },
      principio_activo: { type: 'text', max: 150 }, precio_compra: moneyField,
      precio_venta: { ...moneyField, min: 0.01 }, requiere_receta: { type: 'boolean' },
      estado: { type: 'enum', values: ['ACTIVO', 'INACTIVO'] } }, filters: ['estado', 'categoria'],
  },
  clientes: {
    table: 'clientes', id: 'id_cliente', read: everyone, write: ['ADMIN', 'GERENTE', 'VENDEDOR', 'CALL_CENTER'],
    required: ['codigo', 'nombre', 'apellido', 'telefono', 'direccion'],
    fields: { codigo: { type: 'text', max: 30 }, nombre: { type: 'text', max: 100 }, apellido: { type: 'text', max: 100 },
      telefono: { type: 'text', max: 20 }, email: { type: 'text', max: 150, nullable: true },
      direccion: { type: 'text', max: 255 } }, filters: ['codigo'],
  },
  activos: {
    table: 'activos', id: 'id_activo', read: branchReaders, write: ['ADMIN', 'GERENTE'],
    required: ['codigo', 'id_sucursal', 'nombre', 'valor', 'vida_util_meses', 'fecha_adquisicion'],
    fields: { codigo: { type: 'text', max: 30 }, id_sucursal: idField, nombre: { type: 'text', max: 150 },
      descripcion: { type: 'text', max: 2000, nullable: true }, valor: moneyField, valor_residual: moneyField,
      vida_util_meses: { type: 'number', min: 1, max: 1200, integer: true }, fecha_adquisicion: { type: 'date' },
      estado: { type: 'enum', values: ['ACTIVO', 'MANTENIMIENTO', 'BAJA'] } }, filters: ['id_sucursal', 'estado'],
  },
  'stock-minimos': {
    table: 'stock_minimos', id: 'id_stock', read: branchReaders, write: ['ADMIN', 'GERENTE'],
    required: ['id_sucursal', 'id_medicamento', 'stock_minimo'],
    fields: { id_sucursal: idField, id_medicamento: idField, stock_minimo: { type: 'number', min: 0, max: 1000000, integer: true } },
    filters: ['id_sucursal', 'id_medicamento'],
  },
  perfiles: {
    table: 'perfiles', id: 'id_usuario', uuid: true, read: ['ADMIN'], write: ['ADMIN'],
    required: ['id_usuario', 'rol'],
    fields: { id_usuario: { type: 'uuid' }, rol: { type: 'enum', values: everyone },
      id_sucursal: { ...idField, nullable: true }, activo: { type: 'boolean' } }, filters: ['rol', 'id_sucursal'],
  },
  inventario: { table: 'inventario', id: 'id_inventario', read: everyone, filters: ['id_sucursal', 'id_medicamento', 'lote'] },
  ventas: { table: 'ventas', id: 'id_venta', read: ['ADMIN', 'GERENTE', 'VENDEDOR', 'CAJERO', 'AUDITOR'], filters: ['id_sucursal', 'id_cliente', 'estado'] },
  pedidos: { table: 'pedidos', id: 'id_pedido', read: ['ADMIN', 'GERENTE', 'VENDEDOR', 'BODEGA', 'CALL_CENTER', 'AUDITOR'], filters: ['id_sucursal', 'id_cliente', 'estado'] },
  traslados: { table: 'traslados', id: 'id_traslado', read: ['ADMIN', 'GERENTE', 'BODEGA', 'AUDITOR'], filters: ['id_sucursal_origen', 'id_sucursal_destino', 'estado'] },
  'movimientos-medicamentos': { table: 'movimientos_medicamentos', id: 'id_movimiento', read: ['ADMIN', 'GERENTE', 'BODEGA', 'AUDITOR'], filters: ['id_sucursal', 'id_inventario', 'tipo'] },
  'movimientos-caja': { table: 'movimientos_caja', id: 'id_movimiento', read: ['ADMIN', 'GERENTE', 'CAJERO', 'AUDITOR'], filters: ['id_sucursal', 'tipo', 'metodo_pago'] },
  planillas: { table: 'planillas', id: 'id_planilla', read: branchReaders, filters: ['id_sucursal', 'periodo'] },
  auditoria: { table: 'auditoria', id: 'id_auditoria', read: branchReaders, filters: ['id_sucursal', 'tabla', 'actor', 'accion'] },
};
