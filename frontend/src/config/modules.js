// Cada módulo describe sus columnas y formulario. El backend sigue validando todo.
export const allRoles = ['ADMIN', 'GERENTE', 'VENDEDOR', 'BODEGA', 'CAJERO', 'CALL_CENTER', 'AUDITOR'];
const managers = ['ADMIN', 'GERENTE', 'AUDITOR'];
export const paymentOptions = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];
export const branchField = { name: 'id_sucursal', label: 'Sucursal', type: 'select', lookup: 'sucursales', numeric: true, required: true };
export const medicineField = { name: 'id_medicamento', label: 'Medicamento', type: 'select', lookup: 'medicamentos', numeric: true, required: true };
export const reasonField = { name: 'motivo', label: 'Motivo', type: 'textarea', required: true, maxLength: 255 };
export const paymentField = { name: 'metodo_pago', label: 'Forma de pago', type: 'select', options: paymentOptions, required: true, defaultValue: 'EFECTIVO' };
const codeField = { name: 'codigo', label: 'Código', required: true, maxLength: 30 };
const nameField = { name: 'nombre', label: 'Nombre', required: true, maxLength: 100 };
const activeField = { name: 'estado', label: 'Estado', type: 'select', options: ['ACTIVO', 'INACTIVO'], defaultValue: 'ACTIVO' };

export const modules = {
 compras:{title:'Compras a proveedores',singular:'compra',description:'Órdenes, recepción parcial, facturas y saldo de pago.',icon:'Truck',group:'Operación',id:'id_compra',read:['ADMIN','GERENTE','BODEGA','CAJERO','AUDITOR'],columns:['id_compra','id_proveedor','id_sucursal','factura','total','pagado','estado'],filters:['id_sucursal','estado'],details:true},
 'solicitudes-stock':{title:'Conteos y bajas',singular:'solicitud',description:'Solicitudes de conteo, baja y devolución a proveedor con aprobación.',icon:'ListChecks',group:'Control',id:'id_solicitud',read:['ADMIN','GERENTE','BODEGA','AUDITOR'],columns:['id_solicitud','id_sucursal','id_inventario','tipo','cantidad','motivo','estado'],filters:['id_sucursal','estado']},
 'devoluciones-clientes':{title:'Devoluciones de clientes',singular:'devolución',description:'Reembolsos y productos recibidos en cuarentena.',icon:'ArrowLeftRight',group:'Operación',id:'id_devolucion',read:['ADMIN','GERENTE','AUDITOR'],columns:['id_devolucion','id_sucursal','id_detalle','cantidad','reembolso','destino','motivo'],filters:['id_sucursal']},
 'cierres-caja':{title:'Cierres de caja',singular:'cierre',description:'Efectivo esperado, contado y diferencias por turno.',icon:'Wallet',group:'Finanzas',id:'id_cierre',read:['ADMIN','GERENTE','CAJERO','AUDITOR'],columns:['id_cierre','id_sucursal','desde','hasta','esperado','contado','diferencia'],filters:['id_sucursal']},
 'permisos-operativos':{title:'Autorizaciones específicas',singular:'autorización',description:'Controla la aprobación de recetas, cobros, inventario y cambios de precio.',icon:'ShieldCheck',group:'Administración',id:'id_usuario',read:['ADMIN'],write:['ADMIN'],create:false,columns:['id_usuario','aprobar_receta','confirmar_pago','aprobar_stock','modificar_precio'],filters:[],fields:[{name:'aprobar_receta',label:'Aprobar recetas',type:'checkbox'},{name:'confirmar_pago',label:'Confirmar cobros y pagos',type:'checkbox'},{name:'aprobar_stock',label:'Aprobar cambios de inventario',type:'checkbox'},{name:'modificar_precio',label:'Modificar precios mediante operación autorizada',type:'checkbox'}]},
 inscripciones:{title:'Inscripciones',singular:'inscripción',description:'Cupos confirmados y pendientes de verificación por correo.',icon:'UsersRound',group:'Administración',id:'id_inscripcion',read:['ADMIN'],columns:['id_evento','nombre','email','telefono','estado','creado_en'],filters:['id_evento','estado']},
 proveedores:{title:'Proveedores',singular:'proveedor',description:'Contactos para reposición de medicamentos.',icon:'Truck',group:'Administración',id:'id_proveedor',read:['ADMIN','GERENTE','BODEGA','AUDITOR'],write:['ADMIN'],columns:['nombre','contacto','email','telefono','activo'],filters:[],fields:[{name:'nombre',label:'Proveedor',required:true,maxLength:150},{name:'contacto',label:'Persona de contacto',nullable:true,maxLength:150},{name:'email',label:'Correo',type:'email',nullable:true,maxLength:150},{name:'telefono',label:'Teléfono',nullable:true,maxLength:30},{name:'direccion',label:'Dirección',nullable:true,maxLength:255},{name:'activo',label:'Activo',type:'checkbox',defaultValue:true}]},
 eventos:{title:'Eventos y talleres',singular:'evento',description:'Fechas y horas de Guatemala. Crea el evento, sube su foto y publícalo.',icon:'CalendarDays',group:'Administración',id:'id_evento',read:['ADMIN','GERENTE','AUDITOR'],write:['ADMIN'],columns:['titulo','id_sucursal','inicio','fin','publicado'],filters:['id_sucursal'],fields:[branchField,{name:'titulo',label:'Título del evento',required:true,maxLength:150},{name:'descripcion',label:'Descripción',type:'textarea',maxLength:4000,required:true},{name:'inicio',label:'Fecha y hora de inicio (Guatemala)',type:'datetime-local',required:true},{name:'fin',label:'Fecha y hora final (Guatemala)',type:'datetime-local',required:true},{name:'cupo',label:'Cupos disponibles',type:'number',min:1,max:10000,step:1,defaultValue:30},{name:'recordatorio_horas',label:'Enviar recordatorio horas antes',type:'number',min:1,max:168,step:1,defaultValue:24},{name:'publicado',label:'Publicado en el calendario',type:'checkbox',defaultValue:false}]},
 'alertas-inventario':{title:'Alertas de inventario',singular:'alerta',description:'Productos vencidos, por vencer en 30 días y stock inferior al mínimo. Se actualiza cada minuto.',icon:'Bell',group:'Control',id:'id_alerta',fields:[branchField,{name:'tipo',label:'Tipo',type:'select',options:['VENCIDO','POR_VENCER','STOCK_BAJO']},{name:'estado',label:'Estado',type:'select',options:['ACTIVA','RESUELTA']}],read:['ADMIN','GERENTE','BODEGA','AUDITOR'],columns:['tipo','id_sucursal','id_medicamento','mensaje','estado','correo_estado','enviado_en'],filters:['id_sucursal','tipo','estado']},
  contenidos:{title:'Contenido del sitio',singular:'contenido',description:'Edita misión, visión, programas y preguntas frecuentes.',icon:'FileText',group:'Administración',id:'id_contenido',read:['ADMIN'],write:['ADMIN'],columns:['tipo','titulo','orden','activo'],filters:['tipo'],fields:[{name:'tipo',label:'Sección',type:'select',options:['MISION','VISION','PROGRAMA','FAQ'],required:true},{name:'titulo',label:'Título',required:true,maxLength:150},{name:'cuerpo',label:'Contenido',type:'textarea',required:true,maxLength:4000},{name:'orden',label:'Orden',type:'number',min:0,max:9999,step:1,defaultValue:0},{name:'activo',label:'Visible',type:'checkbox',defaultValue:true}]},
  cupones:{title:'Cupones',singular:'cupón',description:'Descuentos adicionales sobre el subtotal de productos.',icon:'Ticket',group:'Administración',id:'id_cupon',read:['ADMIN'],write:['ADMIN'],columns:['codigo','porcentaje','minimo','hasta','usos','max_usos','activo'],filters:['codigo'],fields:[{name:'codigo',label:'Código (MAYÚSCULAS, números y guiones)',required:true,maxLength:30},{name:'porcentaje',label:'Descuento (%)',type:'number',min:0.01,max:90,step:0.01,required:true},{name:'minimo',label:'Subtotal mínimo (Q)',type:'number',min:0,step:0.01,defaultValue:0},{name:'desde',label:'Desde',type:'date',nullable:true},{name:'hasta',label:'Hasta',type:'date',nullable:true},{name:'max_usos',label:'Límite total de usos',type:'number',min:1,step:1,defaultValue:100},{name:'activo',label:'Activo',type:'checkbox',defaultValue:true}]},
  notificaciones:{title:'Notificaciones',singular:'notificación',description:'Cola de avisos y estado de los envíos por correo.',icon:'Bell',group:'Control',id:'id_notificacion',read:['ADMIN','GERENTE','AUDITOR'],columns:['id_pedido','evento','estado','intentos','creado_en'],filters:['id_sucursal','estado']},
  sucursales: {
    title: 'Sucursales', singular: 'sucursal', description: 'Una vista de cada farmacia y stand de tu red.', icon: 'Building2', group: 'Administración', id: 'id_sucursal', read: allRoles, write: ['ADMIN'],
    columns: ['nombre', 'departamento', 'tipo', 'telefono', 'estado'], filters: ['estado', 'departamento', 'tipo'],
    fields: [{name:'costo_envio',label:'Costo de envío (Q)',type:'number',min:0,step:0.01,defaultValue:0},{name:'apertura',label:'Apertura de pedidos',type:'time',step:1,defaultValue:'00:00'},{name:'cierre',label:'Cierre de pedidos',type:'time',step:1,defaultValue:'23:59:59'},{name:'dias_entrega',label:'Días de entrega (1=lunes, 7=domingo)',defaultValue:'1,2,3,4,5,6,7',maxLength:13},codeField, nameField, { name: 'departamento', label: 'Departamento', required: true, maxLength: 100 },
      { name: 'direccion', label: 'Dirección', required: true, maxLength: 255 }, { name: 'telefono', label: 'Teléfono', nullable: true, maxLength: 20 },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['FARMACIA', 'STAND'], required: true, defaultValue: 'FARMACIA' },
      { name: 'estado', label: 'Estado', type: 'select', options: ['ACTIVA', 'INACTIVA'], defaultValue: 'ACTIVA' },
      { name: 'latitud', label: 'Latitud', type: 'number', min: -90, max: 90, step: 'any', required: true },
      { name: 'longitud', label: 'Longitud', type: 'number', min: -180, max: 180, step: 'any', required: true },
      { name: 'radio_entrega_km', label: 'Radio de entrega (km)', type: 'number', min: 0.01, step: 0.01, defaultValue: 10 },
      { name: 'preparacion_minutos', label: 'Preparación (minutos)', type: 'number', min: 0, step: 1, defaultValue: 15 },
      { name: 'velocidad_kmh', label: 'Velocidad estimada (km/h)', type: 'number', min: 0.01, step: 0.01, defaultValue: 20 },
      { name: 'acepta_pedidos', label: 'Aceptar pedidos de entrega', type: 'checkbox', defaultValue: true }],
  },
  medicamentos: {
    title: 'Medicamentos', singular: 'medicamento', description: 'Tu catálogo, precios y requisitos de receta.', icon: 'Pill', group: 'Administración', id: 'id_medicamento', read: allRoles, write: ['ADMIN'],
    columns: ['nombre', 'categoria', 'principio_activo', 'precio_venta', 'descuento_porcentaje', 'requiere_receta', 'estado'], filters: ['estado', 'categoria'],
    fields: [codeField, { ...nameField, maxLength: 150 }, { name: 'descripcion', label: 'Descripción', type: 'textarea', nullable: true },
      { name: 'categoria', label: 'Categoría', required: true, maxLength: 100 }, { name: 'principio_activo', label: 'Principio activo', required: true, maxLength: 150 },
      { name: 'precio_compra', label: 'Precio de compra (Q)', type: 'number', min: 0, step: 0.01, required: true },
      { name: 'precio_venta', label: 'Precio de venta (Q)', type: 'number', min: 0.01, step: 0.01, required: true },
      {name:'id_proveedor',label:'Proveedor principal',type:'select',lookup:'proveedores',numeric:true,nullable:true},
      { name: 'descuento_porcentaje', label: 'Descuento (%)', type: 'number', min: 0, max: 90, step: 0.01, defaultValue: 0, help: 'Usa 0 para desactivar la promoción. El precio de venta es el precio regular.' },
      { name: 'promocion_titulo', label: 'Nombre de la promoción', nullable: true, maxLength: 100 },
      { name: 'promocion_desde', label: 'Vigente desde', type: 'date', nullable: true },
      { name: 'promocion_hasta', label: 'Vigente hasta (inclusive)', type: 'date', nullable: true },
      { name: 'requiere_receta', label: 'Requiere receta médica', type: 'checkbox' }, activeField],
  },
  clientes: {
    title: 'Clientes', singular: 'cliente', description: 'Información de contacto para una atención cercana.', icon: 'ContactRound', group: 'Administración', id: 'id_cliente', read: allRoles, write: ['ADMIN', 'GERENTE', 'VENDEDOR', 'CALL_CENTER'],
    columns: ['nombre', 'apellido', 'telefono', 'email', 'direccion'], filters: ['codigo'],
    fields: [codeField, nameField, { name: 'apellido', label: 'Apellido', required: true, maxLength: 100 },
      { name: 'telefono', label: 'Teléfono', required: true, maxLength: 20 }, { name: 'email', label: 'Correo electrónico', type: 'email', nullable: true, maxLength: 150 },
      { name: 'direccion', label: 'Dirección', required: true, maxLength: 255 }],
  },
  empleados: {
    title: 'Empleados', singular: 'empleado', description: 'El equipo detrás de cada sucursal.', icon: 'UsersRound', group: 'Administración', id: 'id_empleado', read: managers, write: ['ADMIN', 'GERENTE'],
    columns: ['nombre', 'apellido', 'id_sucursal', 'puesto', 'salario', 'estado'], filters: ['id_sucursal', 'estado'],
    fields: [codeField, branchField, nameField, { name: 'apellido', label: 'Apellido', required: true, maxLength: 100 },
      { name: 'puesto', label: 'Puesto', required: true, maxLength: 50 }, { name: 'salario', label: 'Salario mensual (Q)', type: 'number', min: 0, step: 0.01, required: true }, activeField],
  },
  activos: {
    title: 'Activos fijos', singular: 'activo', description: 'Equipo, mobiliario y valor registrado por localidad.', icon: 'Monitor', group: 'Administración', id: 'id_activo', read: managers, write: ['ADMIN', 'GERENTE'],
    columns: ['nombre', 'id_sucursal', 'valor', 'fecha_adquisicion', 'vida_util_meses', 'estado'], filters: ['id_sucursal', 'estado'],
    fields: [codeField, branchField, { ...nameField, maxLength: 150 }, { name: 'descripcion', label: 'Descripción', type: 'textarea', nullable: true },
      { name: 'valor', label: 'Valor de adquisición (Q)', type: 'number', min: 0, step: 0.01, required: true },
      { name: 'valor_residual', label: 'Valor residual (Q)', type: 'number', min: 0, step: 0.01, defaultValue: 0 },
      { name: 'vida_util_meses', label: 'Vida útil (meses)', type: 'number', min: 1, step: 1, required: true },
      { name: 'fecha_adquisicion', label: 'Fecha de adquisición', type: 'date', required: true },
      { name: 'estado', label: 'Estado', type: 'select', options: ['ACTIVO', 'MANTENIMIENTO', 'BAJA'], defaultValue: 'ACTIVO' }],
  },
  'stock-minimos': {
    title: 'Stock mínimo', singular: 'mínimo de stock', description: 'Define cuándo hace falta reponer un medicamento.', icon: 'ListChecks', group: 'Administración', id: 'id_stock', read: managers, write: ['ADMIN', 'GERENTE'],
    columns: ['id_sucursal', 'id_medicamento', 'stock_minimo'], filters: ['id_sucursal', 'id_medicamento'],
    fields: [branchField, medicineField, { name: 'stock_minimo', label: 'Unidades mínimas', type: 'number', min: 0, step: 1, required: true }],
  },
  perfiles: {
    title: 'Accesos y permisos', singular: 'usuario', description: 'Crea cuentas con correo y contraseña; asigna su rol y sucursal.', icon: 'ShieldCheck', group: 'Administración', id: 'id_usuario', read: ['ADMIN'], write: ['ADMIN'],
    columns: ['id_usuario', 'rol', 'id_sucursal', 'activo'], filters: ['rol', 'id_sucursal'],
    fields: [{ name: 'username', label: 'Nombre de usuario', required: true, createOnly: true, maxLength: 50 },
      { name: 'email', label: 'Correo electrónico', type: 'email', required: true, createOnly: true, maxLength: 254 },
      { name: 'password', label: 'Contraseña', type: 'password', required: true, createOnly: true, minLength: 8, maxLength: 128 },
      { name: 'rol', label: 'Rol', type: 'select', options: allRoles, required: true }, { ...branchField, required: false, nullable: true },
      { name: 'activo', label: 'Permitir acceso', type: 'checkbox', defaultValue: true }],
  },
  inventario: { title: 'Inventario', singular: 'lote', description: 'Existencias y reservas, lote por lote.', icon: 'Package', group: 'Operación', id: 'id_inventario', read: allRoles,
    columns: ['id_medicamento', 'id_sucursal', 'lote', 'cantidad', 'reservado', 'disponible', 'fecha_vencimiento'], filters: ['id_sucursal', 'id_medicamento', 'lote'] },
  ventas: { title: 'Ventas', singular: 'venta', description: 'Cada venta conectada con inventario y caja.', icon: 'ReceiptText', group: 'Operación', id: 'id_venta', read: ['ADMIN', 'GERENTE', 'VENDEDOR', 'CAJERO', 'AUDITOR'],
    columns: ['id_venta', 'fecha', 'id_sucursal', 'id_cliente', 'metodo_pago', 'total', 'estado'], filters: ['id_sucursal', 'id_cliente', 'estado'], details: true },
  pedidos: { title: 'Pedidos y entregas', singular: 'pedido', description: 'Desde la reserva hasta la puerta del cliente.', icon: 'ShoppingBag', group: 'Operación', id: 'id_pedido', read: ['ADMIN', 'GERENTE', 'VENDEDOR', 'BODEGA', 'CALL_CENTER', 'AUDITOR'],
    columns: ['id_pedido', 'id_cliente', 'id_sucursal', 'entrega_estimada', 'total', 'receta_estado', 'estado_pago', 'estado'], filters: ['id_sucursal', 'id_cliente', 'estado'], details: true },
  traslados: { title: 'Traslados', singular: 'traslado', description: 'Medicamentos en movimiento entre sucursales.', icon: 'Truck', group: 'Operación', id: 'id_traslado', read: ['ADMIN', 'GERENTE', 'BODEGA', 'AUDITOR'],
    columns: ['id_traslado', 'id_sucursal_origen', 'id_sucursal_destino', 'fecha', 'motivo', 'estado'], filters: ['id_sucursal_origen', 'id_sucursal_destino', 'estado'], details: true },
  'movimientos-caja': { title: 'Caja y movimientos', singular: 'movimiento', description: 'Ingresos y egresos con un historial que se conserva.', icon: 'Wallet', group: 'Finanzas', id: 'id_movimiento', read: ['ADMIN', 'GERENTE', 'CAJERO', 'AUDITOR'],
    columns: ['fecha', 'id_sucursal', 'concepto', 'tipo', 'metodo_pago', 'monto'], filters: ['id_sucursal', 'tipo', 'metodo_pago'] },
  planillas: { title: 'Planilla', singular: 'planilla', description: 'Pagos mensuales y ajustes de tu equipo.', icon: 'Banknote', group: 'Finanzas', id: 'id_planilla', read: managers,
    columns: ['id_planilla', 'id_sucursal', 'periodo', 'fecha', 'total'], filters: ['id_sucursal', 'periodo'], details: true },
  'movimientos-medicamentos': { title: 'Movimientos de stock', singular: 'movimiento', description: 'La trazabilidad de cada entrada y salida.', icon: 'ArrowLeftRight', group: 'Control', id: 'id_movimiento', read: ['ADMIN', 'GERENTE', 'BODEGA', 'AUDITOR'],
    columns: ['fecha', 'id_sucursal', 'id_inventario', 'tipo', 'cantidad', 'motivo'], filters: ['id_sucursal', 'id_inventario', 'tipo'] },
  auditoria: { title: 'Auditoría', singular: 'registro', description: 'Qué cambió, cuándo y quién realizó la operación.', icon: 'ClipboardCheck', group: 'Control', id: 'id_auditoria', read: managers,
    columns: ['fecha', 'tabla', 'registro', 'accion', 'id_sucursal', 'actor'], filters: ['id_sucursal', 'tabla', 'actor', 'accion'] },
};

export const labels = {
  id_sucursal: 'Sucursal', id_sucursal_origen: 'Origen', id_sucursal_destino: 'Destino', id_medicamento: 'Medicamento',
  id_cliente: 'Cliente', id_empleado: 'Empleado', id_usuario: 'Cuenta', id_inventario: 'Lote de inventario',
  id_venta: 'Venta', id_pedido: 'Pedido', id_traslado: 'Traslado', id_planilla: 'Planilla', id_detalle: 'Detalle',
  precio_venta: 'Precio de venta', precio_compra: 'Precio de compra', principio_activo: 'Principio activo', requiere_receta: 'Receta',
  fecha_vencimiento: 'Vencimiento', fecha_adquisicion: 'Adquisición', entrega_estimada: 'Entrega estimada', vida_util_meses: 'Vida útil (meses)',
  metodo_pago: 'Forma de pago', stock_minimo: 'Stock mínimo', costo_unitario: 'Costo unitario', precio_unitario: 'Precio unitario',
  cantidad_registrada: 'Unidades registradas', valor_compra: 'Valor del stock', bajo_minimo: 'Necesita reposición',
  tiempo_estimado_minutos: 'Tiempo estimado (min)', direccion_entrega: 'Dirección de entrega', receta_referencia: 'Referencia de receta',
  creado_por: 'Registrado por', recibido_por: 'Recibido por', recibido_en: 'Fecha de recepción', entregado_en: 'Fecha de entrega',
  salario_base: 'Salario base', bonificacion: 'Bonificación', deduccion: 'Deducción', nota_estado: 'Observación', valor_residual: 'Valor residual',
};
export function label(field) { return labels[field] || field.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()); }
export function can(profile, roles) { return Boolean(profile && roles.includes(profile.rol)); }
export function inBranch(profile, id) { return profile.rol === 'ADMIN' || Number(profile.id_sucursal) === Number(id); }
