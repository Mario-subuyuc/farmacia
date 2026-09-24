import User from '../models/user.model.js';
import { publicUser, publicSession } from '../views/auth.view.js';

const validEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const authError = (res, error, fallbackMessage) => {
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
};

export const register = async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    const { username, email, password } = req.body ?? {};

    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        message: 'username, email y password son obligatorios.',
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 50) {
      return res.status(400).json({
        message: 'El nombre debe tener entre 3 y 50 caracteres.',
      });
    }

    if (!validEmail(cleanEmail)) {
      return res.status(400).json({
        message: 'Ingresa un correo válido.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 8 caracteres.',
      });
    }

    const { data, error } = await User.register({
      username: cleanUsername,
      email: cleanEmail,
      password,
    });

    if (error) {
      return authError(
        res,
        error,
        'No se pudo completar el registro. Revisa los datos y los requisitos de contraseña.'
      );
    }

    // Con confirmación de correo, no hay sesión todavía.
    // Respuesta genérica para no revelar si un correo ya existe.
    if (!data.session) {
      return res.status(202).json({
        message:
          'Solicitud recibida. Revisa tu correo para confirmar el registro. Si ya tienes cuenta, inicia sesión.',
        session: null,
      });
    }

    return res.status(201).json({
      message: 'Usuario registrado correctamente.',
      user: publicUser(data.user),
      session: publicSession(data.session),
    });
  } catch {
    console.error('Error inesperado durante el registro.');

    return res.status(500).json({
      message: 'Error interno del servidor.',
    });
  }
};

export const login = async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    const { email, password } = req.body ?? {};

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

    const { data, error } = await User.login({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      if (
        error.code === 'invalid_credentials' ||
        error.code === 'email_not_confirmed'
      ) {
        return res.status(401).json({
          message:
            'No se pudo iniciar sesión. Revisa tus credenciales y confirma tu correo.',
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
};