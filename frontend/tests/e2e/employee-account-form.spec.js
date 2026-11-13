import {test,expect} from '@playwright/test';

test('empleado vincula cuenta y salario manual sin generar planilla', async ({page,request})=>{
 await page.goto('/#login');
 await page.getByLabel('Correo electrónico').fill('admin@example.com');
 await page.getByLabel('Contraseña',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 await page.getByLabel('Buscar módulo').fill('empleados');
 await page.getByRole('navigation').getByRole('button',{name:'Empleados',exact:true}).click();
 await page.getByRole('button',{name:'Crear empleado',exact:true}).click();
 const form=page.getByRole('dialog');
 await form.getByLabel('Código',{exact:false}).fill('EMP-MANUAL');
 await form.getByLabel('Sucursal',{exact:false}).selectOption('1');
 await form.getByLabel('Nombre',{exact:false}).fill('Empleado manual');
 await form.getByLabel('Apellido',{exact:false}).fill('De prueba');
 await form.getByLabel('Usuario vinculado',{exact:false}).selectOption('33333333-3333-4333-8333-333333333333');
 await form.getByLabel('Puesto',{exact:false}).fill('Vendedor de farmacia');
 await form.getByLabel('Salario base mensual',{exact:false}).fill('4500');
 await form.getByRole('button',{name:/Guardar|Crear/}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const result=await request.get('http://127.0.0.1:3010/api/empleados',{headers:{Authorization:'Bearer test-admin'}});
 expect(result.ok()).toBeTruthy();
 const employee=(await result.json()).data.find(row=>row.codigo==='EMP-MANUAL');
 expect(employee.id_usuario).toBe('33333333-3333-4333-8333-333333333333');
 expect(Number(employee.salario)).toBe(4500);
 const payroll=await request.get('http://127.0.0.1:3010/api/planillas',{headers:{Authorization:'Bearer test-admin'}});
 expect((await payroll.json()).data).toHaveLength(0);
});
