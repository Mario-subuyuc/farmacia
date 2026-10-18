import {test,expect} from '@playwright/test';
test('portada corta y páginas públicas independientes con navegación e historial',async({page})=>{
 await page.goto('/#home');await expect(page.getByRole('heading',{level:1})).toContainText('Cuidarte empieza');await expect(page.locator('#home-about')).toHaveCount(0);await expect(page.locator('#home-services')).toHaveCount(0);await expect(page.locator('.fc')).toHaveCount(0);
 const nav=page.getByRole('navigation',{name:'Navegación principal'});
 for(const [name,route,selector] of [['Nosotros','nosotros','#home-about'],['Promociones','promociones','#home-promotions'],['Servicios','servicios','#home-services'],['Programas de salud','programas','#home-programs'],['Actividades','actividades','.fc'],['Sucursales','sucursales','#home-branches'],['Ayuda','ayuda','#home-faq']]){
 await nav.getByRole('link',{name,exact:true}).click();await expect(page).toHaveURL(new RegExp('#farmacia/'+route+'$'));await expect(page.locator(selector)).toBeVisible();await expect(page.locator('.home-hero')).toHaveCount(0);await expect(nav.getByRole('link',{name,exact:true})).toHaveAttribute('aria-current','page');
 }
 await page.reload();await expect(page.locator('#home-faq')).toBeVisible();await page.goBack();await expect(page).toHaveURL(/#farmacia\/sucursales$/);await expect(page.locator('#home-branches')).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await nav.getByRole('link',{name:'Inicio',exact:true}).click();await expect(page.locator('.home-hero')).toBeVisible();
});
