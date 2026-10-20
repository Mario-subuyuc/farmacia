// Carga las variables de .env para leerlas con process.env.
import 'dotenv/config';

export const PORT = Number(process.env.PORT || 3000);

export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map(function (origin) { return origin.trim(); });

// Si falta la configuración, detenemos el inicio con un mensaje claro.
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY en .env'
  );
}

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT debe ser un puerto válido');
}



const smtpVariables = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'ALERT_EMAIL_TO',
  'EMAIL_WORKER_ENABLED',
];

for (const nombre of smtpVariables) {
  const valor = process.env[nombre];

  console.log(
    `[SMTP CONFIG] ${nombre}: ${
      valor?.trim() ? 'CONFIGURADA' : 'FALTA O ESTÁ VACÍA'
    }`
  );
}

console.log('[SMTP CONFIG] Validaciones:', {
  hostGmail: process.env.SMTP_HOST === 'smtp.gmail.com',
  puerto587: process.env.SMTP_PORT === '587',
  secureFalse: process.env.SMTP_SECURE === 'false',
  workerActivado: process.env.EMAIL_WORKER_ENABLED === 'true',
});


if (process.env.SMTP_DIAGNOSTIC_ENABLED === 'true') {
  const { smtpTransport } = await import('../services/email.js');
  const transport = smtpTransport();

  try {
    await transport.verify();
    console.log('[SMTP TEST] Conexión y autenticación correctas');
  } catch (error) {
    console.error('[SMTP TEST] Falló:', {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
    });
  } finally {
    transport.close();
  }
}