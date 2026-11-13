-- Activos ficticios: importes, fechas y vidas útiles son datos de referencia.
-- Carga manual independiente de las migraciones y del seeder demo anterior.
begin;
do $$ begin
 if (select count(*) from public.sucursales where codigo in ('GUA01','MIX01','XELA01','PET01','JUT01'))<>5 then
  raise exception 'Se requieren las cinco sucursales iniciales';
 end if;
end $$;

with tipos(tipo,nombre,cantidad,valor,vida_util_meses) as (values
 ('SILLA','Silla',3,350.00,60),
 ('COMPUTADORA','Computadora',2,4500.00,36),
 ('POS','Equipo POS',2,1800.00,60),
 ('MOSTRADOR','Mostrador',2,3500.00,120),
 ('REFRIGERADOR','Refrigerador',2,6000.00,96),
 ('ESTANTERIA','Estantería',4,1500.00,120)
)
insert into public.activos(codigo,id_sucursal,nombre,descripcion,valor,valor_residual,vida_util_meses,fecha_adquisicion,estado)
select s.codigo||'-'||t.tipo||'-'||lpad(n.numero::text,2,'0'),s.id_sucursal,
 t.nombre||' '||lpad(n.numero::text,2,'0')||' · '||s.codigo,
 'Activo ficticio de referencia para '||s.nombre||'. Valor y fecha de adquisición simulados; confirmar antes de uso contable real.',
 t.valor,round(t.valor*0.10,2),t.vida_util_meses,date '2026-11-13','ACTIVO'
from public.sucursales s cross join tipos t cross join lateral generate_series(1,t.cantidad) n(numero)
where s.codigo in ('GUA01','MIX01','XELA01','PET01','JUT01')
on conflict(codigo) do nothing;

do $$ begin
 if (select count(*) from public.activos a join public.sucursales s using(id_sucursal)
     where a.codigo ~ ('^'||s.codigo||'-(SILLA-0[1-3]|COMPUTADORA-0[1-2]|POS-0[1-2]|MOSTRADOR-0[1-2]|REFRIGERADOR-0[1-2]|ESTANTERIA-0[1-4])$')
       and s.codigo in ('GUA01','MIX01','XELA01','PET01','JUT01'))<>75 then
  raise exception 'No se completó la carga de los 75 activos esperados';
 end if;
end $$;
commit;
