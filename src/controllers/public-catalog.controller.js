import PublicCatalog from '../models/public-catalog.model.js';
import { httpError, databaseError } from '../utils/http-error.js';

export async function publicCatalog(req, res) {
  const { q = '', id_sucursal, categoria, page = '1', limit = '12' } = req.query;
  if (typeof q !== 'string' || q.length > 100 || (categoria !== undefined && (typeof categoria !== 'string' || categoria.length > 100))) throw httpError(400, 'Búsqueda o categoría inválida.');
  function integer(value, max) {
    if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw httpError(400, 'Filtro o página inválidos.');
    return Number(value);
  }
  const { data, error } = await PublicCatalog.list({ p_busqueda: q.trim(), p_sucursal: id_sucursal ? integer(id_sucursal, Number.MAX_SAFE_INTEGER) : null,
    p_categoria: categoria || null, p_pagina: integer(page, 10000), p_limite: integer(limit, 48) });
  if (error) throw databaseError(error);
  res.set('Cache-Control', 'no-store').json(data);
}
