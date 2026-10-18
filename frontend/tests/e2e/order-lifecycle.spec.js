import { test, expect } from '@playwright/test';
const API='http://127.0.0.1:3010/api';
const headers={Authorization:'Bearer test-admin'};
async function checkout(page,name,{recipe=false,cupon=''}={}){
 await page.goto('/#catalogo');
 await page.locator('.product-card').filter({has:page.getByRole('heading',{name,exact:true})}).getByRole('button',{name:'Agregar al carrito'}).click();
 await page.getByRole('button',{name:'Carrito (1)'}).click();await page.getByRole('button',{name:'Continuar con el pago'}).click();
 for(const [key,value] of Object.entries({nombre:'Cliente',apellido:'E2E',telefono:'55550101',email:'test@example.invalid',direccion_entrega:'Zona 1, Guatemala',latitud:'14.6407',longitud:'-90.5133'}))await page.locator(`[name="${key}"]`).fill(value);
 await page.getByRole('button',{name:'Buscar sucursales con mis productos'}).click();await expect(page.locator('[name="id_sucursal"] option').nth(1)).toBeAttached();await page.locator('[name="id_sucursal"]').selectOption('1');
 if(cupon)await page.locator('[name="cupon"]').fill(cupon);
 if(recipe){await page.locator('input[type="file"]').setInputFiles({name:'receta-prueba.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMs8AAAAASUVORK5CYII=','base64')});await expect(page.getByText(/Receta cargada en almacenamiento privado/)).toBeVisible();}
 await page.getByRole('button',{name:'Revisar total',exact:true}).click();await expect(page.getByRole('heading',{name:'Revisa tu total antes de confirmar'})).toBeVisible();
 const response=page.waitForResponse(r=>r.url().endsWith('/tienda/pedidos')&&r.request().method()==='POST');await page.getByRole('button',{name:'Confirmar pedido',exact:true}).click();const result=await (await response).json();
 await expect(page.getByRole('heading',{name:'Pedido confirmado #'+result.data.id_pedido})).toBeVisible();return result;
}
test('compra con receta, revisión, cobro y entrega reales en SQL local',async({page,request})=>{
 const receipt=await checkout(page,'Amoxicilina 500 mg',{recipe:true});const id=receipt.data.id_pedido;
 const blocked=await request.patch(API+'/pedidos/'+id+'/estado',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{estado:'PREPARANDO'}});expect(blocked.status()).toBe(409);
 expect((await request.get(API+'/pedidos/'+id+'/receta',{headers})).ok()).toBeTruthy();
 expect((await request.post(API+'/pedidos/'+id+'/gestion',{headers,data:{accion:'receta',estado:'APROBADA'}})).ok()).toBeTruthy();
 expect((await request.patch(API+'/pedidos/'+id+'/estado',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{estado:'PREPARANDO'}})).ok()).toBeTruthy();
 expect((await request.patch(API+'/pedidos/'+id+'/estado',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{estado:'EN_CAMINO',repartidor:'Repartidor E2E'}})).ok()).toBeTruthy();
 expect((await request.post(API+'/pedidos/'+id+'/gestion',{headers,data:{accion:'pago',estado:'PAGADO',referencia:'EFECTIVO-E2E'}})).ok()).toBeTruthy();
 await page.getByRole('button',{name:'Actualizar estado'}).click();await expect(page.getByText('Estado: Entregado',{exact:true})).toBeVisible();
 const tracking=await (await request.post(API+'/tienda/seguimiento',{data:{token:receipt.token}})).json();expect(tracking.data.estado_pago).toBe('PAGADO');expect(tracking.data.receta_path).toBeUndefined();
 await page.getByRole('button',{name:'Cerrar ventana'}).click();await page.getByRole('button',{name:'Seguir mi pedido',exact:true}).click();await expect(page.getByText('Mis compras en este navegador (1)')).toBeVisible();
});
test('cupón, cancelación con liberación y contenido editable',async({page,request})=>{
 const codigo='E2E-'+Date.now();expect((await request.post(API+'/cupones',{headers,data:{codigo,porcentaje:25,max_usos:1}})).ok()).toBeTruthy();
 const receipt=await checkout(page,'Paracetamol 500 mg',{cupon:codigo});expect(receipt.data.total).toBe(Math.round(receipt.data.subtotal*75)/100);
 await page.getByRole('button',{name:'Cancelar pedido',exact:true}).click();await page.getByRole('button',{name:'Confirmar cancelación'}).click();await expect(page.getByText('Estado: Cancelado',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cerrar ventana'}).click();const content=await(await request.get(API+'/contenidos',{headers})).json();const mission=content.data.find(row=>row.tipo==='MISION');
 expect((await request.patch(API+'/contenidos/'+mission.id_contenido,{headers,data:{cuerpo:'Misión actualizada desde el panel para la prueba de integración.'}})).ok()).toBeTruthy();
 await page.goto('/#farmacia/nosotros');await expect(page.getByText('Misión actualizada desde el panel para la prueba de integración.')).toBeVisible();
});
