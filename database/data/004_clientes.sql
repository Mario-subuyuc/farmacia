-- Clientes ficticios agrupados por código de sucursal. No crea pedidos ni ventas.
begin;
do $$ begin
 if (select count(*) from public.sucursales where codigo in ('GUA01','MIX01','XELA01','PET01','JUT01'))<>5 then
  raise exception 'Se requieren las cinco sucursales iniciales';
 end if;
end $$;

with personas(sucursal,numero,nombre,apellido) as (values
 ('GUA01',1,'Claudia','Rosales'),('GUA01',2,'Esteban','Navarro'),
 ('GUA01',3,'Beatriz','Salazar'),('GUA01',4,'Roberto','Carrillo'),
 ('MIX01',1,'Alejandra','Monterroso'),('MIX01',2,'Manuel','Chacon'),
 ('MIX01',3,'Diana','Barrios'),('MIX01',4,'Hector','Palacios'),
 ('XELA01',1,'Mariana','Cifuentes'),('XELA01',2,'Sergio','Velasquez'),
 ('XELA01',3,'Veronica','Calderon'),('XELA01',4,'Alberto','Mazariegos'),
 ('PET01',1,'Carolina','Arana'),('PET01',2,'Javier','Cordon'),
 ('PET01',3,'Lorena','Montenegro'),('PET01',4,'Ernesto','Figueroa'),
 ('JUT01',1,'Adriana','Lemus'),('JUT01',2,'Francisco','Acevedo'),
 ('JUT01',3,'Silvia','Sandoval'),('JUT01',4,'Raul','Valenzuela')
)
insert into public.clientes(codigo,nombre,apellido,telefono,email,direccion)
select p.sucursal||'-CLIENTE-'||lpad(p.numero::text,2,'0'),p.nombre,p.apellido,
 '0000'||lpad((row_number() over(order by p.sucursal,p.numero))::text,4,'0'),
 lower(p.sucursal)||'-cliente-'||lpad(p.numero::text,2,'0')||'@example.com',
 'Dirección ficticia de prueba '||lpad(p.numero::text,2,'0')||' · Referencia: '||s.nombre||', '||s.departamento
from personas p join public.sucursales s on s.codigo=p.sucursal
on conflict(codigo) do nothing;

do $$ begin
 if (select count(*) from public.clientes where codigo ~ '^(GUA01|MIX01|XELA01|PET01|JUT01)-CLIENTE-0[1-4]$')<>20 then
  raise exception 'No se completó la carga de los veinte clientes esperados';
 end if;
end $$;
commit;
