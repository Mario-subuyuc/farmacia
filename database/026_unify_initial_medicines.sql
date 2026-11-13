begin;
select pg_advisory_xact_lock(7062099);
lock table public.medicamentos,public.inventario,public.stock_minimos,
 public.detalle_compra,public.detalle_pedido,public.detalle_venta,
 public.detalle_traslado,public.alertas_inventario in share row exclusive mode;

-- Solo los códigos del conjunto inicial: no agrupa productos arbitrarios por nombre.
create temporary table unificar_medicamentos on commit drop as
with candidatos as (
 select m.*,substring(codigo from 'MED-[A-Z0-9]+-01$') codigo_global
 from public.medicamentos m
 where codigo ~ '^((GUA01|MIX01|XELA01|PET01|JUT01)-)?MED-(PARA500|IBU400|LORA10|OME20|SUERO|CETI10|VITC500|ANTI120|LOSA50|SALB100)-01$'
)
select id_medicamento anterior,codigo codigo_anterior,codigo_global,
 first_value(id_medicamento) over(partition by codigo_global order by (codigo=codigo_global) desc,id_medicamento) definitivo
from candidatos;

do $$ begin
 if exists(select 1 from unificar_medicamentos u join public.medicamentos m on m.id_medicamento=u.anterior
  group by u.definitivo having count(distinct (m.principio_activo,m.categoria,m.precio_compra,m.precio_venta,m.requiere_receta,m.estado,m.imagen_url))>1)
 then raise exception 'Existen diferencias de producto o precio; revisar antes de unificar'; end if;
 if exists(select 1 from unificar_medicamentos u join public.medicamentos m on m.id_medicamento=u.anterior
  where m.descuento_porcentaje>0 group by u.definitivo
  having count(distinct (m.descuento_porcentaje,m.promocion_titulo,m.promocion_desde,m.promocion_hasta))>1)
 then raise exception 'Existen promociones diferentes; revisar antes de unificar'; end if;
 if exists(select 1 from public.inventario i left join unificar_medicamentos u on u.anterior=i.id_medicamento
  group by i.id_sucursal,coalesce(u.definitivo,i.id_medicamento),i.lote having count(*)>1)
 then raise exception 'Existen lotes coincidentes; revisar antes de unificar'; end if;
 if exists(select 1 from public.stock_minimos s left join unificar_medicamentos u on u.anterior=s.id_medicamento
  group by s.id_sucursal,coalesce(u.definitivo,s.id_medicamento) having count(*)>1)
 then raise exception 'Existen mínimos coincidentes; revisar antes de unificar'; end if;
 if exists(select 1 from public.detalle_compra d left join unificar_medicamentos u on u.anterior=d.id_medicamento
  group by d.id_compra,coalesce(u.definitivo,d.id_medicamento) having count(*)>1)
 then raise exception 'Existen líneas de compra coincidentes; revisar antes de unificar'; end if;
end $$;

create temporary table inventario_antes_unificar on commit drop as select * from public.inventario;
create temporary table promociones_antes_unificar on commit drop as
select distinct on (u.definitivo) u.definitivo,m.descuento_porcentaje,m.promocion_titulo,m.promocion_desde,m.promocion_hasta
from unificar_medicamentos u join public.medicamentos m on m.id_medicamento=u.anterior
where m.descuento_porcentaje>0 order by u.definitivo,m.id_medicamento;

update public.inventario t set id_medicamento=u.definitivo from unificar_medicamentos u where t.id_medicamento=u.anterior and u.anterior<>u.definitivo;
update public.stock_minimos t set id_medicamento=u.definitivo from unificar_medicamentos u where t.id_medicamento=u.anterior and u.anterior<>u.definitivo;
update public.detalle_pedido t set id_medicamento=u.definitivo from unificar_medicamentos u where t.id_medicamento=u.anterior and u.anterior<>u.definitivo;
update public.detalle_venta t set id_medicamento=u.definitivo from unificar_medicamentos u where t.id_medicamento=u.anterior and u.anterior<>u.definitivo;
update public.detalle_traslado t set id_medicamento=u.definitivo from unificar_medicamentos u where t.id_medicamento=u.anterior and u.anterior<>u.definitivo;
update public.detalle_compra t set id_medicamento=u.definitivo from unificar_medicamentos u where t.id_medicamento=u.anterior and u.anterior<>u.definitivo;
update public.alertas_inventario t set id_medicamento=u.definitivo from unificar_medicamentos u where t.id_medicamento=u.anterior and u.anterior<>u.definitivo;

delete from public.medicamentos m using unificar_medicamentos u where m.id_medicamento=u.anterior and u.anterior<>u.definitivo;
update public.medicamentos m set codigo=u.codigo_global,
 nombre=regexp_replace(m.nombre,'[[:space:]]*·[[:space:]]*(GUA01|MIX01|XELA01|PET01|JUT01)$','')
from unificar_medicamentos u where m.id_medicamento=u.definitivo and u.anterior=u.definitivo;
update public.medicamentos m set descuento_porcentaje=p.descuento_porcentaje,promocion_titulo=p.promocion_titulo,
 promocion_desde=p.promocion_desde,promocion_hasta=p.promocion_hasta
from promociones_antes_unificar p where m.id_medicamento=p.definitivo;

do $$ begin
 if exists(
  (select to_jsonb(i)-'id_medicamento' from public.inventario i except select to_jsonb(i)-'id_medicamento' from inventario_antes_unificar i)
  union all
  (select to_jsonb(i)-'id_medicamento' from inventario_antes_unificar i except select to_jsonb(i)-'id_medicamento' from public.inventario i)
 ) then raise exception 'Cambió el inventario durante la unificación'; end if;
end $$;
select public.generar_alertas_inventario();
commit;
