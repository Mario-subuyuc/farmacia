import * as Catalog from '../models/catalog.model.js';
import { recordView, listView } from '../views/api.view.js';
import { positiveId, uuid, pagination, validateFields } from '../utils/validation.js';
import { httpError } from '../utils/http-error.js';

function recordId(resource, value) {
  if (!resource.uuid) return positiveId(value);
  if (!uuid(value)) throw httpError(400, 'id debe ser un UUID.');
  return value;
}

// Las rutas guardan su configuración en req.resource antes de llamar al controlador.
export async function index(req, res) {
  const page = pagination(req.query);
  const filters = {};
  for (const [field, value] of Object.entries(req.query)) {
    if (field === 'page' || field === 'limit') continue;
    if (!req.resource.filters.includes(field) || typeof value !== 'string' || value.length > 255) {
      throw httpError(400, `Filtro no permitido: ${field}.`);
    }
    filters[field] = field.startsWith('id_') ? positiveId(value, field) : value;
    if (field === 'actor' && !uuid(value)) throw httpError(400, 'actor debe ser UUID.');
  }
  const result = await Catalog.listRecords(req.supabase, req.resource, filters, page);
  res.json(listView(result.data, result.count, page));
}

export async function show(req, res) {
  const id = recordId(req.resource, req.params.id);
  const data = await Catalog.findRecord(req.supabase, req.resource, id);
  if (!data) throw httpError(404, 'Registro no encontrado o fuera de tu sucursal.');
  res.json(recordView(data));
}

export async function store(req, res) {
  const data = validateFields(req.body, req.resource.fields, req.resource.required);
  validateCatalog(req.resource.table, data);
  const result = await Catalog.createRecord(req.supabase, req.resource, data);
  res.status(201).json(recordView(result));
}

export async function update(req, res) {
  const id = recordId(req.resource, req.params.id);
  const fields = { ...req.resource.fields };
  delete fields[req.resource.id];
  const data = validateFields(req.body, fields);
  if (!Object.keys(data).length) throw httpError(400, 'Envía al menos un campo para actualizar.');
  validateCatalog(req.resource.table, data);
  const result = await Catalog.updateRecord(req.supabase, req.resource, id, data);
  if (!result) throw httpError(404, 'Registro no encontrado o fuera de tu sucursal.');
  res.json(recordView(result));
}

function validateCatalog(table, data) {
  if (table === 'clientes' && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw httpError(400, 'Correo inválido.');
  if (table === 'activos' && data.valor !== undefined && data.valor_residual > data.valor) throw httpError(400, 'valor_residual no puede superar valor.');
  if (table === 'activos' && data.fecha_adquisicion && new Date(`${data.fecha_adquisicion}T00:00:00Z`) > new Date()) throw httpError(400, 'fecha_adquisicion no puede ser futura.');
}

export async function details(req, res) {
  const id = positiveId(req.params.id);
  const parent = await Catalog.findRecord(req.supabase, req.resource, id);
  if (!parent) throw httpError(404, 'Registro no encontrado o fuera de tu sucursal.');
  const detail = { table: req.detailTable, id: 'id_detalle' };
  const page = pagination(req.query);
  for (const key of Object.keys(req.query)) if (!['page', 'limit'].includes(key)) throw httpError(400, `Filtro no permitido: ${key}.`);
  const result = await Catalog.listRecords(req.supabase, detail, { [req.resource.id]: id }, page);
  res.json(listView(result.data, result.count, page));
}
