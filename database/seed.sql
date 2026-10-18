-- Datos ficticios. No crea cuentas Auth ni borra información existente.
-- Repetible: los códigos DEMO y las claves naturales evitan duplicados.
begin;
select pg_advisory_xact_lock(7062026);

-- Catalogo compartido: 12 productos y stocks por sucursal (migracion 004).
select privado.cargar_catalogo_demo();

insert into public.empleados(codigo,id_sucursal,nombre,apellido,puesto,salario)
select 'DEMO-EMP-'||s.codigo,s.id_sucursal,'Empleado','Demo','ENCARGADO',4000
from public.sucursales s where s.codigo like 'DEMO-%' order by s.id_sucursal on conflict(codigo) do nothing;

insert into public.clientes(codigo,nombre,apellido,telefono,email,direccion)
values ('DEMO-CLI','Ana','Prueba','5555-0200','ana@example.com','Dirección ficticia zona 1')
on conflict(codigo) do nothing;

insert into public.activos(codigo,id_sucursal,nombre,descripcion,valor,valor_residual,vida_util_meses,fecha_adquisicion)
select 'DEMO-PC-'||s.codigo,s.id_sucursal,'Computadora demo','Activo de prueba',6000,600,60,current_date-interval '6 months'
from public.sucursales s where s.codigo like 'DEMO-%' on conflict(codigo) do nothing;

insert into public.movimientos_caja(id_sucursal,tipo,concepto,monto,metodo_pago)
select s.id_sucursal,'INGRESO','Apertura DEMO',500,'EFECTIVO' from public.sucursales s
where s.codigo like 'DEMO-%' and not exists(select 1 from public.movimientos_caja c
  where c.id_sucursal=s.id_sucursal and c.concepto='Apertura DEMO');
commit;
