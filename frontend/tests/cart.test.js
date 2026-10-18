import test from 'node:test';
import assert from 'node:assert/strict';
import { addToCart, cartTotal, normalizeCart } from '../src/utils/cart.js';
const product = { id_medicamento: 1, nombre: 'Prueba', precio_venta: 0.1 };
test('carrito combina productos, limita cantidades y calcula centavos', () => {
 let cart = addToCart([], product);
 cart = addToCart(cart, product);
 assert.equal(cart.length, 1);
 assert.equal(cart[0].cantidad, 2);
 assert.equal(cartTotal([...cart, { ...product, id_medicamento: 2, precio_venta: 0.2, cantidad: 1 }]), 0.4);
 assert.equal(addToCart([{ ...cart[0], cantidad: 99 }], product)[0].cantidad, 99);
});
test('carrito recuperado descarta datos inválidos y duplicados', () => {
 const valid = { ...product, cantidad: 1 };
 assert.deepEqual(normalizeCart([valid,valid,{...valid,id_medicamento:2,cantidad:-1},{...valid,id_medicamento:3,precio_venta:'abc'}]), [valid]);
 assert.deepEqual(normalizeCart(null), []);
});
