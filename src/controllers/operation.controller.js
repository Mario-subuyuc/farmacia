import * as Operation from '../models/operation.model.js';
import { validateOperation } from '../services/operation-validation.js';
import { recordView } from '../views/api.view.js';
import { httpError } from '../utils/http-error.js';
import { positiveId, uuid } from '../utils/validation.js';

export async function execute(req, res) {
  const key = req.get('Idempotency-Key');
  if (!uuid(key)) throw httpError(400, 'Envía Idempotency-Key con un UUID único para esta operación.');
  const body = req.body === undefined ? {} : req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'Envía un objeto JSON.');
  const data = { ...body };
  if (req.operationId) {
    if (data[req.operationId] !== undefined) throw httpError(400, 'El identificador se envía en la URL.');
    data[req.operationId] = positiveId(req.params.id);
  }
  const clean = validateOperation(req.operation, data);
  const result = await Operation.runOperation(req.supabase, req.operation, clean, key);
  res.status(req.operationStatus).json(recordView(result));
}

export async function availability(req, res) {
  const data = validateOperation('disponibilidad', req.body);
  const result = await Operation.availability(req.supabase, data);
  res.json(recordView(result));
}

export async function report(req, res) {
  for (const key of Object.keys(req.query)) if (!['desde', 'hasta', 'id_sucursal'].includes(key)) throw httpError(400, `Filtro no permitido: ${key}.`);
  const from = req.query.desde;
  const to = req.query.hasta;
  const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
  if (typeof from !== 'string' || typeof to !== 'string' || !isoDate.test(from) || !isoDate.test(to)
    || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) {
    throw httpError(400, 'Envía desde y hasta como fechas ISO con zona horaria; desde debe ser menor que hasta.');
  }
  const branch = req.query.id_sucursal ? positiveId(req.query.id_sucursal, 'id_sucursal') : null;
  const result = await Operation.companyReport(req.supabase, from, to, branch);
  res.json(recordView(result));
}
