begin;
-- Solo el backend puede invocar estas operaciones; el cat?logo sigue an?nimo y de lectura.
create table privado.pedidos_portal (
 clave uuid primary key, token_hash text not null unique,
 solicitud jsonb not null, id_pedido bigint unique references public.pedidos,
 respuesta jsonb, creado_en timestamptz not null default now()
);
revoke all on privado.pedidos_portal from public,anon,authenticated;
create function privado.pedido_portal(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare suc public.sucursales; item jsonb; v_total numeric; v_id bigint; distancia numeric; minutos integer; precio numeric;
begin
  select * into suc from public.sucursales where id_sucursal=(p->>'id_sucursal')::bigint;
  perform privado.sucursal_activa(suc.id_sucursal);
  if not suc.acepta_pedidos then raise exception 'Sucursal no acepta pedidos' using errcode='P0001'; end if;
  if coalesce(trim(p->>'direccion_entrega'),'')='' or p->>'latitud' is null or p->>'longitud' is null
    or (p->>'latitud')::numeric not between -90 and 90 or (p->>'longitud')::numeric not between -180 and 180 then
    raise exception 'Dirección y coordenadas válidas son obligatorias' using errcode='22023';
  end if;
  distancia := privado.distancia((p->>'latitud')::numeric,(p->>'longitud')::numeric,suc.latitud,suc.longitud);
  if distancia>suc.radio_entrega_km then raise exception 'Dirección fuera del radio de entrega' using errcode='P0001'; end if;
  minutos := suc.preparacion_minutos+ceil(distancia/suc.velocidad_kmh*60)::integer;
  perform privado.bloquear_stock(suc.id_sucursal);
  v_total := privado.validar_items(p->'items',p->>'receta_referencia');
  insert into public.pedidos(id_cliente,id_sucursal,direccion_entrega,latitud,longitud,metodo_pago,canal,total,
    tiempo_estimado_minutos,entrega_estimada,receta_referencia,creado_por)
  values((p->>'id_cliente')::bigint,suc.id_sucursal,p->>'direccion_entrega',(p->>'latitud')::numeric,(p->>'longitud')::numeric,
    p->>'metodo_pago',p->>'canal',v_total,minutos,now()+make_interval(mins=>minutos),p->>'receta_referencia',auth.uid()) returning id_pedido into v_id;
  for item in select value from jsonb_array_elements(p->'items') loop
    select precio_venta into precio from public.medicamentos where id_medicamento=(item->>'id_medicamento')::bigint;
    insert into public.detalle_pedido(id_pedido,id_medicamento,cantidad,precio_unitario)
      values(v_id,(item->>'id_medicamento')::bigint,(item->>'cantidad')::integer,precio);
    perform privado.usar_stock(suc.id_sucursal,(item->>'id_medicamento')::bigint,(item->>'cantidad')::integer,null,v_id);
  end loop;
  return jsonb_build_object('id_pedido',v_id,'total',v_total,'tiempo_estimado_minutos',minutos,'estado','PENDIENTE');
end; $$;


revoke all on function privado.pedido_portal(jsonb) from public,anon,authenticated;
create function public.crear_pedido_portal(p_datos jsonb,p_clave uuid,p_token_hash text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare anterior privado.pedidos_portal; cliente bigint; resultado jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 select * into anterior from privado.pedidos_portal where clave=p_clave;
 if found then
   if anterior.solicitud<>p_datos or anterior.token_hash<>p_token_hash then
     raise exception 'La clave ya corresponde a otro pedido' using errcode='P0001';
   end if;
   return anterior.respuesta;
 end if;
 if exists(select 1 from jsonb_array_elements(p_datos->'items') i join public.medicamentos m
   on m.id_medicamento=(i->>'id_medicamento')::bigint where m.requiere_receta) then
   raise exception 'Los medicamentos con receta requieren validaci?n del personal. Solic?talos directamente en la farmacia.' using errcode='P0001';
 end if;
 insert into public.clientes(codigo,nombre,apellido,telefono,direccion)
 values('WEB-'||substr(replace(p_clave::text,'-',''),1,24),p_datos->>'nombre',p_datos->>'apellido',p_datos->>'telefono',p_datos->>'direccion_entrega') returning id_cliente into cliente;
 resultado := privado.pedido_portal(p_datos||jsonb_build_object('id_cliente',cliente,'canal','PORTAL'));
 insert into privado.pedidos_portal(clave,token_hash,solicitud,id_pedido,respuesta)
 values(p_clave,p_token_hash,p_datos,(resultado->>'id_pedido')::bigint,resultado);
 return resultado;
end $$;
revoke all on function public.crear_pedido_portal(jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.crear_pedido_portal(jsonb,uuid,text) to service_role;
create function public.seguir_pedido_portal(p_token_hash text) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('id_pedido',p.id_pedido,'estado',p.estado,'total',p.total,
   'metodo_pago',p.metodo_pago,'entrega_estimada',p.entrega_estimada,'entregado_en',p.entregado_en,
   'sucursal',s.nombre,'telefono_sucursal',s.telefono,
   'items',(select jsonb_agg(jsonb_build_object('nombre',m.nombre,'cantidad',d.cantidad,'precio_unitario',d.precio_unitario))
      from public.detalle_pedido d join public.medicamentos m using(id_medicamento) where d.id_pedido=p.id_pedido))
 from privado.pedidos_portal portal join public.pedidos p using(id_pedido)
 join public.sucursales s using(id_sucursal) where portal.token_hash=p_token_hash;
$$;
revoke all on function public.seguir_pedido_portal(text) from public,anon,authenticated;
grant execute on function public.seguir_pedido_portal(text) to service_role;
commit;
