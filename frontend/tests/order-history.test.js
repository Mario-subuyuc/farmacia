import test from 'node:test';
import assert from 'node:assert/strict';
import {savedOrders,saveOrder} from '../src/utils/order-history.js';
test('historial conserva códigos distintos, limita a veinte y actualiza el último',()=>{
 const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 for(let i=0;i<25;i++)saveOrder({token:i.toString(16).padStart(64,'0'),data:{id_pedido:i,total:10}});
 assert.equal(savedOrders().length,20);assert.equal(savedOrders()[0].id,24);
 saveOrder({token:'0'.repeat(64),data:{id_pedido:0,total:11}});assert.equal(savedOrders()[0].total,11);assert.equal(savedOrders().length,20);
 assert.equal(values.get('nexo-last-order'),'0'.repeat(64));delete globalThis.localStorage;
});
test('historial vacío si el navegador deniega almacenamiento o contiene datos corruptos',()=>{
 globalThis.localStorage={getItem:()=>{throw Error('denegado');}};assert.deepEqual(savedOrders(),[]);
 globalThis.localStorage={getItem:()=>'{corrupto'};assert.deepEqual(savedOrders(),[]);delete globalThis.localStorage;
});
