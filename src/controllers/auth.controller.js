import User from '../models/user.model.js';
import { publicUser, publicSession } from '../views/auth.view.js';

// Ambos controladores usan esta función para responder a errores de Supabase.
function authError(res, error, fallbackMessage) {
  // No registrar contraseñas, tokens ni el cuerpo de la petición.
  console.error('Supabase Auth:', error.code ?? error.name);

  if (error.status === 429) {
    return res.status(429).json({
      message: 'Demasiados intentos. Intenta nuevamente más tarde.',
    });
  }

  if (!error.status || error.status >= 500) {
    return res.status(503).json({
      message: 'El servicio de autenticación no está disponible.',
    });
  }

  return res.status(400).json({
    message: fallbackMessage,
  });
}

// req contiene la petición; res permite enviar la respuesta.
export async function login(req, res) {
  res.set('Cache-Control', 'no-store');

  try {
    const body = req.body || {};
    const email = body.email;
    const password = body.password;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'email y password son obligatorios.',
      });
    }

    // await espera el resultado sin bloquear las demás peticiones del servidor.
    const { data, error } = await User.login({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      if (error.code === 'email_not_confirmed') {
        return res.status(401).json({ message: 'Tu correo todavía no está confirmado. Abre el enlace del correo de registro.' });
      }
      if (error.code === 'invalid_credentials') {
        return res.status(401).json({
          message:
            'El correo o la contraseña son incorrectos.',
        });
      }

      return authError(
        res,
        error,
        'No se pudo iniciar sesión.'
      );
    }

    return res.status(200).json({
      message: 'Inicio de sesión correcto.',
      user: publicUser(data.user),
      session: publicSession(data.session),
    });
  } catch {
    console.error('Error inesperado durante el inicio de sesión.');

    return res.status(500).json({
      message: 'Error interno del servidor.',
    });
  }
}

// React puede pedir nuevos tokens cuando la sesión está por vencer.
export async function refresh(req, res) {
  res.set('Cache-Control', 'no-store');
  const token = req.body && req.body.refresh_token;
  if (typeof token !== 'string' || !token.trim() || token.length > 8192) {
    return res.status(400).json({ message: 'refresh_token es obligatorio.' });
  }
  try {
    const { data, error } = await User.refresh(token);
    if (error) {
      if (!error.status || error.status >= 500 || error.status === 429) return authError(res, error, 'No se pudo renovar la sesión.');
      return res.status(401).json({ message: 'La sesión ya no puede renovarse. Inicia sesión nuevamente.' });
    }
    return res.json({ message: 'Sesión renovada.', user: publicUser(data.user), session: publicSession(data.session) });
  } catch {
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
}
