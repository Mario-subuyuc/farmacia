-- Datos ficticios de referencia, salarios base mensuales. No genera pagos.
begin;
create temporary table carga_empleados(codigo_sucursal text,rol text,usuario text,nombre text,apellido text,puesto text,salario numeric) on commit drop;
insert into carga_empleados values
 ('GUA01','GERENTE','gerente-gua01','Ana','Lopez','Gerente de sucursal','7000'),
 ('GUA01','VENDEDOR','vendedor-gua01','Luis','Garcia','Vendedor de farmacia','4500'),
 ('GUA01','BODEGA','bodega-gua01','Pedro','Hernandez','Auxiliar de bodega','4200'),
 ('GUA01','CAJERO','cajero-gua01','Maria','Perez','Cajero','4300'),
 ('GUA01','CALL_CENTER','callcenter-gua01','Sofia','Ramirez','Agente de call center','4500'),
 ('GUA01','AUDITOR','auditor-gua01','Diego','Castillo','Auditor operativo','6500'),
 ('MIX01','GERENTE','gerente-mix01','Carlos','Morales','Gerente de sucursal','7000'),
 ('MIX01','VENDEDOR','vendedor-mix01','Andrea','Ruiz','Vendedor de farmacia','4500'),
 ('MIX01','BODEGA','bodega-mix01','Jose','Mendoza','Auxiliar de bodega','4200'),
 ('MIX01','CAJERO','cajero-mix01','Daniela','Soto','Cajero','4300'),
 ('MIX01','CALL_CENTER','callcenter-mix01','Pablo','Reyes','Agente de call center','4500'),
 ('MIX01','AUDITOR','auditor-mix01','Valeria','Aguilar','Auditor operativo','6500'),
 ('XELA01','GERENTE','gerente-xela01','Jorge','Cabrera','Gerente de sucursal','7000'),
 ('XELA01','VENDEDOR','vendedor-xela01','Paola','Vasquez','Vendedor de farmacia','4500'),
 ('XELA01','BODEGA','bodega-xela01','Miguel','Leon','Auxiliar de bodega','4200'),
 ('XELA01','CAJERO','cajero-xela01','Gabriela','Ortega','Cajero','4300'),
 ('XELA01','CALL_CENTER','callcenter-xela01','Oscar','Fuentes','Agente de call center','4500'),
 ('XELA01','AUDITOR','auditor-xela01','Lucia','Maldonado','Auditor operativo','6500'),
 ('PET01','GERENTE','gerente-pet01','Rosa','Mejia','Gerente de sucursal','7000'),
 ('PET01','VENDEDOR','vendedor-pet01','Marco','Orellana','Vendedor de farmacia','4500'),
 ('PET01','BODEGA','bodega-pet01','Elena','Sanchez','Auxiliar de bodega','4200'),
 ('PET01','CAJERO','cajero-pet01','Victor','Alvarado','Cajero','4300'),
 ('PET01','CALL_CENTER','callcenter-pet01','Natalia','Gomez','Agente de call center','4500'),
 ('PET01','AUDITOR','auditor-pet01','Ricardo','Estrada','Auditor operativo','6500'),
 ('JUT01','GERENTE','gerente-jut01','Fernando','Pineda','Gerente de sucursal','7000'),
 ('JUT01','VENDEDOR','vendedor-jut01','Camila','Juarez','Vendedor de farmacia','4500'),
 ('JUT01','BODEGA','bodega-jut01','Mario','Escobar','Auxiliar de bodega','4200'),
 ('JUT01','CAJERO','cajero-jut01','Isabel','Ramos','Cajero','4300'),
 ('JUT01','CALL_CENTER','callcenter-jut01','Adrian','Cruz','Agente de call center','4500'),
 ('JUT01','AUDITOR','auditor-jut01','Patricia','Solorzano','Auditor operativo','6500');
do $$ begin
 if (select count(*) from carga_empleados c join public.sucursales s on s.codigo=c.codigo_sucursal join auth.users u on u.raw_user_meta_data->>'username'=c.usuario join public.perfiles p on p.id_usuario=u.id and p.rol=c.rol and p.id_sucursal=s.id_sucursal)<>30 then raise exception 'Se requieren las 30 cuentas y sucursales acordadas'; end if;
end $$;
insert into public.empleados(codigo,id_sucursal,nombre,apellido,puesto,salario,estado,id_usuario)
select 'EMP-'||upper(c.usuario),s.id_sucursal,c.nombre,c.apellido,c.puesto,c.salario,'ACTIVO',u.id
from carga_empleados c join public.sucursales s on s.codigo=c.codigo_sucursal join auth.users u on u.raw_user_meta_data->>'username'=c.usuario join public.perfiles p on p.id_usuario=u.id and p.rol=c.rol and p.id_sucursal=s.id_sucursal
on conflict(codigo) do nothing;
commit;
