# NexoFarma: frontend React explicado para un junior

React muestra las pantallas; el backend Node conserva MVC y responde JSON; Supabase guarda los datos. La interfaz está en esta carpeta y usa JavaScript, funciones y CSS normal, sin TypeScript ni Redux. Usa Node **22.12 o superior**.

## 1. Levantar la interfaz

Abre PowerShell en `C:\Users\mario\Desktop\site`:

```powershell
npm.cmd install
npm.cmd run ui:install
npm.cmd run ui
```

Abre **http://localhost:5173**. Deja la terminal abierta; `Ctrl+C` detiene el servidor. Usamos `npm.cmd` para evitar el bloqueo de scripts de PowerShell.

La página principal es una **farmacia de consulta pública**: muestra medicamentos, precios y sucursales disponibles sin pedir una cuenta. Busca por producto o principio activo y filtra por categoría o sucursal. El botón **Acceso del personal** abre el login interno. No hay registro público ni demostración de administración. Inicia también el backend y aplica las migraciones para consultar los productos reales de Supabase; los registros DEMO del seeder se muestran como cualquier otro producto existente en la base.

## 2. Trabajar con tus datos reales

Abre otra terminal, también en `site`, e inicia el backend:

```powershell
npm.cmd run dev
```

Ahora React escucha en **5173** y Node en **3000**. No ejecutes el backend dentro de `frontend`. Configura el `.env` privado de la carpeta principal como indica [el README del backend](../README.md). Debe permitir el origen del navegador:

```env
CORS_ORIGINS=http://localhost:5173
```

Si hay otros orígenes, consérvalos separados por comas. `localhost` y `127.0.0.1` son distintos para CORS.

React usa `http://localhost:3000/api` por defecto. Para cambiarlo, desde `site`:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

En `frontend/.env` configura solamente:

```env
VITE_API_URL=http://localhost:3000/api
```

Incluye `/api` y reinicia Vite si cambias la variable. **Nunca copies `DATABASE_URL`, contraseñas ni claves `service_role` a React.** Las variables `VITE_` se incorporan a los archivos públicos del navegador. [Documentación de Vite](https://vite.dev/guide/env-and-mode.html).

### Crear las tablas y los datos de prueba

La interfaz no crea tablas. Tu error anterior indica que falta `DATABASE_URL` en el `.env` del backend. Obtén la conexión PostgreSQL en **Connect** de tu proyecto Supabase y completa la contraseña de la base, siguiendo el README principal. Después ejecuta desde `site`:

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:check
```

También puedes ejecutar en el **SQL Editor del mismo proyecto Supabase**, en orden: `database/001_schema.sql`, `database/002_operations.sql`, `database/003_public_catalog.sql`, `database/004_demo_products.sql` y `database/seed.sql`. No uses el archivo MySQL descargado: Supabase utiliza PostgreSQL. La migración 004 incorpora 12 medicamentos y existencias distintas por sucursal; el seeder reutiliza sus datos sin sobrescribir stock existente. La cuenta inicial se crea mediante `npm.cmd run db:seed`, como explica la sección siguiente.

### Primer usuario y permisos

En Supabase Auth desactiva **Allow new users to sign up**. Así bloqueas también el registro directo mediante la API de Supabase. La aplicación ya deshabilita su `/api/register`; la creación del personal corresponde al administrador mediante `/api/usuarios`. El catálogo usa lecturas públicas, no necesita activar **Allow anonymous sign-ins**. [Configuración oficial de Supabase](https://supabase.com/docs/guides/auth/general-configuration).

Conservamos la limpieza de tokens de enlaces antiguos para las cuentas creadas antes del cambio. Las cuentas nuevas creadas por ADMIN o por el seeder pueden iniciar sesión directamente.

1. Obtén la cuenta creada por el administrador. Entra a **Acceso del personal**; el visitante del catálogo no necesita cuenta.
2. Para tu primer administrador puedes usar el seeder automático descrito abajo; el SQL del README principal queda como alternativa manual.
3. Inicia sesión: React consulta `GET /api/me` para conocer rol y sucursal.
4. Como administrador, usa **Accesos y permisos → Crear usuario** para registrar nombre, correo, contraseña, rol y sucursal. No necesitas copiar un UUID. También puedes editar rol, sucursal y acceso de perfiles existentes.

### Crear usuarios desde React con correo y contraseña

**Tu administrador inicial también se crea con `npm.cmd run db:seed`.** En el `.env` principal configura `ADMIN_SEED_EMAIL=mariosubuyucfb@gmail.com`, `ADMIN_SEED_NAME=Mario` y `ADMIN_SEED_PASSWORD` con una contraseña propia de 8 a 128 caracteres. La primera creación requiere también la clave privada indicada abajo. Aplica migraciones y ejecuta el seeder: carga los datos DEMO y crea la cuenta confirmada con perfil ADMIN. Al repetirlo utiliza la cuenta existente y restaura el perfil sin cambiar la contraseña. Si no quieres sembrar el administrador, deja `ADMIN_SEED_EMAIL` vacío. Ejecutar solo `database/seed.sql` no crea cuentas.

Configura una sola vez `SUPABASE_SECRET_KEY` en el **`.env` de la carpeta principal**, nunca en `frontend/.env`. En Supabase abre **Project Settings → API Keys**, copia una clave **secret** (`sb_secret_...`) y úsala así:

```env
SUPABASE_SECRET_KEY=TU_CLAVE_PRIVADA_DEL_PROYECTO
```

Si tu proyecto utiliza claves antiguas, puedes configurar `SUPABASE_SERVICE_ROLE_KEY` con su clave `service_role` en lugar de la anterior. No la compartas ni la subas al repositorio. La clave publicable sigue siendo necesaria para login y las consultas normales. Reinicia Node después de cambiar el `.env`.

Después entra como ADMIN y abre **Accesos y permisos → Crear usuario**. Completa nombre, correo, contraseña de al menos 8 caracteres, rol y sucursal cuando corresponda. Deja **Permitir acceso** marcado para habilitarlo. Al guardar, el nuevo usuario puede entrar con su correo y contraseña: este flujo administrativo habilita la cuenta sin enviar un correo de confirmación. No hay registro público.

`POST /api/usuarios` verifica la sesión ADMIN, crea la cuenta mediante Auth Admin y guarda el perfil con el token del administrador para conservar permisos y auditoría. La contraseña se entrega a Supabase Auth; no se guarda en `perfiles`, reportes ni auditoría. Si falla el perfil, intenta deshacer únicamente la cuenta recién creada. Las cuentas anteriores no se reemplazan al repetir un correo. [Referencia oficial](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

Supabase es el servicio que almacena y valida las credenciales detrás de la aplicación. Tus empleados solo necesitan conocer su correo y contraseña; no necesitan entrar a Supabase. Para una cuenta que ya existe en Auth pero no tiene perfil, utiliza el SQL de asignación del README principal; el formulario de creación no sobrescribe cuentas existentes.

Si una cuenta anterior tiene un perfil pendiente, asígnalo y pulsa la opción de volver a verificar. El menú respeta el rol, y Express/PostgreSQL vuelven a verificar los permisos. Ocultar botones no reemplaza la seguridad del backend.

## 3. Pantallas y operaciones

| Pantalla | Qué permite |
| --- | --- |
| Catálogo público | Productos, precios, receta, búsqueda y filtros por sucursal/categoría. Sin cuenta y sin operaciones internas. |
| Inicio | Resumen por sucursal, fondos, prioridades y pedidos pendientes según permisos. |
| Call center | Coordenadas, medicamentos, stock, precio, sucursales disponibles y entrega estimada; crear pedido. |
| Inventario | Lotes, vencimientos, reservas, entradas y ajustes con motivo. |
| Ventas | Venta con varios medicamentos; anulación de mostrador cuando corresponde. |
| Pedidos y entregas | Crear, preparar, despachar, entregar, cancelar, devolver o reasignar según estado. |
| Traslados | Despachar medicamentos y confirmar recepción en destino. |
| Caja y movimientos | Ingresos/egresos manuales y reversión conservando historial. |
| Planilla | Pago mensual por sucursal con bonificaciones y deducciones. |
| Reportes | Caja por fechas/medio de pago, stock, activos, atrasos y exportación CSV de la tabla elegida. |
| Administración | Sucursales, medicamentos, clientes, empleados, activos, mínimos y perfiles autorizados. |
| Control | Movimientos de medicamentos y auditoría con valores anteriores y nuevos. |

El selector superior cambia el alcance de las consultas. Los formularios solicitan la sucursal de la operación dentro de tus permisos. La búsqueda de texto busca **en la página actual**; los filtros de sucursal/estado/medicamento se envían al servidor. Usa la paginación para ver más registros.

Los precios y el stock definitivos los valida el backend al guardar. La entrega se estima mediante coordenadas y configuración de sucursales; no consulta tráfico ni rutas reales. La receta se confirma en el formulario, sin subir archivos clínicos. No se borran operaciones financieras: se anulan o revierten con motivo.

La caja de reportes aplica el rango elegido incluyendo el último día. Inventario y activos muestran la situación actual, no una fotografía histórica de stock. Los importes se presentan en quetzales (GTQ).

## 4. Cómo funciona: de MVC a React

En Laravel conoces rutas, controladores, modelos y vistas. Aquí el backend conserva MVC. En lugar de devolver una plantilla Blade devuelve **JSON**. React construye la vista que recibe el usuario.

```text
Usuario pulsa Guardar
  → componente React recoge los campos
  → api.js envía fetch con el token
  → ruta Express → controlador → modelo → Supabase
  ← respuesta JSON
  → React actualiza el estado y dibuja la tabla
```

Un **componente** es una función que devuelve una parte de la pantalla. JSX se parece a HTML y permite insertar variables con llaves: `<strong>{cliente.nombre}</strong>` muestra un nombre.

Las **props** son los datos que un componente recibe de su padre, como parámetros de una función. `DataTable` recibe filas y columnas. **useState** conserva valores que cambian, como un formulario o una lista. Cuando actualizas el estado, React actualiza la pantalla. **useEffect** permite cargar consultas al aparecer una pantalla o cambiar sus filtros.

### Archivos para leer en orden

| Archivo/carpeta | Responsabilidad |
| --- | --- |
| `src/main.jsx` | Inicia React dentro de `root` en `index.html`. |
| `src/App.jsx` | Acceso, perfil, catálogos auxiliares y pantalla actual. |
| `src/pages/AuthPage.jsx` | Login exclusivo del personal y enlace al catálogo. |
| `src/components/Layout.jsx` | Menú, encabezado y selector de sucursal. |
| `src/pages/ModulePage.jsx` | Listado, filtros, paginación, detalles y formularios. |
| `src/config/modules.js` | Campos, columnas y roles de cada módulo. |
| `src/config/operations.js` | Formularios de operaciones y acciones por estado. |
| `src/components/RecordForm.jsx` | Crear/editar catálogos. |
| `src/components/OperationForm.jsx` | Confirmar operaciones que afectan varios registros. |
| `src/services/api.js` | Dirección del backend. |
| `src/services/api-client.js` | Fetch, token, renovación, errores y consultas paginadas. |
| `src/services/session.js` | Sesión de la pestaña. |
| `src/pages/PublicCatalogPage.jsx` | Búsqueda, filtros, precios y sucursales sin sesión. |
| `src/utils/` | Dinero, fechas, formularios y CSV. |
| `src/styles.css` | Diseño y adaptación a celular. |

Las tablas y formularios comunes se reutilizan para evitar copiar la misma lógica. Para agregar una columna a medicamentos busca su definición en `modules.js`. Para seguir una venta lee `operations.js` → `OperationForm.jsx` → la ruta correspondiente del backend.

### Ejemplo completo: una venta

1. `ModulePage` abre el formulario configurado para ventas.
2. `ItemsEditor` recoge medicamentos y cantidades.
3. Se arma el cuerpo `{ id_sucursal, metodo_pago, items, ... }`.
4. `api.write('POST', '/ventas', cuerpo, clave)` envía el token y `Idempotency-Key`. Un reintento del mismo cuerpo conserva la clave para evitar duplicados.
5. El backend valida permisos, precio y stock, y guarda todo en una transacción SQL.
6. Si termina bien, React cierra el formulario y consulta de nuevo la tabla. Si falla, muestra el mensaje sin perder los campos.

Las URLs usan fragmentos como `/#inventario`. Esto permite refrescar en un alojamiento estático sin configurar cada ruta en el servidor. No recarga toda la aplicación al cambiar de pantalla.

La sesión se guarda en `sessionStorage` de la pestaña; no se guarda la contraseña. Se renueva al vencer el token. **Salir de esta pestaña** borra sus tokens locales; no revoca otras sesiones abiertas en Supabase.

## 5. Publicar para visualizarlo en línea

Deben estar publicados **React y el backend**. Tanto el catálogo público como el panel interno consultan la API; una API que sigue en tu computadora no estará disponible para los visitantes.

### Frontend en Vercel

1. Sube el repositorio a GitHub sin `.env`, contraseñas ni `node_modules`.
2. Importa el repositorio como un proyecto para la interfaz.
3. Configura **Root Directory: `frontend`**, **Framework: Vite**, **Install: `npm install`**, **Build: `npm run build`**, **Output Directory: `dist`**. Incluí `frontend/vercel.json` para framework, build y salida.
4. Añade `VITE_API_URL=https://TU-BACKEND/api`, sustituyendo por tu API real. No uses `localhost` en producción.
5. Publica y copia la URL del frontend.
6. Añade esa URL exacta a `CORS_ORIGINS` del backend y vuelve a desplegar/reiniciar Node.
7. Si cambias `VITE_API_URL`, vuelve a desplegar React; la dirección queda incluida al construir.

Si alojas ambos en Vercel serán **dos proyectos** del mismo repositorio: backend con raíz principal y frontend con raíz `frontend`. El backend necesita las variables privadas, tablas y permisos del README principal. No copies esas variables al proyecto frontend. La entrega prepara los archivos; no publica automáticamente en una cuenta externa.

Referencias oficiales: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [variables de entorno](https://vercel.com/docs/environment-variables), [despliegue de Vite](https://vite.dev/guide/static-deploy.html).

### Hosting estático o servidor propio

Configura `frontend/.env` con la URL HTTPS de Node y, desde `site`, ejecuta:

```powershell
npm.cmd run ui:build
```

Se genera **`frontend/dist`**. Sube **su contenido** al directorio público del dominio: `index.html`, `assets/` y el favicon. Ese hosting no necesita Node para servir React. El backend sí necesita un alojamiento que ejecute Node, con HTTPS y configuración privada. Configura CORS con el dominio del frontend.

Esta configuración publica en la raíz del dominio. Si necesitas una subcarpeta, cambia `base` en `vite.config.js` y vuelve a construir. `vite preview` es para revisar la compilación local, no para producción:

```powershell
npm.cmd run preview --prefix frontend
```

Abre **http://localhost:4173**; para datos reales permite también ese origen en el CORS del backend. En Linux/macOS utiliza `npm` en lugar de `npm.cmd`.

## 6. Ejecutar las pruebas

Desde `site`:

```powershell
npm.cmd test
npm.cmd run ui:test
npm.cmd run ui:build
```

Para los recorridos de navegador instala Chromium una vez y luego ejecuta Playwright:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright-browsers'
npx.cmd --prefix frontend playwright install chromium
npm.cmd run test:e2e --prefix frontend
```

Las unitarias comprueban tokens, renovación, permisos visuales, formularios, fechas, reintentos y CSV. Las E2E levantan React y una API con PostgreSQL temporal/PGlite, usando migraciones y seeder reales. Auth se simula únicamente en `tests/ui-server.js`; el usuario `admin@example.com` / `test-password` **no funciona en el servidor normal**. No se modifica tu Supabase remoto. Las capturas quedan en `frontend/test-results`.

## 7. Resolver problemas comunes

| Problema | Qué revisar |
| --- | --- |
| No abre 5173 | Ejecuta `npm.cmd run ui`; comprueba si el puerto está ocupado. |
| Error de red | Node encendido, `VITE_API_URL` correcto y CORS. |
| Funciona catálogo pero no login | Credenciales y perfil empresarial activo. |
| Perfil pendiente/403 | Perfil activo, rol, sucursal y migraciones. |
| No hay tablas | Ejecuta migraciones en el proyecto correcto; React no las crea. |
| En línea intenta localhost | Corrige la variable y vuelve a construir/desplegar. |
| Cambió stock/precio al confirmar | El backend valida las condiciones actuales; consulta de nuevo. |

Las pruebas locales no certifican la conectividad de tu Supabase remoto. Para operación empresarial a gran escala siguen pendientes pruebas de carga, respaldos y observabilidad como explica el README del backend.
