# Operación y despliegue

## Funciones implementadas

- Checkout en dos pasos: primero cotiza productos, envío y cupón; después confirma el total aceptado. Un cambio de precio obliga a cotizar otra vez.
- Recetas JPEG/PNG/WebP de hasta 5 MB en bucket privado `recetas`. ADMIN, GERENTE o VENDEDOR de la sucursal puede abrir un enlace de 120 segundos y aprobar o rechazar. No se prepara el pedido sin aprobación.
- Pago al recibir: con el pedido EN_CAMINO, **Cobrar y entregar** registra pago, venta, consumo de inventario y caja en una transacción. Tarjeta o transferencia exige una referencia. Registrar un pago rechazado no genera caja ni entrega.
- Sucursales: costo de envío, radio de entrega, apertura, cierre y días ISO (1=lunes, 7=domingo). Horarios en America/Guatemala; no se permiten horarios que crucen medianoche. El costo aceptado se conserva aunque el personal reasigne la sucursal.
- Cancelación por código privado antes del despacho, con pago pendiente. Libera reservas una vez. Las reservas PENDIENTES vencen a las dos horas, incluyendo pedidos a la espera de receta; al pasar a PREPARANDO quedan bajo gestión del personal.
- El servidor revisa vencimientos al iniciar y cada minuto. Desactivar con EXPIRATION_JOB_ENABLED=false cuando se utilice un programador externo. También puede ejecutarse `npm.cmd run jobs:run`.
- ADMIN administra **Cupones** y **Contenido del sitio** (misión, visión, programas, FAQ). Cupones tienen fechas inclusivas, mínimo y límite global de usos; se aplican al subtotal con promociones y no al envío. Un cupón utilizado conserva su consumo si se cancela el pedido.
- El historial conserva hasta 20 códigos de pedido en ese navegador. No es una cuenta de cliente ni sincroniza entre dispositivos. Los códigos permiten recuperar pedidos individualmente en otro equipo.

## Notificaciones sin proveedor

El correo del checkout es opcional. Se encolan avisos de confirmación, receta, pago y cambios operativos. **Notificaciones** permite al personal consultar pendientes, intentos y errores. Sin proveedor no se envía correo, WhatsApp ni SMS.

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

Instalar `pg_dump` y `pg_restore` compatibles con el servidor PostgreSQL. `node scripts/backup.js --check` verifica que las herramientas estén disponibles. `npm.cmd run db:backup` crea un archivo custom en `backups/` con public y privado y verifica su catálogo con pg_restore --list. No imprime contraseña ni la pasa como argumento de proceso.

Guardar las copias fuera del equipo con acceso restringido y definir la retención. Estas copias **no contienen archivos binarios de Supabase Storage ni usuarios de Auth**; se necesita además una estrategia de copia del proyecto Supabase y de los buckets `catalogo` y `recetas`.

Para probar restauración, usar una base aislada con Auth/roles equivalentes preparados, y `pg_restore --no-owner --no-acl --dbname=BASE_AISLADA copia.dump`. No restaurar sobre producción para probar. La verificación del catálogo no sustituye una restauración completa.

En este entorno no están instalados Docker ni pg_dump/pg_restore: la construcción del contenedor y la copia/restauración real requieren esas herramientas. Los comandos de comprobación informan la limitación sin modificar datos.

## Verificación

- `npm.cmd test`: HTTP, permisos y SQL con PGlite, sin modificar Supabase remoto.
- `npm.cmd run ui:test`: utilidades y cliente HTTP.
- `npm.cmd run ui:build`: compilación.
- `npm.cmd --prefix frontend run test:e2e`: navegador contra API y SQL locales, incluyendo receta, cotización, cupón, cobro, seguimiento, cancelación y contenido editable. En Windows puede usarse PLAYWRIGHT_CHANNEL=msedge si está instalado Edge.
- CI `.github/workflows/validate.yml` ejecuta tests y build sin secretos ni Supabase remoto. La ejecución en GitHub ocurrirá al subir estos archivos a un repositorio con Actions habilitado.

Validación realizada en esta entrega: 69 pruebas de backend, 17 de frontend y 9 E2E aprobadas; compilación y servicio único con `/api` relativo verificados. En Supabase se comprobaron readiness, contenido, cotización y subida/lectura privada de una imagen temporal; el archivo se eliminó. Las compras de prueba se ejecutaron exclusivamente en SQL local. No se efectuaron cobros, envíos de mensajes ni despliegues externos. La migración 013 también registra los cambios de contenido y cupones en auditoría.

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

Estado de la primera prueba con las credenciales proporcionadas: Gmail devolvió EAUTH / 535. No se enviaron los correos de prueba. EMAIL_WORKER_ENABLED permanece false hasta corregir SMTP_PASS. Las alertas y el calendario funcionan independientemente del correo.

Referencias de implementación: [SMTP con Gmail en Nodemailer](https://nodemailer.com/guides/using-gmail), [FullCalendar React v6](https://fullcalendar.io/docs/v6/react).

Actualización SMTP: después de actualizar la contraseña de aplicación, Gmail aceptó los dos mensajes de prueba (alerta y notificación) al destinatario de validación. EMAIL_WORKER_ENABLED quedó activado en el entorno local y se reanudaron las alertas pendientes del intento con autenticación rechazada. La aceptación del servidor SMTP no verifica lectura ni llegada a la bandeja principal.

## Autocompletado y formato de correos

El catálogo y el asistente muestran hasta seis sugerencias después de escribir dos caracteres, con una espera de 300 ms. La consulta utiliza el buscador público existente (normalización de tildes y mayúsculas). Se puede elegir con clic o flechas y Enter; Escape cierra la lista. Las respuestas antiguas se descartan al cambiar la búsqueda. En el catálogo se respetan categoría y sucursal seleccionadas.

Todos los correos enviados por `sendEmail` incluyen HTML con marca NexoFarma, tarjetas y colores de severidad, además de texto alternativo. El contenido dinámico se escapa antes de insertarse en HTML. Se enviaron dos pruebas del nuevo formato al destinatario configurado y Gmail aceptó ambas; la lectura y la bandeja de destino se comprueban por el destinatario.

## Inscripciones y diseño de correos

El administrador configura cupo y horas de anticipación en Eventos y talleres. El visitante solicita su inscripción desde el calendario público; el correo contiene un enlace de confirmación que vence en dos horas. Abrir el enlace no confirma automáticamente: se debe pulsar Confirmar inscripción. Desde ese mismo enlace se puede cancelar. Solo las inscripciones confirmadas reciben recordatorios; se evita duplicar el recordatorio de la misma fecha. Las reservas pendientes vigentes cuentan para el cupo.

En Diseño de correos se personalizan marca, lema, colores, tipografía, introducción y pie para alertas, pedidos y actividades. La vista previa no envía correo. Los siguientes envíos usan la plantilla guardada y conservan alternativa de texto. El servidor debe estar encendido con EMAIL_WORKER_ENABLED=true. PUBLIC_SITE_URL debe ser la dirección accesible por los destinatarios; localhost solo sirve en el equipo local.

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
