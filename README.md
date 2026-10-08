# Backend de una cadena de farmacias

API en **Node 22 o superior, Express, MVC y Supabase (PostgreSQL + Auth)**. Solo backend, lista para consumir desde una aplicación interna de React. El código usa funciones, objetos y comentarios en español; no usa clases ni un ORM.

## 1. Qué puedes hacer

- Administrar farmacias y stands, empleados, clientes y medicamentos.
- Registrar activos por sucursal, valor de adquisición y depreciación lineal estimada.
- Controlar inventario por **sucursal + medicamento + lote**, con vencimiento, costo y reservas.
- Registrar entradas, ajustes con motivo y stock mínimo.
- Vender usando primero los lotes próximos a vencer: **FEFO**. Excluir lotes vencidos y stock reservado.
- Anular ventas de mostrador conservando el historial y generando contrapartidas.
- Despachar traslados y confirmar su recepción desde la sucursal destino.
- Registrar ingresos/egresos por efectivo, tarjeta o transferencia y revertir movimientos manuales.
- Pagar una planilla mensual por sucursal con bonificaciones y deducciones explícitas.
- Consultar sucursales que pueden entregar todos los medicamentos solicitados, con precio, disponibilidad, forma de pago y tiempo estimado.
- Crear pedidos telefónicos o provenientes de una futura integración, reservar stock, reasignarlos, preparar y entregar.
- Consultar pedidos atrasados, movimientos, planillas, activos y auditoría.
- Controlar acceso por rol y sucursal tanto en Express como en PostgreSQL.

## 2. Cómo funciona MVC

```text
React / Postman
       |
       v
Ruta → Middleware de autenticación → Controlador → Modelo → Supabase
                                       |                       |
                                       | <──── resultado ──────┘
                                       v
                                     Vista → JSON al cliente
```

**Ruta:** conecta una URL con una función. **Middleware:** verifica la sesión y los permisos. **Controlador:** valida los datos y decide la respuesta. **Modelo:** consulta Supabase. **Vista:** prepara JSON; aquí no genera HTML.

Un ejemplo: `POST /api/ventas` llega a `business.routes.js`, pasa por autenticación, ejecuta `operation.controller.js`, valida el cuerpo en `operation-validation.js` y llama a `operation.model.js`. El modelo ejecuta `ejecutar_operacion` en PostgreSQL. Al terminar, `api.view.js` envuelve el resultado como `{ "data": ... }`.

¿Por qué hay SQL además de Node? Una venta modifica inventario, detalles, caja y auditoría. Varias llamadas separadas desde Node podrían dejar información incompleta. Una función SQL llamada mediante **RPC** hace todo dentro de una transacción: o termina toda la operación, o no guarda nada. Node sigue siendo la API que recibe las peticiones y organiza MVC.

### Estructura

```text
src/
  index.js                       Abre el puerto del servidor
  app.js                         Configura Express y conecta rutas
  config/
    config.js                    Lee .env
    database.js                  Crea el cliente Supabase de cada usuario
    resources.js                 Campos, filtros y roles de CRUD sencillos
  routes/                        URLs de autenticación y negocio
  middlewares/                   Token, CORS, límite de intentos y errores
  controllers/                   Validaciones y respuestas HTTP
  models/                        Consultas y llamadas RPC a Supabase
  services/operation-validation.js  Reglas de los cuerpos de operaciones
  views/                         Formato JSON de respuestas
  utils/                         Validaciones pequeñas y errores

database/
  001_schema.sql                 Tablas, índices, roles RLS y auditoría
  002_operations.sql             Ventas, reservas, traslados, caja y reportes
  seed.sql                       Datos ficticios repetibles
scripts/
  migrate.js                     Aplica migraciones pendientes
  seed.js                        Ejecuta el seeder
tests/                           Tests HTTP y PostgreSQL local
```

Los CRUD comparten controlador porque siguen los mismos pasos: leer, validar, consultar y responder. `resources.js` indica qué tabla, campos y permisos usa cada ruta. Las operaciones de negocio están separadas de esos CRUD.

## 3. Cambios respecto a la propuesta de base de datos

| Cambio | Motivo |
| --- | --- |
| Inventario único por sucursal, medicamento y **lote** | Un medicamento puede tener varios vencimientos y costos. |
| `reservado` y `reservas_pedido` | Evitar ofrecer o vender unidades ya prometidas a otro cliente. |
| `costo_unitario` por lote | Cambiar el precio de compra del catálogo no cambia el costo del stock existente. |
| Cabecera y detalle de traslados | Distinguir mercancía despachada de mercancía recibida. |
| Cabecera y detalle de planilla | Conservar el salario realmente pagado aunque después cambie. |
| Coordenadas, cobertura y tiempos por sucursal | Ayudar al call center a seleccionar la farmacia. |
| Precio y total guardados en pedidos/ventas | Conservar el precio pactado y calcular importes en el servidor. |
| `perfiles` separados de empleados | Un auditor o un operador no necesariamente es empleado de una sucursal. |
| Auditoría automática e historial de movimientos | Saber quién cambió qué y cuándo. |
| Claves de idempotencia | Evitar ventas, pagos o reservas duplicados por reintentos. |

Las relaciones tienen claves foráneas. Los importes usan `numeric`, las cantidades son enteros y hay restricciones que impiden inventario negativo o reservar más de lo existente. Las fechas de operaciones usan `timestamptz`; la API devuelve fechas con zona horaria.

## 4. Instalar y conectar Supabase

### Paso A: dependencias y .env

```bash
npm install
```

En PowerShell, si `npm.ps1` está bloqueado, usa `npm.cmd` en lugar de `npm`.

Copia `.env.example` a `.env` **solo si todavía no tienes uno**. Completa:

```dotenv
PORT=3000
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU-CLAVE-PUBLICABLE
CORS_ORIGINS=http://localhost:5173,http://localhost:3001
DATABASE_URL=TU-CONEXION-POSTGRESQL
```

- URL y clave publicable: datos de API de tu proyecto Supabase. La API usa esa clave junto con el token del usuario; no usa una clave `service_role` para saltarse permisos.
- `DATABASE_URL`: copia la cadena PostgreSQL de **Connect** de Supabase, sustituye la contraseña y utiliza una conexión directa o el pooler en modo sesión accesible desde tu red. Codifica caracteres especiales de la contraseña en la URL. Usa la configuración TLS/certificado indicada por Supabase para tu conexión.
- La conexión PostgreSQL se usa únicamente en migraciones y seeders. No se envía a React, no se imprime y no se guarda en Git.
- `CORS_ORIGINS`: orígenes exactos del futuro frontend, separados por comas y sin `/` final. Postman no necesita CORS.

### Paso B: crear la base de datos

Si las tablas no aparecen, comprueba primero que `.env` incluya `DATABASE_URL`: la URL de la API y la clave publicable no bastan para ejecutar migraciones. Copia la cadena PostgreSQL desde **Connect** del mismo proyecto Supabase; el **Session pooler** sirve para redes sin conexión IPv6. Completa la contraseña de la base de datos, que es distinta de una clave API. No publiques esa cadena ni tu contraseña en el chat.

Usa un proyecto Supabase de desarrollo nuevo o sin tablas con estos nombres:

```bash
npm run db:migrate
```

El comando aplica `001_schema.sql` y `002_operations.sql` en orden y registra las migraciones en `privado.migraciones`. Repetirlo omite las ya aplicadas. No borra tablas ni reinicia datos. Las migraciones están pensadas para crear este esquema, no para transformar automáticamente otro esquema existente.

Si prefieres el SQL Editor de Supabase, ejecuta una sola vez el contenido de esos dos archivos en orden. En ese caso continúa usando el SQL Editor para esta instalación: el editor no registra por sí solo la tabla de migraciones del comando Node. El esquema `privado` debe permanecer fuera de los esquemas expuestos por la Data API.

### Paso C: cargar datos de prueba (como los seeders de Laravel)

```bash
npm run db:seed
```

Equivalencias:

| Laravel | Este proyecto |
| --- | --- |
| `php artisan migrate` | `npm run db:migrate` |
| `php artisan db:seed` | `npm run db:seed` |
| `DatabaseSeeder` | `scripts/seed.js` ejecutando `database/seed.sql` |

También puedes ejecutar `database/seed.sql` en el SQL Editor. Crea 3 sucursales, 3 empleados, 3 medicamentos, 1 cliente, activos, mínimos, lotes y aperturas de caja de prueba. Los códigos empiezan con `DEMO-`. Puedes repetirlo: no duplica registros ni restablece cantidades ya vendidas. No crea contraseñas ni usuarios Auth.

Después de migrar y cargar datos, ejecuta `npm run db:check`. Comprueba la conexión y cuenta registros sin modificar datos. En el Table Editor de Supabase selecciona el esquema `public`. Si faltan tablas, aplica las migraciones; si están vacías, ejecuta el seeder. `npm run dev` solo inicia Express y no crea tablas ni datos.

Los IDs de los ejemplos siguientes corresponden a una base nueva. Si ya existen otros datos, consulta los listados y utiliza los IDs devueltos. No asumas que las secuencias son consecutivas después de reintentos.

### Paso D: iniciar Node

```bash
npm run dev
```

Node reinicia el proceso cuando guardas cambios con su opción integrada `--watch`. Para iniciar sin reinicios: `npm start`.

```http
GET http://localhost:3000/api/health
```

Devuelve `{ "status": "ok" }`. Comprueba que Express está vivo; no comprueba la conexión remota ni que se hayan aplicado las migraciones.

## 5. Configurar usuarios y permisos

### Crear el primer administrador

1. En Supabase Auth habilita correo/contraseña y configura la confirmación de correo y las URL de redirección para tu aplicación.
2. Crea una cuenta mediante `POST /api/register` o desde Supabase Auth. Si hay confirmación por correo, confirma la cuenta antes del login.
3. Desde el SQL Editor, asigna el perfil inicial usando el correo real de tu cuenta:

```sql
insert into public.perfiles(id_usuario, rol, id_sucursal, activo)
select id, 'ADMIN', null, true
from auth.users
where email = 'admin@example.com'
on conflict (id_usuario) do update
set rol = 'ADMIN', id_sucursal = null, activo = true;
```

Si el correo no existe en Auth, el SQL no crea ningún perfil. Verifica el correo y la cuenta.

4. Inicia sesión y usa `session.access_token` como Bearer token.
5. El administrador ya puede crear/asignar perfiles por `POST /api/perfiles` y modificarlos por `PATCH /api/perfiles/:uuid`.

Una cuenta registrada **no recibe permisos empresariales automáticamente**. El perfil se guarda en una tabla protegida, no en los metadatos editables del usuario. Para desactivar acceso, cambia `activo` a `false`: tanto el middleware como PostgreSQL revisan el perfil.

Ejemplo: asignar un gerente a la sucursal 1, después de crear su cuenta Auth:

```json
{
  "id_usuario": "UUID-REAL-DE-AUTH",
  "rol": "GERENTE",
  "id_sucursal": 1,
  "activo": true
}
```

### Roles

| Rol | Permisos principales |
| --- | --- |
| `ADMIN` | Toda la empresa; administra sucursales, medicamentos y perfiles. |
| `GERENTE` | Opera y audita su sucursal; empleados, activos, mínimos, planilla y anulaciones. |
| `VENDEDOR` | Clientes, ventas y preparación/entrega de pedidos de su sucursal. |
| `BODEGA` | Entradas, ajustes, traslados y preparación/entrega de pedidos de su sucursal. |
| `CAJERO` | Ventas y movimientos manuales de caja de su sucursal. |
| `CALL_CENTER` | Clientes, disponibilidad de toda la cadena, creación/reasignación/cancelación de pedidos. No confirma entregas. |
| `AUDITOR` | Lectura global, auditoría y reportes; sin operaciones de escritura. |

`GERENTE`, `VENDEDOR`, `BODEGA` y `CAJERO` necesitan `id_sucursal`. `ADMIN`, `CALL_CENTER` y `AUDITOR` tienen alcance global. Solo ADMIN cambia catálogos globales y perfiles. Los salarios y activos se consultan con ADMIN, GERENTE o AUDITOR; caja con ADMIN, GERENTE, CAJERO o AUDITOR.

**RLS** significa seguridad por fila. El token permite que Supabase reconozca al usuario mediante `auth.uid()`. Un gerente consulta únicamente filas de su sucursal. Los listados de otra sucursal quedan vacíos y los registros individuales no accesibles responden 404. Las operaciones de escritura sin permisos responden 403. Las tablas de stock, ventas, caja, planilla y auditoría no aceptan escrituras directas de usuarios: se modifican mediante las funciones autorizadas.

## 6. Rutas y cuerpos de las peticiones

Base: `http://localhost:3000/api`. Envía JSON con `Content-Type: application/json`.

Todas las rutas de negocio requieren:

```http
Authorization: Bearer TU_ACCESS_TOKEN
```

Las operaciones que modifican stock, ventas, pedidos, traslados, caja o planilla también requieren:

```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

Genera un UUID por operación, por ejemplo `crypto.randomUUID()`. En un reintento utiliza **la misma clave y el mismo cuerpo**. Otra operación necesita otra clave. No recicles la clave para cambiar el estado de un pedido. Los CRUD de catálogos no usan este encabezado.

### Autenticación pública

| Método | Ruta | Cuerpo |
| --- | --- | --- |
| GET | `/health` | Sin cuerpo. |
| POST | `/register` | `username`, `email`, `password`. |
| POST | `/login` | `email`, `password`. |
| POST | `/refresh` | `refresh_token`. |
| GET | `/me` | Sin cuerpo; requiere sesión y devuelve el perfil empresarial. |

Registro: nombre de 3 a 50 caracteres, correo válido y contraseña de 8 o más caracteres, además de la política de Supabase. Un registro sin sesión devuelve 202; con sesión devuelve 201. Login/refresh devuelven `user` y `session` en el nivel principal, conservando el contrato inicial del proyecto. Usa los nuevos tokens después de renovar; Supabase puede rotarlos.

### CRUD de catálogos

Para cada recurso siguiente existen:

```http
GET   /api/RECURSO?page=1&limit=25
GET   /api/RECURSO/ID
POST  /api/RECURSO
PATCH /api/RECURSO/ID
```

| Recurso | Campos obligatorios para crear | Filtros disponibles |
| --- | --- | --- |
| `sucursales` | `codigo`, `nombre`, `departamento`, `direccion`, `tipo`, `latitud`, `longitud` | `estado`, `departamento`, `tipo` |
| `empleados` | `codigo`, `id_sucursal`, `nombre`, `apellido`, `puesto`, `salario` | `id_sucursal`, `estado` |
| `medicamentos` | `codigo`, `nombre`, `categoria`, `principio_activo`, `precio_compra`, `precio_venta` | `estado`, `categoria` |
| `clientes` | `codigo`, `nombre`, `apellido`, `telefono`, `direccion` | `codigo` |
| `activos` | `codigo`, `id_sucursal`, `nombre`, `valor`, `vida_util_meses`, `fecha_adquisicion` | `id_sucursal`, `estado` |
| `stock-minimos` | `id_sucursal`, `id_medicamento`, `stock_minimo` | `id_sucursal`, `id_medicamento` |
| `perfiles` | `id_usuario`, `rol` y sucursal si el rol la necesita | `rol`, `id_sucursal` |

Los campos adicionales permitidos y sus límites están en `src/config/resources.js`. PATCH recibe únicamente los campos que deseas cambiar. No se acepta modificar la clave primaria. Los IDs son enteros positivos salvo perfiles, que usa el UUID de Auth.

No hay DELETE: desactiva sucursales/empleados/medicamentos mediante `estado`; da de baja activos con `estado: "BAJA"`. El historial y las relaciones se conservan. Clientes permanecen registrados para mantener los documentos relacionados.

Ejemplo de sucursal:

```json
{
  "codigo": "FARM-004",
  "nombre": "Farmacia Centro",
  "departamento": "Guatemala",
  "direccion": "Centro comercial zona 1",
  "tipo": "FARMACIA",
  "latitud": 14.6407,
  "longitud": -90.5133,
  "radio_entrega_km": 15,
  "preparacion_minutos": 15,
  "velocidad_kmh": 20,
  "acepta_pedidos": true
}
```

### Consultas de operaciones e historial

Todos admiten GET de listado y GET por ID. Los listados usan `page` y `limit` (máximo 100).

| Recurso | Filtros |
| --- | --- |
| `inventario` | `id_sucursal`, `id_medicamento`, `lote` |
| `ventas` | `id_sucursal`, `id_cliente`, `estado` |
| `pedidos` | `id_sucursal`, `id_cliente`, `estado` |
| `traslados` | `id_sucursal_origen`, `id_sucursal_destino`, `estado` |
| `movimientos-medicamentos` | `id_sucursal`, `id_inventario`, `tipo` |
| `movimientos-caja` | `id_sucursal`, `tipo`, `metodo_pago` |
| `planillas` | `id_sucursal`, `periodo` |
| `auditoria` | `id_sucursal`, `tabla`, `actor` (UUID), `accion` |

Detalles paginados: `GET /ventas/:id/detalles`, `/pedidos/:id/detalles`, `/traslados/:id/detalles`, `/planillas/:id/detalles`. El acceso a los detalles depende del acceso a su cabecera.

### Operaciones de negocio

| Método | Ruta | Qué hace |
| --- | --- | --- |
| POST | `/inventario/entradas` | Suma unidades a un lote. |
| POST | `/inventario/:id/ajustes` | Suma/resta por conteo o daño, con motivo. |
| POST | `/ventas` | Calcula total, descuenta stock y registra ingreso. |
| POST | `/ventas/:id/anular` | Devuelve unidades y registra egreso compensatorio. |
| POST | `/traslados` | Descuenta origen y registra mercancía en tránsito. |
| POST | `/traslados/:id/recibir` | Suma destino y confirma recepción una sola vez. |
| POST | `/movimientos-caja` | Registra ingreso o egreso manual. |
| POST | `/movimientos-caja/:id/revertir` | Crea una contrapartida de un movimiento manual. |
| POST | `/planillas` | Guarda y paga la planilla mensual de una sucursal. |
| POST | `/disponibilidad` | Cotiza sucursales que pueden atender todo el pedido; no modifica datos ni necesita clave. |
| POST | `/pedidos` | Calcula el precio/ETA y reserva lotes en la sucursal elegida. |
| PATCH | `/pedidos/:id/estado` | Avanza la preparación/entrega o libera reservas al cancelar/devolver. |
| POST | `/pedidos/:id/reasignar` | Cambia sucursal y reservas antes de despachar; mantiene el precio pactado. |
| GET | `/reportes/resumen` | Resume flujo de fondos, planilla, activos, stock y pedidos atrasados. |

**Entrada** (`POST /inventario/entradas`):

```json
{
  "id_sucursal": 1,
  "id_medicamento": 1,
  "lote": "COMPRA-2026-A",
  "fecha_vencimiento": "2028-12-31",
  "cantidad": 50,
  "costo_unitario": 5,
  "motivo": "Recepción de compra"
}
```

`costo_unitario` es opcional: por defecto toma `precio_compra` del medicamento. Un lote existente conserva costo y vencimiento; diferencias se rechazan. La entrada registra stock, no paga automáticamente una factura: registra el gasto de la compra por caja cuando corresponda.

**Ajuste** (`POST /inventario/ID/ajustes`):

```json
{ "diferencia": -2, "motivo": "Dos cajas dañadas" }
```

**Venta** (`POST /ventas`):

```json
{
  "id_sucursal": 1,
  "id_empleado": 1,
  "id_cliente": 1,
  "metodo_pago": "EFECTIVO",
  "items": [{ "id_medicamento": 1, "cantidad": 2 }]
}
```

Empleado y cliente son opcionales en venta de mostrador. Si informas empleado, debe estar activo en esa sucursal. No envíes precios, subtotales ni total: el servidor los calcula. Cuando hay medicamentos con receta, agrega `receta_referencia`; la referencia registra la verificación realizada por el personal, no sustituye la revisión profesional del documento.

**Anulación/reversión:** cuerpo `{ "motivo": "Error de captura" }`. Solo GERENTE/ADMIN. Anulación se aplica a ventas de mostrador, no a pedidos ya entregados. No duplica el retorno ni el reembolso. Una reversión de caja no puede usarse para cambiar pagos de ventas o planillas.

**Traslado** (`POST /traslados`):

```json
{
  "id_sucursal_origen": 1,
  "id_sucursal_destino": 2,
  "motivo": "Reposición de sucursal",
  "items": [{ "id_medicamento": 1, "cantidad": 10 }]
}
```

La sucursal origen autoriza la salida. Para recibir, envía `{}` a `POST /traslados/ID/recibir` con una cuenta de la sucursal destino o ADMIN. Durante el tránsito esas unidades no están disponibles para venta en ninguna sucursal. Los detalles conservan lote, vencimiento y costo.

**Caja manual** (`POST /movimientos-caja`):

```json
{
  "id_sucursal": 1,
  "tipo": "EGRESO",
  "concepto": "Pago de energía eléctrica",
  "monto": 250.50,
  "metodo_pago": "TRANSFERENCIA"
}
```

`id_empleado` es opcional. Todos los importes tienen máximo dos decimales. EFECTIVO representa caja física; TARJETA y TRANSFERENCIA representan fondos por otros medios. El registro de una operación no ejecuta cobros en bancos ni en pasarelas.

Esta versión trabaja con una sola moneda; los datos DEMO representan quetzales (GTQ). No mezcla monedas ni realiza conversiones.

**Planilla** (`POST /planillas`):

```json
{
  "id_sucursal": 1,
  "periodo": "2026-10-01",
  "ajustes": [{ "id_empleado": 1, "bonificacion": 250, "deduccion": 100 }]
}
```

`periodo` siempre es el primer día del mes. Incluye todos los empleados activos de la sucursal y conserva su salario base. `ajustes` es opcional. Neto = salario + bonificación - deducción. Se genera un egreso por TRANSFERENCIA y no se permite pagar dos veces la misma sucursal/mes. Impuestos, prestaciones y descuentos se ingresan como ajustes: no hay cálculo legal automático ni prorrateo de días trabajados.

### Call center y entregas

Primero consulta `POST /disponibilidad`:

```json
{
  "latitud": 14.6407,
  "longitud": -90.5133,
  "items": [{ "id_medicamento": 1, "cantidad": 2 }]
}
```

Devuelve candidatas ordenadas por tiempo estimado, con distancia, disponibilidad, precio, total, requisito de receta y medios de pago. Una lista vacía significa que ninguna sucursal puede entregar el pedido completo en su radio de cobertura. La consulta no reserva: al crear el pedido se vuelve a comprobar el stock con bloqueos.

Después crea `POST /pedidos`:

```json
{
  "id_cliente": 1,
  "id_sucursal": 1,
  "latitud": 14.6407,
  "longitud": -90.5133,
  "direccion_entrega": "Dirección del cliente, zona 1",
  "metodo_pago": "EFECTIVO",
  "canal": "TELEFONO",
  "items": [{ "id_medicamento": 1, "cantidad": 2 }]
}
```

Estados:

```text
PENDIENTE → PREPARANDO → EN_CAMINO → ENTREGADO
    |            |          |
    v            v          v
CANCELADO     CANCELADO   DEVUELTO
```

Ejemplos de `PATCH /pedidos/ID/estado`, cada uno con una nueva clave de idempotencia:

```json
{ "estado": "PREPARANDO" }
```

```json
{ "estado": "EN_CAMINO", "repartidor": "Luis Pérez" }
```

```json
{ "estado": "ENTREGADO" }
```

Solo al entregar se descuentan las reservas, se crea la venta y se registra el ingreso. Para este flujo el pago se considera confirmado al marcar ENTREGADO. No marca el pedido automáticamente como entregado por el paso del tiempo.

Si el cliente cancela antes del despacho: `{ "estado": "CANCELADO", "motivo": "Cliente canceló" }`. Si una entrega falla, marca DEVUELTO **cuando los productos hayan regresado a la sucursal**, con motivo obligatorio. Libera reservas sin generar una venta. Un lote vencido no puede entregarse. Las devoluciones de productos ya vendidos/entregados y los reembolsos parciales necesitan un módulo adicional.

`cantidad` es el stock registrado de la sucursal, incluidas unidades reservadas para reparto; `reservado` indica unidades comprometidas. Disponible = cantidad - reservado, excluyendo vencidos. Los pedidos EN_CAMINO permiten identificar qué reservas están en reparto. Las reservas se mantienen hasta entrega, cancelación o retorno; el operador debe gestionar los atrasos.

Reasignar antes del despacho con `POST /pedidos/ID/reasignar`:

```json
{ "id_sucursal": 2, "motivo": "Otra sucursal puede atender antes" }
```

Solo ADMIN/CALL_CENTER o GERENTE con permiso sobre ambas sucursales. Si falta stock o cobertura en destino, se conserva la reserva original. Si tiene éxito, cambia a PENDIENTE y actualiza la promesa de entrega.

El ETA usa distancia en línea recta, velocidad configurada y minutos de preparación. Es una estimación inicial para el operador; no consulta tráfico, horarios, disponibilidad de repartidores ni rutas de carretera. Esos servicios se pueden integrar después sin cambiar el contrato básico del pedido.

### Reportes y auditoría

```http
GET /api/reportes/resumen?desde=2026-10-01T00:00:00-06:00&hasta=2026-11-01T00:00:00-06:00&id_sucursal=1
```

`desde` incluido y `hasta` excluido. Usa fechas ISO con zona horaria. `id_sucursal` es opcional. ADMIN/AUDITOR ven toda la empresa; GERENTE solo su sucursal.

El resumen devuelve caja agrupada por sucursal y medio de pago, saldo inicial, ingresos, egresos y saldo final; planilla pagada durante el período; activos vigentes con valor de adquisición y depreciación lineal estimada; stock actual valorizado por costo de lote, vencidos y alertas de mínimo; pedidos abiertos cuya promesa ya venció.

Caja y planilla se consultan por período. Stock, estado de activos y atrasos representan la situación actual; el valor contable estimado usa la fecha hasta. El historial de cambios está en auditoría. Este reporte no reconstruye un balance histórico completo ni sustituye una contabilidad fiscal.

```http
GET /api/auditoria?tabla=inventario&id_sucursal=1&page=1&limit=25
GET /api/movimientos-medicamentos?id_sucursal=1
GET /api/movimientos-caja?id_sucursal=1&metodo_pago=EFECTIVO
GET /api/pedidos?id_sucursal=1&estado=EN_CAMINO
```

Auditoría guarda tabla, registro, INSERT/UPDATE/DELETE, actor, fecha y valores antes/después. Los datos de auditoría son sensibles y se limitan a ADMIN/GERENTE/AUDITOR. Los seeders/SQL de mantenimiento tienen actor nulo porque no representan una sesión de la API. No guarda contraseñas ni tokens.

### Respuestas y errores

Registro de negocio o resultado de operación:

```json
{ "data": { "id_venta": 1, "total": 20 } }
```

Listado:

```json
{ "data": [], "pagination": { "page": 1, "limit": 25, "total": 0 } }
```

Error:

```json
{ "message": "Descripción del error" }
```

| Código | Significado |
| --- | --- |
| 200 / 201 | Consulta/actualización correcta o registro creado. |
| 202 | Registro Auth recibido sin sesión todavía. |
| 400 | Datos, filtros o JSON inválidos. |
| 401 | Token ausente/vencido o credenciales inválidas. |
| 403 | Perfil inactivo, rol/sucursal sin permiso u origen CORS no permitido. |
| 404 | Ruta o registro no encontrado/no visible. |
| 409 | Stock insuficiente, estado incompatible o registro/operación duplicada. |
| 413 | JSON supera 64 KB. |
| 429 | Demasiados intentos de autenticación. |
| 500 / 503 | Error interno o servicio temporalmente no disponible. |

## 7. Cómo consumirlo desde React

Ejemplo para una interfaz **interna** con un usuario empresarial autenticado:

```js
const API_URL = 'http://localhost:3000/api';

async function iniciarSesion(email, password) {
  const respuesta = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.message);
  return datos; // datos.session.access_token y datos.session.refresh_token
}

async function crearVenta(accessToken, venta, clave) {
  const respuesta = await fetch(`${API_URL}/ventas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Idempotency-Key': clave,
    },
    body: JSON.stringify(venta),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.message);
  return datos.data;
}

// Genera la clave una vez al confirmar. Consérvala si necesitas reintentar.
const clave = crypto.randomUUID();
```

Guarda/renueva la sesión según la estrategia del frontend. `/refresh` recibe el refresh token y devuelve los tokens nuevos. La autorización del backend no depende de ocultar botones en React. El proyecto no incluye pantalla ni endpoint de cierre de sesión; borrar los tokens del cliente no revoca por sí solo una sesión de Supabase.

Una futura aplicación para clientes necesitará identidad/permisos de cliente o un servicio de integración propio. No entregues a clientes finales el token de un operador CALL_CENTER: ese rol puede consultar y operar pedidos de toda la cadena. El modelo de pedidos ya conserva cliente, canal, dirección, sucursal, pago y ETA para esa futura integración.

## 8. Tests y alcance de esta entrega

```bash
npm test
```

No necesitas .env, Docker ni un Supabase remoto para los tests. Se crea PostgreSQL temporal en memoria con PGlite, se ejecutan las migraciones y el seeder reales, y se instalan roles/Auth mínimos para las pruebas. Los tests HTTP recorren rutas, middleware, controladores, modelos y SQL con un adaptador de pruebas; las llamadas remotas de Supabase Auth se simulan.

Se comprueban CRUD, permisos/RLS, perfiles inactivos, CORS, validaciones, FEFO, vencimientos, reservas, rollback, idempotencia, ventas/anulaciones, traslado/recepción, pago de planilla, caja/reversión, pedidos/reasignación/devolución, auditoría, reportes y renovación de sesión.

Estos tests no verifican la conectividad/SMTP del proyecto remoto ni carreras entre conexiones PostgreSQL independientes. Para probar tu integración real: aplica migraciones, ejecuta el seeder, crea el administrador y recorre login → disponibilidad → pedido → entrega desde Postman. Antes de un despliegue a gran escala hacen falta pruebas de carga/concurrencia sobre PostgreSQL real, observabilidad, backups/restauración y un límite de intentos compartido entre instancias; el actual se mantiene en memoria por proceso. Los bloqueos de stock se hacen por sucursal para que la primera versión sea fácil de seguir.

Las compras a proveedores, pasarelas de pago, cálculo fiscal de planilla, devoluciones de ventas entregadas, cadena de frío y navegación/tráfico no forman parte de esta primera API. Los movimientos manuales y ajustes cubren el registro básico, no esos procesos completos. Los índices, paginación, restricciones, transacciones y permisos son una base para ampliar el sistema; no representan una certificación para una operación bursátil.

## 9. Recorrido recomendado para aprender

Lee `index.js` → `app.js` → `business.routes.js` → `operation.controller.js` → `operation-validation.js` → `operation.model.js` → `api.view.js`. Después sigue una venta en `002_operations.sql` y compara con `tests/database.test.js`.

`async/await` espera consultas sin bloquear todas las peticiones; `req.body` contiene el JSON; `res.status(...).json(...)` responde; `return` termina una función; `try/catch` maneja errores. `{ ...objeto }` copia sus propiedades; `Object.entries(objeto)` permite recorrer nombre y valor. En SQL, `FOR UPDATE` bloquea los lotes usados y `RAISE EXCEPTION` cancela la transacción. Comienza con el CRUD de clientes y luego estudia ventas/reservas.

Documentación oficial: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones y RPC](https://supabase.com/docs/guides/database/functions), [verificación de usuario](https://supabase.com/docs/reference/javascript/auth-getuser), [renovación de sesión](https://supabase.com/docs/reference/javascript/auth-refreshsession).
