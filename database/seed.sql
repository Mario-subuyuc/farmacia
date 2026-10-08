-- Datos ficticios. No crea cuentas Auth ni borra información existente.
-- Repetible: los códigos DEMO y las claves naturales evitan duplicados.
begin;
select pg_advisory_xact_lock(7062026);

insert into public.sucursales(codigo,nombre,departamento,direccion,telefono,tipo,latitud,longitud,radio_entrega_km)
values
 ('DEMO-GUA','Farmacia Demo Guatemala','Guatemala','Centro comercial demo zona 1','5555-0101','FARMACIA',14.6407,-90.5133,15),
 ('DEMO-MIX','Farmacia Demo Mixco','Guatemala','Centro comercial demo Mixco','5555-0102','FARMACIA',14.6333,-90.6000,15),
 ('DEMO-XELA','Stand Demo Xela','Quetzaltenango','Gasolinera demo Xela','5555-0103','STAND',14.8347,-91.5181,10)
on conflict(codigo) do nothing;

insert into public.medicamentos(codigo,nombre,descripcion,categoria,principio_activo,precio_compra,precio_venta,requiere_receta)
values
 ('DEMO-PARA','Paracetamol 500 mg','Caja de prueba','ANALGESICO','Paracetamol',5,10,false),
 ('DEMO-AMOX','Amoxicilina 500 mg','Caja de prueba con receta','ANTIBIOTICO','Amoxicilina',15,25,true),
 ('DEMO-SUERO','Suero oral','Sobre de prueba','HIDRATACION','Sales de rehidratación',2,5,false)
on conflict(codigo) do nothing;

insert into public.empleados(codigo,id_sucursal,nombre,apellido,puesto,salario)
select 'DEMO-EMP-'||s.codigo,s.id_sucursal,'Empleado','Demo','ENCARGADO',4000
from public.sucursales s where s.codigo like 'DEMO-%' order by s.id_sucursal on conflict(codigo) do nothing;

insert into public.clientes(codigo,nombre,apellido,telefono,email,direccion)
values ('DEMO-CLI','Ana','Prueba','5555-0200','ana@example.com','Dirección ficticia zona 1')
on conflict(codigo) do nothing;

insert into public.activos(codigo,id_sucursal,nombre,descripcion,valor,valor_residual,vida_util_meses,fecha_adquisicion)
select 'DEMO-PC-'||s.codigo,s.id_sucursal,'Computadora demo','Activo de prueba',6000,600,60,current_date-interval '6 months'
from public.sucursales s where s.codigo like 'DEMO-%' on conflict(codigo) do nothing;

with nuevos as (
  insert into public.inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad)
  select s.id_sucursal,m.id_medicamento,'DEMO-LOTE-A',current_date+180,m.precio_compra,100
  from public.sucursales s cross join public.medicamentos m
  where s.codigo like 'DEMO-%' and m.codigo like 'DEMO-%'
  order by s.id_sucursal,m.id_medicamento
  on conflict(id_sucursal,id_medicamento,lote) do nothing returning *
)
insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo)
select id_inventario,id_sucursal,'ENTRADA',cantidad,'Carga inicial DEMO' from nuevos;

with nuevos as (
  insert into public.inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad)
  select s.id_sucursal,m.id_medicamento,'DEMO-LOTE-B',current_date+365,m.precio_compra,50
  from public.sucursales s cross join public.medicamentos m
  where s.codigo='DEMO-GUA' and m.codigo='DEMO-PARA'
  on conflict(id_sucursal,id_medicamento,lote) do nothing returning *
)
insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo)
select id_inventario,id_sucursal,'ENTRADA',cantidad,'Carga inicial DEMO' from nuevos;

insert into public.stock_minimos(id_sucursal,id_medicamento,stock_minimo)
select s.id_sucursal,m.id_medicamento,20 from public.sucursales s cross join public.medicamentos m
where s.codigo like 'DEMO-%' and m.codigo like 'DEMO-%'
on conflict(id_sucursal,id_medicamento) do nothing;

insert into public.movimientos_caja(id_sucursal,tipo,concepto,monto,metodo_pago)
select s.id_sucursal,'INGRESO','Apertura DEMO',500,'EFECTIVO' from public.sucursales s
where s.codigo like 'DEMO-%' and not exists(select 1 from public.movimientos_caja c
  where c.id_sucursal=s.id_sucursal and c.concepto='Apertura DEMO');
commit;
