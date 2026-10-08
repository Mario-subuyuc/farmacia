import { CORS_ORIGINS } from '../config/config.js';
import { httpError } from '../utils/http-error.js';

export function securityHeaders(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  const origin = req.get('Origin');
  if (origin) {
    if (!CORS_ORIGINS.includes(origin)) throw httpError(403, 'Origen no permitido por CORS.');
    res.set('Access-Control-Allow-Origin', origin);
    res.vary('Origin');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,Idempotency-Key');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

// Protección básica para login/registro. En varias instancias usar Redis/gateway.
export function authRateLimit() {
  const attempts = new Map();
  const windowMs = 15 * 60 * 1000;
  return function (req, res, next) {
    const now = Date.now();
    for (const [ip, entry] of attempts) {
      if (entry.expires <= now) attempts.delete(ip);
    }
    const ip = req.ip;
    const entry = attempts.get(ip) || { count: 0, expires: now + windowMs };
    entry.count++;
    attempts.set(ip, entry);
    if (entry.count > 20) {
      res.set('Retry-After', String(Math.ceil((entry.expires - now) / 1000)));
      throw httpError(429, 'Demasiados intentos. Intenta nuevamente más tarde.');
    }
    next();
  };
}
