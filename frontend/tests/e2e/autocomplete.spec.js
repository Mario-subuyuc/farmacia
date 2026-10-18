import {test,expect} from '@playwright/test';
test('autocompletado del catálogo con tildes y teclado; selección en asistente',async({page})=>{
 await page.goto('/#catalogo');const input=page.getByRole('combobox').first();await input.fill('PARACETAMÓL');await expect(page.getByRole('option',{name:/Paracetamol 500 mg/})).toBeVisible();await input.press('ArrowDown');await input.press('Enter');await expect(page.locator('.product-card')).toHaveCount(1);await expect(input).toHaveValue('Paracetamol 500 mg');await expect(page.getByRole('listbox')).toHaveCount(0);
 await input.fill('zzznoproducto');await expect(page.getByText(/Sin coincidencias. Prueba otro nombre/)).toBeVisible();await input.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);
 await page.getByRole('button',{name:'Abrir asistente de farmacia'}).click();await page.getByRole('button',{name:'Buscar un medicamento'}).click();await page.locator('#assistant-query').fill('amoxi');await page.getByRole('option',{name:/Amoxicilina 500 mg/}).click();await expect(page.locator('.assistant-product')).toContainText('Amoxicilina 500 mg');
});
