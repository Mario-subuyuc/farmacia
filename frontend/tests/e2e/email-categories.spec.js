import {test,expect} from '@playwright/test';
test('vista previa cambia con la categoría y aplica el fondo',async({page})=>{
 await page.goto('/#login');
 await page.getByLabel('Correo electrónico').fill('admin@example.com');
 await page.getByLabel('Contraseña',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Diseño de correos',exact:true}).click();
 const preview=page.frameLocator('iframe');
 for(const [label,title] of [['ALERTA','Es momento de reponer inventario'],['PEDIDO','Tu pedido está confirmado'],['EVENTO','Tu inscripción está confirmada'],['GENERAL','Información de tu farmacia']]){
  await page.getByLabel('Tipo de correo').selectOption({label});
  await expect(preview.getByRole('heading',{level:1})).toHaveText(title);
 }
 await page.getByLabel('Fondo',{exact:true}).fill('#ddeeff');
 await expect(preview.locator('body')).toHaveCSS('background-color','rgb(221, 238, 255)');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
