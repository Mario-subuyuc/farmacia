-- Proveedores ficticios de referencia. No crea compras ni movimientos de caja.
begin;
lock table public.proveedores in share row exclusive mode;
do $$ begin
 if (select count(*) from public.sucursales where codigo in ('GUA01','MIX01','XELA01','PET01','JUT01'))<>5 then
  raise exception 'Se requieren las cinco sucursales iniciales';
 end if;
end $$;

with tipos(numero,empresa,contacto) as (values
 (1,'Distribuidora Salud Integral','Patricia Aguilar'),
 (2,'Suministros Farma Norte','Andres Molina'),
 (3,'Droguería Bienestar','Cecilia Guzman'),
 (4,'Distribuidora Medisalud','Rodrigo Herrera')
), nuevos as (
 select s.codigo||'-PROVEEDOR-'||lpad(t.numero::text,2,'0')||' · '||t.empresa nombre,
 t.contacto,lower(s.codigo)||'-proveedor-'||lpad(t.numero::text,2,'0')||'@example.com' email,
 '0000'||lpad((row_number() over(order by s.codigo,t.numero))::text,4,'0') telefono,
 'Dirección ficticia de prueba '||lpad(t.numero::text,2,'0')||' · Referencia: '||s.nombre||', '||s.departamento direccion
 from public.sucursales s cross join tipos t
 where s.codigo in ('GUA01','MIX01','XELA01','PET01','JUT01')
)
insert into public.proveedores(nombre,contacto,email,telefono,direccion,activo)
select n.nombre,n.contacto,n.email,n.telefono,n.direccion,true
from nuevos n where not exists(select 1 from public.proveedores p where p.nombre=n.nombre);

do $$ begin
 if (select count(*) from public.proveedores where nombre ~ '^(GUA01|MIX01|XELA01|PET01|JUT01)-PROVEEDOR-0[1-4] · ')<>20 then
  raise exception 'No se completó la carga de los veinte proveedores esperados';
 end if;
end $$;
commit;
