begin;
alter table public.medicamentos
  add column descuento_porcentaje numeric(5,2) not null default 0 check(descuento_porcentaje between 0 and 90),
  add column promocion_titulo varchar(100),
  add column promocion_desde date,
  add column promocion_hasta date,
  add constraint promocion_fechas check(promocion_desde is null or promocion_hasta is null or promocion_desde<=promocion_hasta);
create function public.normalizar_busqueda(valor text) returns text language sql immutable parallel safe
set search_path=pg_catalog as $$
 select trim(regexp_replace(translate(lower(coalesce(valor,'')),'áéíóúüñàèìòùâêîôûäëïö','aeiouunaeiouaeiouaeio'),'[^a-z0-9]+',' ','g'));
$$;
create function public.precio_catalogo(m public.medicamentos) returns numeric language sql stable
set search_path=pg_catalog,public as $$
 select case when m.descuento_porcentaje>0
   and (m.promocion_desde is null or m.promocion_desde <= (now() at time zone 'America/Guatemala')::date)
   and (m.promocion_hasta is null or m.promocion_hasta >= (now() at time zone 'America/Guatemala')::date)
 then greatest(0.01,round(m.precio_venta*(1-m.descuento_porcentaje/100),2)) else m.precio_venta end;
$$;
-- Reutiliza los flujos transaccionales existentes, cambiando solo el cálculo de precio.
do $migration$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='privado' and p.proname in ('validar_items','usar_stock','pedido','pedido_portal'))
 or (n.nspname='public' and p.proname='consultar_disponibilidad') loop
  definition := pg_get_functiondef(f.oid);
  definition := replace(definition,'medicamento.precio_venta','public.precio_catalogo(medicamento)');
  definition := replace(definition,'m.precio_venta','public.precio_catalogo(m)');
  definition := replace(definition,'select precio_venta into precio from public.medicamentos','select public.precio_catalogo(medicamentos) into precio from public.medicamentos');
  execute definition;
 end loop;
end $migration$;
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
      public.precio_catalogo(m) as precio_venta,m.precio_venta as precio_regular,
      case when public.precio_catalogo(m)<m.precio_venta then m.descuento_porcentaje else 0 end as descuento_aplicado,
      case when public.precio_catalogo(m)<m.precio_venta then m.promocion_titulo else null end as promocion_titulo,
      case when public.precio_catalogo(m)<m.precio_venta then m.promocion_hasta else null end as promocion_hasta,
      m.requiere_receta,m.imagen_url,
      coalesce((select jsonb_agg(jsonb_build_object('id_sucursal',d.id_sucursal,
        'nombre',d.nombre,'departamento',d.departamento,'direccion',d.direccion,'telefono',d.telefono)
        order by d.nombre) from disponibles d where d.id_medicamento=m.id_medicamento
        and (p_sucursal is null or d.id_sucursal=p_sucursal)), '[]'::jsonb) as sucursales
    from public.medicamentos m where m.estado='ACTIVO'
      and (p_busqueda='' or not exists(select 1 from unnest(string_to_array(public.normalizar_busqueda(p_busqueda),' ')) term
        where term<>'' and strpos(public.normalizar_busqueda(m.nombre||' '||m.principio_activo||' '||m.categoria||' '||coalesce(m.descripcion,'')),term)=0))
      and p_busqueda !~ '[;''=]'
      and (p_categoria is null or m.categoria=p_categoria)
      and (p_sucursal is null or exists(select 1 from disponibles d where d.id_medicamento=m.id_medicamento and d.id_sucursal=p_sucursal))
  ), pagina as (
    select * from productos order by nombre,id_medicamento limit p_limite offset (p_pagina-1)*p_limite
  ) select jsonb_build_object(
    'data',coalesce((select jsonb_agg(to_jsonb(p) order by p.nombre,p.id_medicamento) from pagina p),'[]'::jsonb),
    'promociones',coalesce((select jsonb_agg(to_jsonb(p) order by p.descuento_aplicado desc,p.nombre) from productos p where p.descuento_aplicado>0),'[]'::jsonb),
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
