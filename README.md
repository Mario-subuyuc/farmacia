# Backend de una cadena de farmacias

API en **Node, Express, MVC y Supabase (PostgreSQL + Auth)** y aplicación interna en **React + Vite**, dentro de `frontend/`. Usa Node 22.12 o superior para ambos. El código usa funciones, objetos y comentarios en español; no usa clases ni un ORM.

Para ver la interfaz, ejecuta desde esta carpeta `npm.cmd run ui:install` y luego `npm.cmd run ui`. Inicia también la API con `npm.cmd run dev`. Abre **http://localhost:5173**: la página principal muestra el catálogo público de productos y sucursales sin login. **Acceso del personal** abre el login del sistema interno. Solo ADMIN crea usuarios; no hay registro público ni demostración de operaciones.

**[Guía completa de React, explicación para un junior y despliegue](frontend/README.md)**. Este README documenta principalmente la API, SQL y permisos.

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

### Catálogo y stock de prueba

La migración `004_demo_products.sql` crea 12 medicamentos ficticios en las tres sucursales DEMO. Define `privado.cargar_catalogo_demo()`, que también llama `database/seed.sql`: así la migración y el seeder usan los mismos datos. No se conceden permisos públicos para ejecutar esta carga. Los datos existentes se conservan; repetir el seeder no restablece stock vendido ni modifica precios.

| Producto | Guatemala | Mixco | Xela |
| --- | ---: | ---: | ---: |
| Paracetamol | 150 (dos lotes) | 100 | 100 |
| Amoxicilina | 100 | 100 | 100 |
| Suero oral | 100 | 100 | 100 |
| Ibuprofeno | 80 | 25 | 0 |
| Loratadina | 45 | 12 | 30 |
| Cetirizina | 0 | 35 | 8 |
| Omeprazol | 60 | 18 | 5 |
| Antiácido | 15 | 0 | 22 |
| Vitamina C | 75 | 30 | 0 |
| Salbutamol | 12 | 4 | 0 |
| Losartán | 20 | 0 | 0 |
| Crema de hidrocortisona | 0 | 0 | 0 |

Son cantidades **iniciales**; las operaciones posteriores pueden cambiarlas. Los ceros prueban el catálogo sin disponibilidad, los mínimos de 20 prueban alertas y los dos lotes de paracetamol prueban FEFO. Los precios, presentaciones y requisitos de receta son datos ficticios configurados para las pruebas. En una base ya utilizada, la migración añade solo lo que falta.

### Crear el primer administrador (seeder)

**Automático con el seeder:** ya no necesitas ejecutar el SQL manual cada vez que instalas desde cero. En el `.env` principal configura:

```env
ADMIN_SEED_EMAIL=mariosubuyucfb@gmail.com
ADMIN_SEED_NAME=Mario
ADMIN_SEED_PASSWORD=TU_CONTRASEÑA_PROPIA_DE_AL_MENOS_8_CARACTERES
SUPABASE_SECRET_KEY=TU_CLAVE_PRIVADA_DEL_PROYECTO
```

Desde la raíz ejecuta `npm.cmd run db:migrate` y después `npm.cmd run db:seed`. El segundo comando carga los datos DEMO y crea tu cuenta confirmada con perfil ADMIN activo. Si la cuenta ya existe, utiliza su ID y restaura el perfil ADMIN **sin cambiar su contraseña**; no necesita crearla de nuevo. La contraseña configurada solo se usa al crear una cuenta nueva. No se imprime ni se guarda en SQL/Git. Puedes usar `SUPABASE_SERVICE_ROLE_KEY` si tu proyecto utiliza la clave antigua.

`DATABASE_URL`, `SUPABASE_URL` y la clave privada deben pertenecer al mismo proyecto. `db:seed` no borra datos ni reinicia la base. Cada vez que lo ejecutas vuelve a activar y asignar ADMIN **únicamente al correo de ADMIN_SEED_EMAIL**. Para omitir ese paso, deja dicha variable vacía. El archivo `database/seed.sql` ejecutado a mano sigue cargando solo datos; la creación Auth la hace `scripts/seed-admin.js` mediante el comando Node.

**Alternativa manual**, si no utilizas el seeder del administrador:

1. En Supabase Auth habilita correo/contraseña y desactiva **Allow new users to sign up** para impedir el registro directo de visitantes. El catálogo no necesita cuentas ni inicio de sesión anónimo de Auth.
2. Crea la primera cuenta mediante el seeder anterior o desde el panel administrativo de Supabase Auth. No existe registro público en la aplicación.
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
| GET | `/catalogo` | Sin token; filtros `q`, `id_sucursal`, `categoria`, `page`, `limit`. |
| POST | `/login` | `email`, `password`. |
| POST | `/refresh` | `refresh_token`. |
| GET | `/me` | Sin cuerpo; requiere sesión y devuelve el perfil empresarial. |

Login/refresh devuelven `user` y `session` en el nivel principal. Usa los nuevos tokens después de renovar; Supabase puede rotarlos. `POST /api/register` devuelve **410**: el registro público fue deshabilitado. Solo `POST /api/usuarios`, autorizado para ADMIN, crea cuentas del personal.

El catálogo público devuelve nombre, descripción, categoría, principio activo, precio de venta, requisito de receta y contactos de sucursales con disponibilidad. No devuelve costos, lotes, cantidades internas, empleados ni caja. La migración `003_public_catalog.sql` crea una función de lectura con salida limitada; no otorga acceso anónimo a las tablas. La disponibilidad excluye reservas, vencimientos y registros inactivos. La búsqueda es literal por nombre, principio activo o descripción; al filtrar sucursal solo aparecen productos disponibles allí. Sin sucursal se muestran también productos activos sin disponibilidad. Paginación: 12 por defecto, máximo 48.

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
| 410 | Registro público deshabilitado. Las cuentas las crea ADMIN. |
| 400 | Datos, filtros o JSON inválidos. |
| 401 | Token ausente/vencido o credenciales inválidas. |
| 403 | Perfil inactivo, rol/sucursal sin permiso u origen CORS no permitido. |
| 404 | Ruta o registro no encontrado/no visible. |
| 409 | Stock insuficiente, estado incompatible o registro/operación duplicada. |
| 413 | JSON supera 64 KB. |
| 429 | Demasiados intentos de autenticación. |
| 500 / 503 | Error interno o servicio temporalmente no disponible. |

## 7. Cómo consumirlo desde React

**Crear cuentas como administrador:** la interfaz ahora permite **Accesos y permisos → Crear usuario** con nombre, correo, contraseña, rol y sucursal, sin introducir UUID. Configura `SUPABASE_SECRET_KEY` (o la clave antigua `SUPABASE_SERVICE_ROLE_KEY`) exclusivamente en el `.env` del backend y reinicia Node. `POST /api/usuarios` requiere un perfil ADMIN activo; devuelve el perfil creado, nunca la contraseña ni una sesión del usuario nuevo. Este flujo habilita el correo sin mandar confirmación; el registro de visitantes esta deshabilitado. La clave privada solo administra Auth: el perfil se guarda con el token del administrador para aplicar RLS y registrar el actor. Si falla el perfil, se intenta deshacer la cuenta recién creada. No modifica cuentas preexistentes. [Instrucciones completas](frontend/README.md).

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

El frontend guarda la sesión en `sessionStorage` de la pestaña y renueva los tokens mediante `/refresh`. La autorización del backend no depende de ocultar botones en React. El botón de salida elimina la sesión de esa pestaña; el backend no tiene un endpoint que revoque todas las sesiones de Supabase.

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

### Imágenes de medicamentos (Supabase Storage)

Ejecuta `npm.cmd run db:migrate` para agregar la columna de imagen y crear el bucket público `catalogo` con políticas de subida exclusivas para ADMIN. Luego, en el panel del personal, abre Medicamentos → Imagen junto al producto y selecciona una foto JPEG, PNG o WebP de hasta 5 MB. La foto se muestra en el catálogo público; los productos sin foto conservan su ícono. No requiere claves privadas adicionales.

La API recibe el archivo binario en `POST /api/medicamentos/:id/imagen`, valida tipo y firma y usa el token del administrador para subirlo. Guarda la URL en `medicamentos.imagen_url`; los archivos quedan en `catalogo/medicamentos/ID/UUID.ext`. Si falla la actualización de la base, intenta eliminar la subida. Al reemplazar una foto se conserva el archivo anterior en Storage para no romper lecturas en curso; se puede limpiar posteriormente desde Supabase. No se incluyen fotos de productos ni se suben imágenes automáticamente sin seleccionarlas.

Para volver a cargar ilustraciones propias en los productos DEMO sin imagen: `node scripts/seed-catalog-images.js`. Requiere la clave privada del backend y Microsoft Edge para renderizar los PNG. Solo completa imágenes ausentes y conserva las fotos existentes. Son ilustraciones de demostración, no fotografías de presentaciones comerciales.

Para reemplazar las ilustraciones DEMO por fotografías reales de Wikimedia Commons: `node scripts/seed-catalog-photos.js`. Conserva fotos subidas por usuarios fuera de la carpeta demo. Los créditos, autores y licencias se guardan en `frontend/public/catalog-photo-credits.json` y `.html`, enlazados desde el catálogo. Las fotos son referencias de otras presentaciones comerciales. El script puede reanudarse tras una descarga interrumpida.

### Carrito del catálogo público

El botón Carrito permite ajustar cantidades (1 a 99), eliminar productos, vaciar la selección y descargar una lista con el total estimado en quetzales. La selección se guarda en localStorage del navegador; no requiere iniciar sesión. No permite agregar medicamentos sin disponibilidad. La lista no reserva inventario, no cobra ni crea un pedido: el cliente debe confirmar precio, disponibilidad y receta en la farmacia. Los pedidos operativos siguen a cargo del personal autorizado.

### Pedidos desde el carrito y seguimiento

El carrito incluye animación al agregar productos y **Continuar con el pago**. El cliente introduce nombre, apellido, teléfono, dirección y coordenadas (manuales o mediante el botón de ubicación); selecciona una sucursal con sus productos y elige efectivo, tarjeta o transferencia **al recibir**. No existe una pasarela ni se solicitan datos bancarios. Los precios se calculan en PostgreSQL, se valida cobertura y stock y se reserva inventario en la misma transacción que crea cliente y pedido. Los medicamentos con receta requieren validación presencial del personal y no se confirman desde el portal.

La migración `007_portal_orders.sql` incorpora operaciones RPC exclusivas de `service_role`. La API usa la clave privada existente solo en el backend, valida campos y aplica límites de solicitudes. Rutas públicas: `POST /api/tienda/pedidos` y `POST /api/tienda/seguimiento`. Los reintentos con la misma clave y datos devuelven el mismo pedido. La base conserva el hash SHA-256 del código privado de seguimiento; el código original se guarda en el navegador del cliente. No aparece en la URL ni se devuelve información de domicilio o teléfono personal en seguimiento.

**Seguir mi pedido** consulta PENDIENTE → PREPARANDO → EN_CAMINO → ENTREGADO, o CANCELADO/DEVUELTO. Actualiza cada minuto y admite refresco manual. Es seguimiento del estado operativo, no posición GPS en vivo. El personal gestiona el pedido desde el módulo Pedidos existente. El código privado permite recuperar el seguimiento en otro dispositivo. Los pedidos pendientes reservan inventario hasta entrega, cancelación o devolución; el personal debe gestionar pedidos abandonados.

Validación: 62 pruebas de backend, 15 de frontend y compilación. El navegador se probó con respuestas de creación/seguimiento simuladas, sin generar pedidos de prueba remotos; la conexión del seguimiento a Supabase se verificó con un código inexistente.

### Página de inicio de la farmacia

La raíz `http://localhost:5173/` y `#home` muestran la landing de NexoFarma: presentación, servicios, productos, pasos de compra y sucursales. Los productos y sucursales vienen del catálogo público. El catálogo sigue disponible en `#catalogo`; su logo vuelve al inicio. La landing comparte el carrito y el seguimiento existentes y se adapta a escritorio y móvil.

### Promociones, contenido institucional y asistente de compras

En **Medicamentos → Editar**, ADMIN puede configurar descuento (0 a 90 %), título y fechas de vigencia opcionales. El precio de venta es el regular. Con 0 se desactiva la promoción; las fechas son inclusivas según America/Guatemala. La migración `008_promotions_search.sql` calcula el precio efectivo en catálogo, disponibilidad, venta y pedido, conservando los precios históricos ya guardados. El carrito muestra estimados y el servidor confirma el importe. La landing incluye promociones vigentes, misión, visión y programas de acompañamiento; la actividad y disponibilidad de cada programa se confirma con la sucursal.

Se cargaron tres promociones en productos DEMO sin descuento: Paracetamol 15 %, Loratadina 10 % y Vitamina C 20 %, vigentes durante 30 días desde su carga. `node scripts/seed-demo-promotions.js` completa únicamente estos productos cuando no tienen descuento; no modifica promociones ya configuradas.

**¿Te ayudamos?** abre un asistente guiado en landing y catálogo, sin servicio de IA ni claves adicionales. Ofrece búsqueda de productos, categorías, promociones, preguntas frecuentes y seguimiento por código privado. El endpoint `POST /api/asistente/productos` acepta solo `consulta` y `categoria`; consulta la función pública de catálogo, sin SQL libre ni acceso a datos internos. Normaliza tildes y mayúsculas, filtra símbolos por expresión regular y elimina palabras comunes de preguntas. Las búsquedas parciales devuelven hasta ocho opciones; ante datos insuficientes o falta de coincidencias ofrece categorías. No interpreta texto como SQL ni como una expresión regular ejecutable, no consulta clientes, ventas o salarios, y el seguimiento reutiliza el endpoint limitado por código privado. No realiza recomendaciones de tratamiento.

Validación: 64 pruebas de backend y 15 de frontend; comprobación en navegador de promociones, precios descontados, búsquedas con tildes, opciones sin resultados, FAQ y vista móvil.

### Ciclo completo de pedidos y operación

Las migraciones 009 a 013 incorporan recetas privadas con revisión, cotización antes de confirmar, costo y horario de entrega, cupones, confirmación atómica de pago/entrega, cancelación, vencimiento de reservas, contenido editable y cola de notificaciones. El historial de compras guarda códigos privados en el navegador. Estas funciones sustituyen las limitaciones anteriores que indicaban que el portal no admitía recetas o cancelaciones.

Consulta **[Operación y despliegue](docs/OPERACION.md)** para las acciones del personal, tareas automáticas, notificaciones, copias, pruebas y despliegue. Sin proveedor contratado los pagos siguen siendo al recibir y los avisos permanecen pendientes; no hay cobros en línea ni mensajes externos simulados.

### Alertas, proveedores y calendario

El panel incluye **Alertas de inventario**, **Proveedores** y **Eventos y talleres**. Las alertas se calculan cada minuto para stock bajo y lotes vencidos o próximos a vencer; el correo SMTP es configurable en el backend. La landing muestra FullCalendar con actividades publicadas por sucursal. Ver [operación y configuración de Gmail](docs/OPERACION.md).
