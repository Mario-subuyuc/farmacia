# API de autenticación con Supabase

Backend de Express con registro e inicio de sesión mediante Supabase Auth.

## Arquitectura MVC para una API

Flujo: petición HTTP → ruta → controlador → modelo → Supabase Auth.
El controlador utiliza la vista para dar formato a la respuesta JSON.

- `src/index.js`: inicia el servidor.
- `src/app.js`: configura Express, middleware y rutas.
- `src/config/config.js`: carga y valida las variables de entorno.
- `src/config/database.js`: crea clientes de Supabase sin persistir sesiones en el servidor.
- `src/routes/auth.routes.js`: relaciona las URL con los controladores.
- `src/controllers/auth.controller.js`: valida entradas y decide respuestas y estados HTTP.
- `src/models/user.model.js`: encapsula las operaciones de usuarios en Supabase Auth.
- `src/views/auth.view.js`: selecciona los campos públicos de usuario y sesión.

La vista aquí es una representación JSON; no hay páginas HTML ni frontend.
El modelo no necesita un esquema de Mongoose: Supabase Auth administra los usuarios
en su esquema `auth` y se encarga de las contraseñas. `username` se guarda en
`user_metadata`. Estos metadatos no deben usarse para roles o permisos.
No se necesita crear una tabla propia para el registro e inicio de sesión actuales.
Si agregas datos de negocio, crea tablas y políticas RLS y accede a ellas desde modelos.

## Ejecutar

1. Instala las dependencias con `npm install`.
2. Copia `.env.example` a `.env` si todavía no existe y completa la URL y la clave
   publicable de tu proyecto Supabase. No sobrescribas una configuración existente.
3. En Supabase, habilita la autenticación por correo y configura la confirmación
   de correo y las URL de redirección según tu aplicación.
4. Ejecuta `npm run dev` para desarrollo o `npm start` para iniciar sin nodemon.

## Endpoints

Envía `Content-Type: application/json`.

### `POST /api/register`

```json
{ "username": "mario", "email": "mario@example.com", "password": "una-clave-larga" }
```

Requiere un nombre de 3 a 50 caracteres, correo válido y contraseña de al menos
8 caracteres. Supabase también aplica la política de contraseñas del proyecto.
Devuelve `201` con usuario y sesión si se inicia sesión inmediatamente, o `202`
con `session: null` cuando no se recibe sesión, por ejemplo si requiere confirmar
el correo. La respuesta es genérica para evitar revelar cuentas existentes.

### `POST /api/login`

```json
{ "email": "mario@example.com", "password": "una-clave-larga" }
```

Devuelve `200` con usuario y sesión; credenciales incorrectas o correo sin
confirmar devuelven `401`. Ambas rutas conservan las validaciones y el manejo de
errores de Supabase (`400`, `429`, `503`) y errores inesperados (`500`).

El cliente que consume la API debe gestionar los tokens recibidos. Este proyecto
todavía no incluye renovación de sesiones, cierre de sesión ni rutas protegidas.

## Migración

Se reemplazó el modelo residual de Mongoose por operaciones de Supabase Auth y se
eliminó `src/config.js`, que estaba vacío. Las dependencias ya no incluían MongoDB
ni Mongoose. Esto adapta el código; no importa usuarios o datos de una base antigua.

Referencias: [registro](https://supabase.com/docs/reference/javascript/auth-signup),
[inicio de sesión](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).
