import { Router } from 'express';
import { resources } from '../config/resources.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as Catalog from '../controllers/catalog.controller.js';
import * as Operation from '../controllers/operation.controller.js';

// authMiddleware se puede sustituir SOLO al crear la app para tests locales.
export function businessRoutes(authMiddleware = authenticate) {
  const router = Router();
  router.use(authMiddleware);
  router.get('/me', function (req, res) { res.json({ data: req.profile }); });

  // Cada fila conecta una ruta con una operación de negocio de PostgreSQL.
  const routes = [
    ['post', '/inventario/entradas', 'entrada', null, 201],
    ['post', '/inventario/:id/ajustes', 'ajuste', 'id_inventario', 201],
    ['post', '/ventas', 'venta', null, 201],
    ['post', '/ventas/:id/anular', 'anular_venta', 'id_venta', 200],
    ['post', '/traslados', 'traslado', null, 201],
    ['post', '/traslados/:id/recibir', 'recibir_traslado', 'id_traslado', 200],
    ['post', '/pedidos', 'pedido', null, 201],
    ['patch', '/pedidos/:id/estado', 'estado_pedido', 'id_pedido', 200],
    ['post', '/pedidos/:id/reasignar', 'reasignar_pedido', 'id_pedido', 200],
    ['post', '/movimientos-caja', 'caja', null, 201],
    ['post', '/movimientos-caja/:id/revertir', 'revertir_caja', 'id_movimiento', 201],
    ['post', '/planillas', 'planilla', null, 201],
  ];
  for (const [method, path, action, id, status] of routes) {
    router[method](path, function (req, res, next) {
      req.operation = action;
      req.operationId = id;
      req.operationStatus = status;
      next();
    }, Operation.execute);
  }
  router.post('/disponibilidad', authorize(['ADMIN', 'GERENTE', 'VENDEDOR', 'CALL_CENTER']), Operation.availability);
  router.get('/reportes/resumen', authorize(['ADMIN', 'GERENTE', 'AUDITOR']), Operation.report);

  const details = { ventas: 'detalle_venta', pedidos: 'detalle_pedido', traslados: 'detalle_traslado', planillas: 'detalle_planilla' };
  for (const [name, resource] of Object.entries(resources)) {
    const setResource = function (req, res, next) { req.resource = resource; next(); };
    router.get(`/${name}`, setResource, authorize(resource.read), Catalog.index);
    router.get(`/${name}/:id`, setResource, authorize(resource.read), Catalog.show);
    if (details[name]) {
      router.get(`/${name}/:id/detalles`, setResource, authorize(resource.read), function (req, res, next) {
        req.detailTable = details[name]; next();
      }, Catalog.details);
    }
    if (resource.write) {
      router.post(`/${name}`, setResource, authorize(resource.write), Catalog.store);
      router.patch(`/${name}/:id`, setResource, authorize(resource.write), Catalog.update);
    }
  }
  return router;
}
