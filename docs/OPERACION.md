# Operación y despliegue

Actualizado el **13 de noviembre de 2026**. Referencia de datos y permisos: [Estado actual del portal](ESTADO-ACTUAL.md). Las migraciones registradas llegan hasta la 026. Las cargas `database/data/` son manuales; no ejecutar el seeder DEMO para continuar trabajando con la base configurada.

## Configuración actual del personal y catálogo

Hay cinco sucursales y treinta cuentas de personal, además del administrador. Auditor y call center mantienen su alcance especial entre sucursales; asignar una sucursal no sustituye las políticas RLS. Accesos y permisos y Autorizaciones específicas muestran usuario y correo; Auditoría muestra el usuario que realizó la acción.

Los empleados pueden vincularse a una cuenta mediante `id_usuario`, opcional y único. La ficha, salario y estado laboral se registran manualmente. Crear usuarios no genera empleados ni planillas; desactivar el acceso no excluye automáticamente del pago. La planilla toma el salario base de empleados laboralmente activos; bonificación y deducciones se ingresan al generar el período. La planilla 1 de prueba se eliminó con su detalle y egreso; quedó constancia en auditoría.

Los medicamentos comunes se unificaron: diez productos compartidos, treinta lotes y 750 unidades en la instantánea documentada. Los códigos de producto ya no tienen sucursal; los lotes conservan su prefijo local. Los clientes y proveedores también son compartidos; su nomenclatura indica referencia, no restricción de acceso comercial.

Call center consulta disponibilidad por departamento sin pedir coordenadas del cliente. El checkout conserva su cotización y validación de ubicación. Los pedidos PENDIENTES producen avisos en el panel cada treinta segundos y al recuperar foco, con sonido opcional; no son notificaciones push ni correos.

## Funciones implementadas

- Checkout en dos pasos: primero cotiza productos, envío y cupón; después confirma el total aceptado. Un cambio de precio obliga a cotizar otra vez.
- Recetas JPEG/PNG/WebP de hasta 5 MB en bucket privado `recetas`. ADMIN, GERENTE o VENDEDOR de la sucursal puede abrir un enlace de 120 segundos y aprobar o rechazar. No se prepara el pedido sin aprobación.
- Pago al recibir: con el pedido EN_CAMINO, **Cobrar y entregar** registra pago, venta, consumo de inventario y caja en una transacción. Tarjeta o transferencia exige una referencia. Registrar un pago rechazado no genera caja ni entrega.
- Sucursales: costo de envío, radio de entrega, apertura, cierre y días ISO (1=lunes, 7=domingo). Horarios en America/Guatemala; no se permiten horarios que crucen medianoche. El costo aceptado se conserva aunque el personal reasigne la sucursal.
- Cancelación por código privado antes del despacho, con pago pendiente. Libera reservas una vez. Las reservas PENDIENTES vencen a las dos horas, incluyendo pedidos a la espera de receta; al pasar a PREPARANDO quedan bajo gestión del personal.
- El servidor revisa vencimientos al iniciar y cada minuto. Desactivar con EXPIRATION_JOB_ENABLED=false cuando se utilice un programador externo. También puede ejecutarse `npm.cmd run jobs:run`.
- ADMIN administra **Cupones** y **Contenido del sitio** (misión, visión, programas, FAQ). Cupones tienen fechas inclusivas, mínimo y límite global de usos; se aplican al subtotal con promociones y no al envío. Un cupón utilizado conserva su consumo si se cancela el pedido.
- El historial conserva hasta 20 códigos de pedido en ese navegador. No es una cuenta de cliente ni sincroniza entre dispositivos. Los códigos permiten recuperar pedidos individualmente en otro equipo.

## Canales de notificación

El correo del checkout es opcional. Se encolan avisos de confirmación, receta, pago y cambios operativos. **Notificaciones** permite consultar pendientes, intentos y errores. El canal de correo implementado es SMTP; el adaptador HTTPS siguiente es una alternativa. Sin un canal configurado no se entregan mensajes externos. No hay un envío directo integrado de WhatsApp o SMS.

`npm.cmd run jobs:check` consulta pendientes sin cambiar datos. Para liberar reservas: `npm.cmd run jobs:run`.

Una vez conectado un proveedor mediante un adaptador HTTPS, configurar en el servidor:

```dotenv
NOTIFICATION_WEBHOOK_URL=https://TU-ADAPTADOR/avisos
NOTIFICATION_WEBHOOK_SECRET=SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
```

Activar envío con `node scripts/maintenance.js --run --send-notifications`, mediante un programador cada minuto. El adaptador recibe JSON con id, pedido, destino y evento; convierte el evento en un correo o mensaje según el proveedor contratado. Verificar la firma hexadecimal HMAC-SHA256 de `X-Nexo-Timestamp + '.' + cuerpo_original`, con el secreto compartido. Validar que la marca temporal sea reciente. Deduplicar `Idempotency-Key`: la entrega es al menos una vez. Se reintenta con espera creciente hasta cinco intentos; revisar ERROR en el panel. Nunca se incluyen receta, dirección o código privado en los avisos.

El proyecto **no tiene cobro bancario en línea**. No se deben pedir números de tarjeta en los formularios ni interpretar una referencia escrita como una validación bancaria automática. Al elegir un proveedor se necesitará su integración específica de checkout y webhooks; los pedidos siguen siendo pagaderos al recibir.

## Ejecutar como un solo servicio

Requisitos: Node 24, Supabase con migraciones aplicadas, clave pública y clave privada del backend. Completar CORS_ORIGINS con el origen público exacto.

En PowerShell:

```powershell
npm.cmd ci
npm.cmd --prefix frontend ci
npm.cmd run db:migrate
$env:VITE_API_URL='/api'
npm.cmd run ui:build
$env:SERVE_FRONTEND='true'
npm.cmd start
```

La raíz sirve la landing y `/api` sirve Express. `/api/health` comprueba el proceso; `/api/ready` comprueba también el catálogo en Supabase. Configurar un monitor externo sobre `/api/ready`. Los errores HTTP no devuelven detalles internos y el servidor termina conexiones al recibir SIGTERM.

## Contenedor

```powershell
docker build -t nexofarma .
docker run --env-file .env -e SERVE_FRONTEND=true -p 3000:3000 nexofarma
```

Usar el proveedor de alojamiento elegido para configurar HTTPS, variables, reinicio automático y dominio. No se ha publicado ningún servicio ni configurado DNS. No se necesita desplegar Supabase dentro del contenedor.

El Dockerfile excluye `.env`, copias, archivos de desarrollo y dependencias locales. La imagen ejecuta Node como usuario sin privilegios. Las migraciones son una tarea explícita, no se ejecutan al iniciar cada réplica. El límite de solicitudes sigue siendo por proceso; para varias réplicas se necesita un límite compartido o en el proxy.

## Copias y restauración

Instalar `pg_dump` y `pg_restore` compatibles con PostgreSQL del servidor. `node scripts/backup.js --check` verifica su disponibilidad. `npm.cmd run db:backup` crea un archivo custom en `backups/` con los esquemas `public`, `privado`, `auth` y `storage` y verifica su catálogo con `pg_restore --list`. No imprime la contraseña ni la pasa como argumento de proceso.

En este equipo están instaladas las herramientas PostgreSQL en `C:/Program Files/PostgreSQL/18/bin`. Si no están en PATH, ejecutar `$env:PG_BIN='C:/Program Files/PostgreSQL/18/bin'` antes del comando. El dump incluye usuarios e identidades de Auth y metadatos de Storage; **no incluye los archivos binarios de los buckets**. Conservar una copia separada de estos archivos y su manifiesto. Los esquemas administrados requieren compatibilidad con el proyecto Supabase destino al restaurar.

`backups/`, los archivos `.dump` y `.backup` están excluidos de Git; existe además un `.gitignore` dentro de la carpeta. Los CSV de credenciales y copias parciales se guardan allí. Un respaldo parcial antes de una operación no sustituye una copia completa. Guardar también una copia externa con acceso restringido y retención definida.

Para probar restauración, usar una base aislada con Auth/roles equivalentes preparados, y `pg_restore --no-owner --no-acl --dbname=BASE_AISLADA copia.dump`. No restaurar sobre producción para probar. La verificación del catálogo no sustituye una restauración completa.

Se han creado dumps reales y comprobado sus catálogos. No se ha realizado una restauración completa en una base aislada ni se ha vuelto a verificar Docker en esta revisión. Para la fecha del último respaldo y sus límites, consultar [Estado actual](ESTADO-ACTUAL.md).

## Verificación

- `npm.cmd test`: HTTP, permisos y SQL con PGlite, sin modificar Supabase remoto.
- `npm.cmd run ui:test`: utilidades y cliente HTTP.
- `npm.cmd run ui:build`: compilación.
- `npm.cmd --prefix frontend run test:e2e`: navegador contra API y SQL locales, incluyendo receta, cotización, cupón, cobro, seguimiento, cancelación y contenido editable. En Windows puede usarse PLAYWRIGHT_CHANNEL=msedge si está instalado Edge.
- CI `.github/workflows/validate.yml` ejecuta tests y build sin secretos ni Supabase remoto. La ejecución en GitHub ocurrirá al subir estos archivos a un repositorio con Actions habilitado.

Los conteos de pruebas de entregas anteriores no describen la suite actual. Las comprobaciones recientes abarcan identidad de auditoría, vínculo empleado/cuenta, unificación de medicamentos sin perder inventario, formulario de empleado, categorías de correos, menú por clic y avisos de inventario/pedidos. La compilación se comprobó tras los cambios visuales. Esta revisión documental no afirma haber ejecutado nuevamente toda la suite ni verificado el despliegue remoto. Las cargas ficticias sí se aplicaron a la base conectada; se distinguen de las pruebas locales aisladas.

Después de solucionar un proveedor, los avisos en ERROR pueden reencolarse explícitamente con `node scripts/maintenance.js --run --retry-errors`. El envío sigue requiriendo `--send-notifications` y configuración HTTPS; conserva los identificadores para evitar duplicados en el proveedor.

## Alertas de inventario, proveedores, Gmail y eventos

Las migraciones 014 y 015 incorporan:

- **Proveedores**: ADMIN administra contactos, correo, teléfono y dirección. En Medicamentos se elige el proveedor principal. No se envían pedidos de compra automáticos a proveedores.
- **Alertas de inventario**: VENCIDO (fecha menor o igual a hoy), POR_VENCER (próximos 30 días) y STOCK_BAJO (disponible vendible menos reservas, comparado con Stock mínimo). Incluye productos sin lotes. Se genera al iniciar Express y cada minuto, con fecha de Guatemala. Se conserva una alerta por lote o mínimo por día; las que dejan de aplicar pasan a RESUELTA. El dashboard muestra un aviso y el listado incluye el estado de correo. La reposición usa las entradas de inventario existentes.
- **Eventos y talleres**: ADMIN crea título, descripción, sucursal, inicio, fin y publicación. Después de guardar, el botón Imagen sube una foto JPEG/PNG/WebP de hasta 5 MB a Supabase Storage. Solo los eventos publicados de sucursales activas aparecen en el calendario público. FullCalendar incluye mes, semana y lista, filtro por sucursal y detalle con foto. Fechas y horas en America/Guatemala, tanto al editar como al consultar.

Gmail SMTP usa Nodemailer con puerto 587, secure=false y STARTTLS obligatorio. Configurar SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS y SMTP_FROM únicamente en `.env` del backend. SMTP_PASS debe ser una contraseña de aplicación válida de Gmail. ALERT_EMAIL_TO recibe las alertas internas; las notificaciones de pedidos van al correo que el cliente indicó al comprar.

Prueba SMTP: `node scripts/test-smtp.js`. Primero verifica autenticación; después envía dos correos identificados como PRUEBA (alerta y notificación) a SMTP_TEST_TO. No crea compras o vencimientos ficticios. La aceptación SMTP no confirma lectura ni ubicación en bandeja principal; revisar también spam.

Después de verificar credenciales y destinatarios, activar EMAIL_WORKER_ENABLED=true y reiniciar el backend. El trabajador toma hasta diez avisos y diez alertas por ciclo, con arrendamiento de cinco minutos, reintentos a los quince minutos y un máximo de cinco intentos. Un correo confirmado no se vuelve a tomar al recalcular las alertas del mismo día. SMTP no ofrece deduplicación transaccional: un corte después de aceptar el mensaje podría causar un reintento con el mismo Message-ID.

`node scripts/inventory-alerts.js` actualiza alertas sin enviar correo; `node scripts/inventory-alerts.js --send` procesa también el correo configurado. La integración anterior de webhook es opcional: no ejecutar dos canales para el mismo propósito sin definir la operación deseada.

Histórico SMTP: un primer intento devolvió EAUTH / 535 y posteriormente Gmail aceptó las pruebas tras corregir las credenciales. Ese antecedente no confirma la configuración actual del alojamiento ni su entrega efectiva; las alertas y el calendario funcionan independientemente del correo.

Referencias de implementación: [SMTP con Gmail en Nodemailer](https://nodemailer.com/guides/using-gmail), [FullCalendar React v6](https://fullcalendar.io/docs/v6/react).

En servidores persistentes, el trabajador depende de `EMAIL_WORKER_ENABLED` y las variables SMTP. En Vercel no se utiliza el timer de correo del proceso: la entrega inmediata de inscripciones se espera por HTTP y los trabajos generales necesitan un programador externo. Véase [Despliegue de correos en Vercel](despliegue-correos-vercel.md).

## Autocompletado y formato de correos

El catálogo y el asistente muestran hasta seis sugerencias después de escribir dos caracteres, con una espera de 300 ms. La consulta utiliza el buscador público existente (normalización de tildes y mayúsculas). Se puede elegir con clic o flechas y Enter; Escape cierra la lista. Las respuestas antiguas se descartan al cambiar la búsqueda. En el catálogo se respetan categoría y sucursal seleccionadas.

Todos los correos enviados por `sendEmail` incluyen HTML con marca NexoFarma, tarjetas y colores de severidad, además de texto alternativo. El contenido dinámico se escapa antes de insertarse en HTML. Se enviaron dos pruebas del nuevo formato al destinatario configurado y Gmail aceptó ambas; la lectura y la bandeja de destino se comprueban por el destinatario.

## Inscripciones y diseño de correos

El administrador configura cupo y horas de anticipación en Eventos y talleres. El visitante solicita su inscripción desde el calendario público; el correo contiene un enlace de confirmación que vence en dos horas. Abrir el enlace no confirma automáticamente: se debe pulsar Confirmar inscripción. Desde ese mismo enlace se puede cancelar. Solo las inscripciones confirmadas reciben recordatorios; se evita duplicar el recordatorio de la misma fecha. Las reservas pendientes vigentes cuentan para el cupo.

El servidor rechaza tanto la solicitud como la confirmación si `inicio <= now()`, y rechaza actividades no publicadas o sin cupo. El calendario aún puede mostrar el formulario en eventos pasados. La carga ficticia actual tiene once eventos y 140 inscripciones confirmadas; insertarla no envió ni encoló correos. Los recordatorios automáticos normales pueden alcanzar las direcciones de prueba al acercarse una actividad futura.

En Diseño de correos se personalizan marca, lema, colores, tipografía, introducción y pie por categoría GENERAL, ALERTA, PEDIDO y EVENTO. Cada categoría tiene un ejemplo diferente, el fondo configurable se aplica a todo el correo y se conservan colores personalizados. La vista previa no envía correo. Los siguientes envíos usan la plantilla guardada y conservan texto alternativo. `PUBLIC_SITE_URL` debe ser accesible por los destinatarios; localhost solo sirve en el equipo local. La modalidad de procesamiento depende del alojamiento, según el apartado anterior.

## Compras, inventario y caja

Operaciones de farmacia permite crear compras a proveedores, recibir parcialmente por lote y vencimiento y registrar pagos de lo recibido. Las solicitudes de conteo, baja y devolución a proveedor requieren aprobación; un conteo que perdió vigencia por movimientos posteriores se rechaza. Las devoluciones de clientes generan reembolso limitado a lo vendido y registran cuarentena sin aumentar stock vendible. La devolución a proveedor no tramita automáticamente notas de crédito.

El arqueo compara efectivo contado con el saldo registrado hasta la hora de cierre, incluyendo el saldo anterior; registra diferencias sin modificar movimientos. No admite períodos superpuestos. Permisos operativos permite al administrador habilitar o revocar aprobación de recetas, confirmación de pagos, aprobación de stock y modificación de precios por usuario. Las comprobaciones se hacen en PostgreSQL. Las ventas ofrecen un comprobante interno descargable; no sustituye factura fiscal FEL. Registrar un pago no ejecuta cobros ni transferencias bancarias.

Migraciones de esta ampliación: 016 y 017. Las pruebas de inscripción y operaciones usan una base local aislada y no envían correos reales.

## Páginas públicas

La portada `/#home` muestra la presentación y una selección de productos. El menú abre páginas independientes: `/#farmacia/nosotros`, `/#farmacia/promociones`, `/#farmacia/servicios`, `/#farmacia/programas`, `/#farmacia/actividades`, `/#farmacia/sucursales` y `/#farmacia/ayuda`. El catálogo conserva `/#catalogo`. Se pueden compartir estas direcciones y recargarlas; cada página muestra únicamente su contenido y mantiene acceso al carrito y al seguimiento. El calendario y las inscripciones se encuentran en Actividades.

## Tablas, Excel e impresión

Los reportes y listados administrativos incluyen búsqueda global sin distinción de tildes o mayúsculas, filtros de texto por columna, orden ascendente/descendente desde el encabezado y paginación de 10, 25, 50 o 100 filas. Los filtros por columna se combinan con la búsqueda general y con los filtros del servidor; los permisos y el alcance por sucursal siguen aplicándose.

Exportar Excel (.xlsx) genera un archivo real con encabezados, contexto, filtros de Excel y panel inmovilizado. Conserva importes y cantidades como números, identificadores relacionados como nombres y campos de texto como texto. Solo exporta columnas visibles de datos; no incluye botones de acciones. Imprimir / PDF abre una vista limpia con todos los resultados filtrados y ordenados; elegir Guardar como PDF en el diálogo del navegador. Permitir ventanas emergentes si el navegador lo solicita.

La tabla y las exportaciones usan todos los registros recuperados bajo los filtros aplicados, no solamente la página visible. Los listados cargan secuencialmente las páginas de la API. Esta estrategia facilita el prototipo; para volúmenes nacionales se debe trasladar la búsqueda, orden y generación de archivos a consultas y trabajos de servidor. No representa una instantánea transaccional si otras personas modifican datos durante la carga. Los indicadores del reporte conservan su alcance original del período y sucursal; la búsqueda local solo afecta la tabla y su exportación.

Implementación XLSX: [ExcelJS](https://github.com/exceljs/exceljs). Se carga bajo demanda al exportar.
