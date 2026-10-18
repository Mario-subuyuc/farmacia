-- Catálogo de solo lectura. No concede acceso anónimo a las tablas internas.
begin;
create or replace function public.catalogo_publico(
  p_busqueda text default '', p_sucursal bigint default null,
  p_categoria text default null, p_pagina integer default 1, p_limite integer default 12
) returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, public as $$
declare respuesta jsonb;
begin
  if p_pagina < 1 or p_pagina > 10000 or p_limite < 1 or p_limite > 48
    or length(p_busqueda) > 100 or (p_sucursal is not null and p_sucursal < 1) then
    raise exception 'Filtros de catálogo inválidos' using errcode='22023';
  end if;
  with disponibles as (
    select i.id_medicamento, s.id_sucursal, s.nombre, s.departamento, s.direccion, s.telefono
    from public.inventario i join public.sucursales s using(id_sucursal)
    where s.estado='ACTIVA'
      and i.fecha_vencimiento > (now() at time zone 'America/Guatemala')::date
    group by i.id_medicamento,s.id_sucursal
    having sum(i.cantidad-i.reservado)>0
  ), productos as (
    select m.id_medicamento,m.nombre,m.descripcion,m.categoria,m.principio_activo,
      m.precio_venta,m.requiere_receta,
      coalesce((select jsonb_agg(jsonb_build_object('id_sucursal',d.id_sucursal,
        'nombre',d.nombre,'departamento',d.departamento,'direccion',d.direccion,'telefono',d.telefono)
        order by d.nombre) from disponibles d where d.id_medicamento=m.id_medicamento
        and (p_sucursal is null or d.id_sucursal=p_sucursal)), '[]'::jsonb) as sucursales
    from public.medicamentos m where m.estado='ACTIVO'
      and (p_busqueda='' or strpos(lower(m.nombre||' '||m.principio_activo||' '||coalesce(m.descripcion,'')),lower(p_busqueda))>0)
      and (p_categoria is null or m.categoria=p_categoria)
      and (p_sucursal is null or exists(select 1 from disponibles d where d.id_medicamento=m.id_medicamento and d.id_sucursal=p_sucursal))
  ), pagina as (
    select * from productos order by nombre,id_medicamento limit p_limite offset (p_pagina-1)*p_limite
  ) select jsonb_build_object(
    'data',coalesce((select jsonb_agg(to_jsonb(p) order by p.nombre,p.id_medicamento) from pagina p),'[]'::jsonb),
    'pagination',jsonb_build_object('page',p_pagina,'limit',p_limite,'total',(select count(*) from productos)),
    'sucursales',coalesce((select jsonb_agg(jsonb_build_object('id_sucursal',s.id_sucursal,'nombre',s.nombre,
      'departamento',s.departamento,'direccion',s.direccion,'telefono',s.telefono) order by s.nombre)
      from public.sucursales s where s.estado='ACTIVA'),'[]'::jsonb),
    'categorias',coalesce((select jsonb_agg(c.categoria order by c.categoria)
      from (select distinct categoria from public.medicamentos where estado='ACTIVO') c),'[]'::jsonb)
  ) into respuesta;
  return respuesta;
end $$;
revoke all on function public.catalogo_publico(text,bigint,text,integer,integer) from public;
grant execute on function public.catalogo_publico(text,bigint,text,integer,integer) to anon,authenticated;
commit;
