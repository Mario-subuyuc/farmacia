export const CART_KEY = 'nexo-farma-cart-v1';
export function normalizeCart(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.filter(item => {
    if (!Number.isSafeInteger(item?.id_medicamento) || item.id_medicamento < 1 || ids.has(item.id_medicamento) || typeof item.nombre !== 'string' || !Number.isFinite(Number(item.precio_venta)) || Number(item.precio_venta) <= 0 || !Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 99) return false;
    ids.add(item.id_medicamento); return true;
  }).slice(0, 50);
}
export function readCart() {
  try { return normalizeCart(JSON.parse(localStorage.getItem(CART_KEY))); } catch { return []; }
}
export function cartTotal(items) {
  return items.reduce((sum, item) => sum + Math.round(Number(item.precio_venta) * 100) * item.cantidad, 0) / 100;
}
export function addToCart(items, product) {
  const old = items.find(item => item.id_medicamento === product.id_medicamento);
  if (old) return items.map(item => item === old ? { ...item, precio_venta: product.precio_venta, cantidad: Math.min(99, item.cantidad + 1) } : item);
  if (items.length >= 50) return items;
  return [...items, { id_medicamento: product.id_medicamento, nombre: product.nombre, precio_venta: product.precio_venta, imagen_url: product.imagen_url, requiere_receta: product.requiere_receta, cantidad: 1 }];
}
