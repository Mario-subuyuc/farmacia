import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase,asUser,accounts,operation} from './database-helper.js';

test('empleados se vinculan a cuentas sin automatizar nómina ni confundir acceso con estado laboral', async t => {
 const db=await testDatabase();t.after(()=>db.close());
 const employee=(await db.query("insert into empleados(codigo,id_sucursal,nombre,apellido,puesto,salario,id_usuario) values('PRUEBA-EMP',1,'Persona','Prueba','Vendedor',4500,$1) returning id_empleado",[accounts.vendor])).rows[0];
 await assert.rejects(db.query("insert into empleados(codigo,id_sucursal,nombre,apellido,puesto,salario,id_usuario) values('DUPLICADO',1,'Otra','Persona','Vendedor',4500,$1)",[accounts.vendor]),/unique/);
 await assert.rejects(db.query('update empleados set id_sucursal=2 where id_empleado=$1',[employee.id_empleado]),/misma sucursal/);
 await assert.rejects(asUser(db,'manager',()=>db.query("insert into empleados(codigo,id_sucursal,nombre,apellido,puesto,salario,id_usuario) values('ADMIN-INVALIDO',1,'Persona','Prueba','Gerente',7000,$1)",[accounts.admin])),/misma sucursal/);
 const visible=await asUser(db,'manager',()=>db.query('select * from cuentas_empleados'));
 assert.ok(visible.rows.every(row=>Number(row.id_sucursal)===1));
 assert.equal((await asUser(db,'warehouse',()=>db.query('select * from cuentas_empleados'))).rows.length,0);
 assert.equal((await db.query('select count(*)::int n from planillas')).rows[0].n,0);
 await db.query('update perfiles set activo=false where id_usuario=$1',[accounts.vendor]);
 const result=await asUser(db,'admin',()=>operation(db,'planilla',{id_sucursal:1,periodo:'2030-01-01'}));
 const detail=(await db.query('select salario_base from detalle_planilla where id_planilla=$1 and id_empleado=$2',[result.id_planilla,employee.id_empleado])).rows[0];
 assert.equal(Number(detail.salario_base),4500);
 await db.query('delete from perfiles where id_usuario=$1',[accounts.vendor]);
 assert.equal((await db.query('select id_usuario from empleados where id_empleado=$1',[employee.id_empleado])).rows[0].id_usuario,null);
});
