import { httpError } from './http-error.js';

export function positiveId(value, name = 'id') {
  const number = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(number) || number < 1) {
    throw httpError(400, `${name} debe ser un entero positivo.`);
  }
  return number;
}

export function uuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// La regla de cada campo está en config/resources.js. No aceptamos columnas inesperadas.
export function validateFields(body, fields, required = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Envía un objeto JSON.');
  const clean = {};
  for (const name of required) {
    if (body[name] === undefined || body[name] === null) throw httpError(400, `${name} es obligatorio.`);
  }
  for (const [name, value] of Object.entries(body)) {
    const rule = fields[name];
    if (!rule) throw httpError(400, `Campo no permitido: ${name}.`);
    if (value === null && rule.nullable) { clean[name] = null; continue; }
    let valid = false;
    let result = value;
    if (rule.type === 'text') {
      valid = typeof value === 'string' && value.trim().length > 0 && value.trim().length <= rule.max;
      if (valid) result = value.trim();
    }
    if (rule.type === 'number') {
      valid = typeof value === 'number' && Number.isFinite(value) && value >= rule.min && value <= rule.max;
      if (rule.integer) valid = valid && Number.isSafeInteger(value);
      if (rule.money) valid = valid && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
    }
    if (rule.type === 'boolean') valid = typeof value === 'boolean';
    if (rule.type === 'date') valid = validDate(value);
    if (rule.type === 'uuid') valid = uuid(value);
    if (rule.type === 'enum') valid = rule.values.includes(value);
    if (rule.type === 'array') valid = Array.isArray(value) && value.length <= rule.max;
    if (!valid) throw httpError(400, `${name} tiene un valor inválido.`);
    clean[name] = result;
  }
  return clean;
}

export function pagination(query) {
  const page = positiveId(query.page || 1, 'page');
  const limit = positiveId(query.limit || 25, 'limit');
  if (limit > 100 || page > 100000) throw httpError(400, 'limit máximo: 100; page máximo: 100000.');
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}
