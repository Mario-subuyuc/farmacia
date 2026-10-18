import PublicCatalog from '../models/public-catalog.model.js';
import { normalizeProductQuery } from '../services/product-search.js';
import { validateFields } from '../utils/validation.js';
import { databaseError } from '../utils/http-error.js';
export async function searchProducts(req, res) {
  const body = validateFields(req.body, { consulta:{type:'text',max:100}, categoria:{type:'text',max:100} });
  const query = body.consulta ? normalizeProductQuery(body.consulta) : '';
  if (!query && !body.categoria) return res.json({data:[], necesita_nombre:true});
  const result = await PublicCatalog.list({p_busqueda:query,p_categoria:body.categoria||null,p_pagina:1,p_limite:8});
  if (result.error) throw databaseError(result.error);
  res.json({data:result.data.data,pagination:result.data.pagination,categorias:result.data.categorias,necesita_nombre:false});
}
