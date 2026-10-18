import Account from '../models/account.model.js';
import { httpError } from '../utils/http-error.js';

export async function createAccount(req, res) {
  res.set('Cache-Control', 'no-store');
  const { username, email, password, rol, id_sucursal = null, activo = true } = req.body || {};
  const roles = ['ADMIN', 'GERENTE', 'VENDEDOR', 'BODEGA', 'CAJERO', 'CALL_CENTER', 'AUDITOR'];
  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 50) throw httpError(400, 'El nombre debe tener entre 3 y 50 caracteres.');
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw httpError(400, 'Ingresa un correo válido.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw httpError(400, 'La contraseña debe tener entre 8 y 128 caracteres.');
  if (!roles.includes(rol) || typeof activo !== 'boolean') throw httpError(400, 'Rol o estado de acceso inválido.');
  if (id_sucursal !== null && (!Number.isSafeInteger(id_sucursal) || id_sucursal < 1)) throw httpError(400, 'Sucursal inválida.');
  if (['GERENTE', 'VENDEDOR', 'BODEGA', 'CAJERO'].includes(rol) && !id_sucursal) throw httpError(400, 'Este rol necesita una sucursal.');
  if (id_sucursal) {
    const branch = await req.supabase.from('sucursales').select('id_sucursal').eq('id_sucursal', id_sucursal).maybeSingle();
    if (branch.error || !branch.data) throw httpError(400, 'Selecciona una sucursal existente.');
  }
  const data = await Account.create(req.supabase, { username: username.trim(), email: email.trim().toLowerCase(), password, rol, id_sucursal, activo });
  res.status(201).json({ data });
}
