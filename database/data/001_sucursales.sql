-- Carga manual inicial: solo sucursales. No ejecutar db:seed.
-- Las ubicaciones nuevas son referencias de ciudad; confirmar dirección y
-- coordenadas del local antes de utilizar rutas o distancias de entrega.
begin;

update public.sucursales set
 nombre=case codigo when 'GUA01' then 'Farmacia Guatemala'
                    when 'MIX01' then 'Farmacia Mixco'
                    when 'XELA01' then 'Farmacia Xela' end,
 tipo='FARMACIA', estado='ACTIVA',
 apertura='00:00:00', cierre='23:59:59', dias_entrega='1,2,3,4,5,6,7'
where codigo in ('GUA01','MIX01','XELA01');

insert into public.sucursales
 (codigo,nombre,departamento,direccion,telefono,tipo,estado,latitud,longitud,apertura,cierre,dias_entrega)
values
 ('PET01','Farmacia Petén','Petén',
  'Ubicación de referencia: Flores, Petén. Dirección del local pendiente de confirmar.',
  null,'FARMACIA','ACTIVA',16.9300,-89.8900,'06:00:00','18:00:00','1,2,3,4,5'),
 ('JUT01','Farmacia Jutiapa','Jutiapa',
  'Ubicación de referencia: Jutiapa. Dirección del local pendiente de confirmar.',
  null,'FARMACIA','ACTIVA',14.2900,-89.9000,'06:00:00','18:00:00','6,7')
on conflict(codigo) do update set
 nombre=excluded.nombre,departamento=excluded.departamento,
 tipo=excluded.tipo,estado=excluded.estado,
 apertura=excluded.apertura,cierre=excluded.cierre,dias_entrega=excluded.dias_entrega;

commit;
