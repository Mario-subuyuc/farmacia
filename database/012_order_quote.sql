begin;
create function public.cotizar_pedido_portal(p_datos jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare suc public.sucursales; c public.cupones; monto numeric; rebaja numeric:=0; local_now timestamp:=now() at time zone 'America/Guatemala';
begin
 select * into suc from public.sucursales where id_sucursal=(p_datos->>'id_sucursal')::bigint;
 perform privado.sucursal_activa(suc.id_sucursal);
 if not suc.acepta_pedidos or local_now::time not between suc.apertura and suc.cierre or not extract(isodow from local_now)::int::text=any(string_to_array(suc.dias_entrega,',')) then raise exception 'Sucursal fuera del horario de pedidos' using errcode='P0001';end if;
 if privado.distancia((p_datos->>'latitud')::numeric,(p_datos->>'longitud')::numeric,suc.latitud,suc.longitud)>suc.radio_entrega_km then raise exception 'Dirección fuera del radio de entrega' using errcode='P0001';end if;
 monto:=privado.validar_items(p_datos->'items','CONSULTA');
 if exists(select 1 from jsonb_array_elements(p_datos->'items') i where (select coalesce(sum(cantidad-reservado),0) from public.inventario where id_sucursal=suc.id_sucursal and id_medicamento=(i->>'id_medicamento')::bigint and fecha_vencimiento>current_date)<(i->>'cantidad')::int) then raise exception 'Stock insuficiente para este pedido' using errcode='P0001';end if;
 if coalesce(p_datos->>'cupon','')<>'' then
  select * into c from public.cupones where codigo=p_datos->>'cupon';
  if not found or not c.activo or c.usos>=c.max_usos or monto<c.minimo or (c.desde is not null and c.desde>local_now::date) or (c.hasta is not null and c.hasta<local_now::date) then raise exception 'Cupón inválido, agotado o no aplicable al subtotal' using errcode='P0001';end if;
  rebaja:=round(monto*c.porcentaje/100,2);
 end if;
 return jsonb_build_object('subtotal',monto,'costo_envio',suc.costo_envio,'descuento_cupon',rebaja,'total',monto+suc.costo_envio-rebaja);
end $$;
revoke all on function public.cotizar_pedido_portal(jsonb) from public,anon,authenticated;
grant execute on function public.cotizar_pedido_portal(jsonb) to service_role;
do $$ declare d text;begin
 d:=pg_get_functiondef('public.crear_pedido_portal(jsonb,uuid,text)'::regprocedure);
 d:=replace(d,'resultado:=resultado||jsonb_build_object', 'if p_datos ? ''total_aceptado'' and (p_datos->>''total_aceptado'')::numeric<>monto+suc.costo_envio-rebaja then raise exception ''El total cambió. Revisa nuevamente el pedido.'' using errcode=''P0001'';end if; resultado:=resultado||jsonb_build_object');execute d;
end $$;
commit;
