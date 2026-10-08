# Mi primera API con Node, Express y Supabase

Este proyecto permite registrar usuarios e iniciar sesión. Por ahora contiene solo el backend; todavía no hay una aplicación de React.

Node ejecuta JavaScript en el servidor. Express recibe las peticiones HTTP. Supabase Auth guarda los usuarios y comprueba sus contraseñas.

## Iniciar el proyecto

1. Ejecuta `npm install`.
2. Si no tienes `.env`, copia `.env.example` a `.env` y completa la URL y la clave publicable de Supabase. Conserva tu `.env` si ya está configurado.
3. Habilita la autenticación por correo en Supabase y configura la confirmación de correo y las URL de redirección para tu aplicación.
4. Ejecuta `npm run dev`. Nodemon reinicia el servidor cuando guardas cambios. Usa `npm start` para ejecutarlo sin reinicios automáticos.

El puerto por defecto es `3000`. Las rutas actuales son POST: abrir `http://localhost:3000` en el navegador no ejecuta el registro ni el inicio de sesión.

## Qué hace cada archivo

| Archivo | Responsabilidad |
| --- | --- |
| `src/index.js` | Inicia el servidor. |
| `src/app.js` | Configura Express, la lectura de JSON y las rutas. |
| `src/config/config.js` | Lee `.env` y valida la configuración. |
| `src/config/database.js` | Crea el cliente para hablar con Supabase. |
| `src/routes/auth.routes.js` | Conecta cada URL con su controlador. |
| `src/controllers/auth.controller.js` | Lee y valida los datos, llama al modelo y responde. |
| `src/models/user.model.js` | Registra usuarios e inicia sesión usando Supabase. |
| `src/views/auth.view.js` | Selecciona los datos que se devolverán como JSON. |

## Cómo usamos MVC

- **Modelo:** trabaja con los datos. Aquí llama a Supabase Auth.
- **Vista:** prepara lo que recibe el cliente. Aquí son datos JSON, no HTML.
- **Controlador:** coordina la petición, las validaciones y la respuesta.

Las rutas deciden qué controlador ejecutar. El modelo no envía respuestas HTTP y la vista no consulta Supabase. El controlador usa ambos.

```text
Petición → Ruta → Controlador → Modelo → Supabase
                     ↑                    |
                     └──── resultado ─────┘
                     |
                     ↓
                    Vista → Respuesta JSON
```

Si hay un error o falta confirmar el correo, el controlador responde directamente con un mensaje.

## Ejemplo: registrar un usuario

Envía una petición con Postman u otro cliente HTTP:

```http
POST http://localhost:3000/api/register
Content-Type: application/json
```

```json
{
  "username": "mario",
  "email": "mario@example.com",
  "password": "una-clave-larga"
}
```

1. `app.js` convierte el JSON en `req.body` y pasa la petición a las rutas `/api`.
2. La ruta `/register` ejecuta `register` del controlador.
3. El controlador comprueba el nombre (3 a 50 caracteres), el correo y la contraseña (al menos 8 caracteres). Quita espacios del nombre y correo; deja la contraseña tal cual.
4. `User.register()` llama a `supabase.auth.signUp()`. Supabase también aplica la política de contraseñas configurada en tu proyecto.
5. Si Supabase devuelve una sesión, la vista prepara los datos y el controlador responde con `201`, `message`, `user` y `session`.
6. Si no hay sesión, responde con `202` y `session: null`. Puede ser necesario confirmar el correo. El mensaje es genérico para no revelar cuentas existentes.

Supabase administra las contraseñas. `username` se guarda en `user_metadata` como información adicional; esos datos no sirven para decidir roles o permisos. No necesitas crear una tabla propia para estas dos operaciones.

## Ejemplo: iniciar sesión

```http
POST http://localhost:3000/api/login
Content-Type: application/json
```

```json
{
  "email": "mario@example.com",
  "password": "una-clave-larga"
}
```

El recorrido es el mismo, pero el modelo usa `signInWithPassword()`. Si todo va bien, recibes `200`, `message`, `user` y `session`. Si las credenciales son incorrectas o el correo no está confirmado, recibes `401`.

## JavaScript que encontrarás

- `import` trae funciones o valores de otro archivo; `export` permite usarlos fuera.
- `const` crea una variable que no se puede reasignar.
- `function` declara un bloque de código que puedes ejecutar.
- `async` permite usar `await` para esperar operaciones como una llamada a Supabase.
- `req` contiene la petición; `req.body` contiene los datos enviados.
- `res.status(200).json(...)` envía un código HTTP y una respuesta JSON.
- `return` termina la función. Después de responder, evita que siga ejecutándose.
- `try/catch` permite responder si ocurre un error inesperado.
- `trim()` quita espacios de los extremos; `toLowerCase()` convierte a minúsculas.
- `const { data, error } = resultado` extrae esas dos propiedades de un objeto.
- `{ email, password }` abrevia `{ email: email, password: password }`.
- `error.code ?? error.name` usa `error.name` si `error.code` es `null` o `undefined`.

La expresión regular en `validEmail()` comprueba un formato básico de correo: `texto@texto.texto`, sin espacios. No necesitas memorizarla para entender el recorrido de la aplicación.

## Códigos de respuesta

| Código | Significado en esta API |
| --- | --- |
| `200` | Inicio de sesión correcto. |
| `201` | Registro correcto con sesión. |
| `202` | Solicitud recibida, sin sesión todavía. |
| `400` | Datos inválidos u otro error de autenticación del cliente. |
| `401` | Credenciales incorrectas o correo sin confirmar. |
| `429` | Demasiados intentos. |
| `500` | Error inesperado en nuestro servidor. |
| `503` | Servicio de autenticación no disponible. |

## Dónde entraría React

React sería la interfaz: formularios, botones y mensajes. Al enviar un formulario, haría una petición a esta API y mostraría la respuesta. Por ejemplo, si el frontend está servido desde el mismo origen que la API:

```js
async function iniciarSesion(email, password) {
  const respuesta = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.message);
  }

  return datos;
}
```

Este ejemplo explica la conexión; todavía no existe un frontend en el proyecto. Si React se ejecuta en otro puerto, habrá que configurar un proxy de desarrollo o CORS.

La sesión incluye tokens: el de acceso identifica la sesión y el de renovación sirve para obtener nuevos tokens. El cliente debe gestionar la sesión. Esta API todavía no incluye renovación, cierre de sesión ni rutas protegidas. El backend crea un cliente de Supabase por operación para no compartir sesiones entre usuarios.

Para estudiar el proyecto, sigue este orden: `index.js`, `app.js`, las rutas, el controlador, el modelo y la vista. Después revisa la configuración.
