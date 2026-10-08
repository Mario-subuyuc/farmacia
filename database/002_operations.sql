-- Operaciones completas: una llamada RPC = una transacción PostgreSQL.
begin;

create function privado.sucursal_activa(p_id bigint) returns void
language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists(select 1 from public.sucursales where id_sucursal=p_id and estado='ACTIVA') then
    raise exception 'Sucursal inexistente o inactiva' using errcode='22023';
  end if;
end; $$;

create function privado.validar_items(p_items jsonb, p_receta text default null) returns numeric
language plpgsql set search_path = public, pg_temp as $$
declare item jsonb; medicamento public.medicamentos; total numeric := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or p_items is null or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'items debe contener entre 1 y 50 medicamentos' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) i group by i->>'id_medicamento' having count(*)>1) then
    raise exception 'No repitas medicamentos en items' using errcode='22023';
  end if;
  -- Mantiene precios consistentes entre cabecera y detalles durante la transacción.
  perform m.id_medicamento from public.medicamentos m where m.id_medicamento in
    (select (i->>'id_medicamento')::bigint from jsonb_array_elements(p_items) i)
    order by m.id_medicamento for share;
  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce((item->>'cantidad')::numeric,0) not between 1 and 1000000
       or (item->>'cantidad')::numeric <> trunc((item->>'cantidad')::numeric) then
      raise exception 'Cantidad inválida' using errcode='22023';
    end if;
    select * into medicamento from public.medicamentos where id_medicamento=(item->>'id_medicamento')::bigint and estado='ACTIVO';
    if not found then raise exception 'Medicamento inexistente o inactivo' using errcode='22023'; end if;
    if medicamento.requiere_receta and coalesce(trim(p_receta),'')='' then
      raise exception 'El medicamento requiere referencia de receta verificada' using errcode='22023';
    end if;
    total := total + medicamento.precio_venta * (item->>'cantidad')::integer;
  end loop;
  return total;
end; $$;

-- Bloqueamos lotes en el mismo orden para evitar vender/reservar stock simultáneamente.
create function privado.bloquear_stock(p_sucursal bigint) returns void
language plpgsql set search_path = public, pg_temp as $$
begin
  perform id_inventario from public.inventario where id_sucursal=p_sucursal order by id_inventario for update;
end; $$;

create function privado.distancia(p_lat numeric,p_lon numeric,p_lat2 numeric,p_lon2 numeric)
returns numeric language sql immutable as $$
  select (6371 * 2 * asin(least(1.0,sqrt(
    power(sin(radians((p_lat2-p_lat)::double precision)/2),2) +
    cos(radians(p_lat::double precision))*cos(radians(p_lat2::double precision))*
    power(sin(radians((p_lon2-p_lon)::double precision)/2),2)))))::numeric;
$$;

create function public.consultar_disponibilidad(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare resultado jsonb; lat numeric := (p_datos->>'latitud')::numeric; lon numeric := (p_datos->>'longitud')::numeric;
begin
  perform privado.exigir(array['GERENTE','VENDEDOR','CALL_CENTER']);
  if lat is null or lon is null or lat not between -90 and 90 or lon not between -180 and 180 then
    raise exception 'Coordenadas inválidas' using errcode='22023';
  end if;
  -- Para consultar no exigimos receta: indicamos qué productos la requieren.
  perform privado.validar_items(p_datos->'items','CONSULTA');
  select coalesce(jsonb_agg(to_jsonb(c) order by c.tiempo_estimado_minutos),'[]'::jsonb) into resultado from (
    select s.id_sucursal,s.nombre,s.departamento,s.direccion,
      round(privado.distancia(lat,lon,s.latitud,s.longitud),2) distancia_km,
      s.preparacion_minutos + ceil(privado.distancia(lat,lon,s.latitud,s.longitud)/s.velocidad_kmh*60)::integer tiempo_estimado_minutos,
      array['EFECTIVO','TARJETA','TRANSFERENCIA'] metodos_pago,
      (select sum(m.precio_venta*(i->>'cantidad')::integer) from jsonb_array_elements(p_datos->'items') i
        join public.medicamentos m on m.id_medicamento=(i->>'id_medicamento')::bigint) total,
      (select jsonb_agg(jsonb_build_object('id_medicamento',m.id_medicamento,'requiere_receta',m.requiere_receta,
        'precio_unitario',m.precio_venta,'disponible',coalesce((select sum(v.cantidad-v.reservado) from public.inventario v
        where v.id_sucursal=s.id_sucursal and v.id_medicamento=m.id_medicamento and v.fecha_vencimiento>current_date),0)))
        from jsonb_array_elements(p_datos->'items') i join public.medicamentos m on m.id_medicamento=(i->>'id_medicamento')::bigint) items
    from public.sucursales s where s.estado='ACTIVA' and s.acepta_pedidos
      and privado.distancia(lat,lon,s.latitud,s.longitud)<=s.radio_entrega_km
      and not exists(select 1 from jsonb_array_elements(p_datos->'items') i where
        coalesce((select sum(v.cantidad-v.reservado) from public.inventario v where v.id_sucursal=s.id_sucursal
          and v.id_medicamento=(i->>'id_medicamento')::bigint and v.fecha_vencimiento>current_date),0)<(i->>'cantidad')::integer)
    order by tiempo_estimado_minutos limit 100
  ) c;
  return resultado;
end; $$;

create function privado.entrada(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare v_id bigint; v_sucursal bigint := (p->>'id_sucursal')::bigint; v_fecha date := (p->>'fecha_vencimiento')::date; costo numeric;
begin
  perform privado.exigir(array['GERENTE','BODEGA'],v_sucursal);
  perform privado.sucursal_activa(v_sucursal);
  if v_fecha is null or v_fecha<=current_date or coalesce(trim(p->>'lote'),'')='' or coalesce((p->>'cantidad')::integer,0)<=0
     or coalesce(trim(p->>'motivo'),'')='' then
    raise exception 'Entrada: lote, vencimiento futuro, cantidad positiva y motivo son obligatorios' using errcode='22023';
  end if;
  if not exists(select 1 from public.medicamentos where id_medicamento=(p->>'id_medicamento')::bigint and estado='ACTIVO') then
    raise exception 'Medicamento inexistente o inactivo' using errcode='22023';
  end if;
  select coalesce((p->>'costo_unitario')::numeric,precio_compra) into costo from public.medicamentos where id_medicamento=(p->>'id_medicamento')::bigint;
  insert into public.inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad)
    values(v_sucursal,(p->>'id_medicamento')::bigint,p->>'lote',v_fecha,costo,(p->>'cantidad')::integer)
  on conflict(id_sucursal,id_medicamento,lote) do update set cantidad=inventario.cantidad+excluded.cantidad
    where inventario.fecha_vencimiento=excluded.fecha_vencimiento and inventario.costo_unitario=excluded.costo_unitario returning id_inventario into v_id;
  if v_id is null then raise exception 'El lote ya existe con otra fecha de vencimiento o costo' using errcode='22023'; end if;
  insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo,creado_por)
    values(v_id,v_sucursal,'ENTRADA',(p->>'cantidad')::integer,p->>'motivo',auth.uid());
  return jsonb_build_object('id_inventario',v_id);
end; $$;

create function privado.ajuste(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare v public.inventario; diferencia integer := (p->>'diferencia')::integer;
begin
  select * into v from public.inventario where id_inventario=(p->>'id_inventario')::bigint for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform privado.exigir(array['GERENTE','BODEGA'],v.id_sucursal);
  if diferencia is null or diferencia=0 or coalesce(trim(p->>'motivo'),'')='' then
    raise exception 'Indica diferencia distinta de cero y motivo' using errcode='22023';
  end if;
  if v.cantidad+diferencia<v.reservado then raise exception 'El ajuste afecta stock reservado o deja stock negativo' using errcode='P0001'; end if;
  update public.inventario set cantidad=cantidad+diferencia where id_inventario=v.id_inventario;
  insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo,creado_por)
    values(v.id_inventario,v.id_sucursal,'AJUSTE',diferencia,p->>'motivo',auth.uid());
  return jsonb_build_object('id_inventario',v.id_inventario,'cantidad',v.cantidad+diferencia);
end; $$;

-- FEFO: se usan primero los lotes que vencen antes. Nunca usa vencidos ni reservas ajenas.
create function privado.usar_stock(p_sucursal bigint,p_medicamento bigint,p_cantidad integer,p_venta bigint default null,p_pedido bigint default null)
returns void language plpgsql set search_path = public, pg_temp as $$
declare lote public.inventario; pendiente integer := p_cantidad; tomar integer; precio numeric;
begin
  select precio_venta into precio from public.medicamentos where id_medicamento=p_medicamento;
  for lote in select * from public.inventario where id_sucursal=p_sucursal and id_medicamento=p_medicamento
    and fecha_vencimiento>current_date and cantidad>reservado order by fecha_vencimiento,id_inventario for update loop
    tomar := least(pendiente,lote.cantidad-lote.reservado);
    if p_pedido is not null then
      update public.inventario set reservado=reservado+tomar where id_inventario=lote.id_inventario;
      insert into public.reservas_pedido(id_pedido,id_inventario,cantidad) values(p_pedido,lote.id_inventario,tomar);
    else
      update public.inventario set cantidad=cantidad-tomar where id_inventario=lote.id_inventario;
      insert into public.detalle_venta(id_venta,id_inventario,id_medicamento,cantidad,precio_unitario)
        values(p_venta,lote.id_inventario,p_medicamento,tomar,precio);
      insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo,id_venta,creado_por)
        values(lote.id_inventario,p_sucursal,'VENTA',-tomar,'Venta',p_venta,auth.uid());
    end if;
    pendiente := pendiente-tomar;
    exit when pendiente=0;
  end loop;
  if pendiente>0 then raise exception 'Stock disponible insuficiente para medicamento %',p_medicamento using errcode='P0001'; end if;
end; $$;

create function privado.venta(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare v_sucursal bigint := (p->>'id_sucursal')::bigint; v_id bigint; v_total numeric; item jsonb;
begin
  perform privado.exigir(array['GERENTE','VENDEDOR','CAJERO'],v_sucursal);
  perform privado.sucursal_activa(v_sucursal);
  perform privado.bloquear_stock(v_sucursal);
  v_total := privado.validar_items(p->'items',p->>'receta_referencia');
  if p->>'id_empleado' is not null and not exists(select 1 from public.empleados where id_empleado=(p->>'id_empleado')::bigint and id_sucursal=v_sucursal and estado='ACTIVO') then
    raise exception 'Empleado no pertenece a la sucursal o está inactivo' using errcode='22023';
  end if;
  insert into public.ventas(id_sucursal,id_cliente,id_empleado,total,metodo_pago,receta_referencia,creado_por)
    values(v_sucursal,(p->>'id_cliente')::bigint,(p->>'id_empleado')::bigint,v_total,p->>'metodo_pago',p->>'receta_referencia',auth.uid()) returning id_venta into v_id;
  for item in select value from jsonb_array_elements(p->'items') loop
    perform privado.usar_stock(v_sucursal,(item->>'id_medicamento')::bigint,(item->>'cantidad')::integer,v_id);
  end loop;
  insert into public.movimientos_caja(id_sucursal,id_empleado,tipo,concepto,monto,metodo_pago,id_venta,creado_por)
    values(v_sucursal,(p->>'id_empleado')::bigint,'INGRESO','Venta',v_total,p->>'metodo_pago',v_id,auth.uid());
  return jsonb_build_object('id_venta',v_id,'total',v_total);
end; $$;

create function privado.anular_venta(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare v public.ventas; item record; ingreso public.movimientos_caja;
begin
  select * into v from public.ventas where id_venta=(p->>'id_venta')::bigint for update;
  if not found then raise exception 'Venta no encontrada' using errcode='P0002'; end if;
  perform privado.exigir(array['GERENTE'],v.id_sucursal);
  if v.estado<>'PAGADA' or v.id_pedido is not null then
    raise exception 'Solo se anulan ventas de mostrador pagadas; entregas requieren gestionar devolución' using errcode='P0001';
  end if;
  if coalesce(trim(p->>'motivo'),'')='' then raise exception 'Motivo obligatorio' using errcode='22023'; end if;
  perform privado.bloquear_stock(v.id_sucursal);
  for item in select * from public.detalle_venta where id_venta=v.id_venta loop
    update public.inventario set cantidad=cantidad+item.cantidad where id_inventario=item.id_inventario;
    insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo,id_venta,creado_por)
      values(item.id_inventario,v.id_sucursal,'ANULACION',item.cantidad,p->>'motivo',v.id_venta,auth.uid());
  end loop;
  select * into ingreso from public.movimientos_caja where id_venta=v.id_venta and tipo='INGRESO';
  insert into public.movimientos_caja(id_sucursal,tipo,concepto,monto,metodo_pago,id_venta,id_reversion,creado_por)
    values(v.id_sucursal,'EGRESO',p->>'motivo',v.total,v.metodo_pago,v.id_venta,ingreso.id_movimiento,auth.uid());
  update public.ventas set estado='ANULADA' where id_venta=v.id_venta;
  return jsonb_build_object('id_venta',v.id_venta,'estado','ANULADA');
end; $$;

create function privado.traslado(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare origen bigint := (p->>'id_sucursal_origen')::bigint; destino bigint := (p->>'id_sucursal_destino')::bigint;
  v_id bigint; item jsonb; lote public.inventario; pendiente integer; tomar integer;
begin
  perform privado.exigir(array['GERENTE','BODEGA'],origen);
  perform privado.sucursal_activa(origen); perform privado.sucursal_activa(destino);
  if origen=destino or coalesce(trim(p->>'motivo'),'')='' then raise exception 'Destino diferente y motivo son obligatorios' using errcode='22023'; end if;
  perform privado.validar_items(p->'items','TRASLADO INTERNO');
  perform privado.bloquear_stock(origen);
  insert into public.traslados(id_sucursal_origen,id_sucursal_destino,motivo,creado_por)
    values(origen,destino,p->>'motivo',auth.uid()) returning id_traslado into v_id;
  for item in select value from jsonb_array_elements(p->'items') loop
    pendiente := (item->>'cantidad')::integer;
    for lote in select * from public.inventario where id_sucursal=origen and id_medicamento=(item->>'id_medicamento')::bigint
      and fecha_vencimiento>current_date and cantidad>reservado order by fecha_vencimiento,id_inventario for update loop
      tomar := least(pendiente,lote.cantidad-lote.reservado);
      update public.inventario set cantidad=cantidad-tomar where id_inventario=lote.id_inventario;
      insert into public.detalle_traslado(id_traslado,id_inventario_origen,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad)
        values(v_id,lote.id_inventario,lote.id_medicamento,lote.lote,lote.fecha_vencimiento,lote.costo_unitario,tomar);
      insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo,id_traslado,creado_por)
        values(lote.id_inventario,origen,'TRASLADO_SALIDA',-tomar,p->>'motivo',v_id,auth.uid());
      pendiente := pendiente-tomar; exit when pendiente=0;
    end loop;
    if pendiente>0 then raise exception 'Stock insuficiente para traslado' using errcode='P0001'; end if;
  end loop;
  return jsonb_build_object('id_traslado',v_id,'estado','EN_TRANSITO');
end; $$;

create function privado.recibir_traslado(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare t public.traslados; item record; v_id bigint;
begin
  select * into t from public.traslados where id_traslado=(p->>'id_traslado')::bigint for update;
  if not found then raise exception 'Traslado no encontrado' using errcode='P0002'; end if;
  perform privado.exigir(array['GERENTE','BODEGA'],t.id_sucursal_destino);
  perform privado.sucursal_activa(t.id_sucursal_destino);
  if t.estado<>'EN_TRANSITO' then raise exception 'El traslado ya fue recibido' using errcode='P0001'; end if;
  for item in select * from public.detalle_traslado where id_traslado=t.id_traslado order by id_medicamento,lote loop
    insert into public.inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad)
      values(t.id_sucursal_destino,item.id_medicamento,item.lote,item.fecha_vencimiento,item.costo_unitario,item.cantidad)
    on conflict(id_sucursal,id_medicamento,lote) do update set cantidad=inventario.cantidad+excluded.cantidad
      where inventario.fecha_vencimiento=excluded.fecha_vencimiento and inventario.costo_unitario=excluded.costo_unitario returning id_inventario into v_id;
    if v_id is null then raise exception 'Fecha o costo de lote distinto en destino' using errcode='P0001'; end if;
    insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo,id_traslado,creado_por)
      values(v_id,t.id_sucursal_destino,'TRASLADO_ENTRADA',item.cantidad,t.motivo,t.id_traslado,auth.uid());
  end loop;
  update public.traslados set estado='RECIBIDO',recibido_en=now(),recibido_por=auth.uid() where id_traslado=t.id_traslado;
  return jsonb_build_object('id_traslado',t.id_traslado,'estado','RECIBIDO');
end; $$;

create function privado.pedido(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare suc public.sucursales; item jsonb; v_total numeric; v_id bigint; distancia numeric; minutos integer; precio numeric;
begin
  select * into suc from public.sucursales where id_sucursal=(p->>'id_sucursal')::bigint;
  perform privado.exigir(array['GERENTE','VENDEDOR','CALL_CENTER'],suc.id_sucursal);
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

create function privado.estado_pedido(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare ped public.pedidos; nuevo text := p->>'estado'; reserva record; v_venta bigint;
begin
  select * into ped from public.pedidos where id_pedido=(p->>'id_pedido')::bigint for update;
  if not found then raise exception 'Pedido no encontrado' using errcode='P0002'; end if;
  -- Call center coordina y cancela; solo la sucursal confirma preparación/entrega.
  if nuevo='CANCELADO' then perform privado.exigir(array['GERENTE','VENDEDOR','CALL_CENTER'],ped.id_sucursal);
  else perform privado.exigir(array['GERENTE','VENDEDOR','BODEGA'],ped.id_sucursal); end if;
  if not ((ped.estado='PENDIENTE' and nuevo in ('PREPARANDO','CANCELADO'))
    or (ped.estado='PREPARANDO' and nuevo in ('EN_CAMINO','CANCELADO'))
    or (ped.estado='EN_CAMINO' and nuevo in ('ENTREGADO','DEVUELTO'))) then
    raise exception 'Cambio de estado no permitido' using errcode='P0001';
  end if;
  if nuevo='EN_CAMINO' and coalesce(trim(p->>'repartidor'),'')='' then raise exception 'Repartidor obligatorio' using errcode='22023'; end if;
  if nuevo='DEVUELTO' and coalesce(trim(p->>'motivo'),'')='' then raise exception 'Motivo de devolución obligatorio' using errcode='22023'; end if;
  perform privado.bloquear_stock(ped.id_sucursal);
  if nuevo='ENTREGADO' then
    if exists(select 1 from public.reservas_pedido r join public.inventario i using(id_inventario)
      where r.id_pedido=ped.id_pedido and i.fecha_vencimiento<=current_date) then
      raise exception 'Hay un lote vencido reservado: no puede entregarse' using errcode='P0001';
    end if;
    insert into public.ventas(id_sucursal,id_cliente,id_pedido,total,metodo_pago,receta_referencia,creado_por)
      values(ped.id_sucursal,ped.id_cliente,ped.id_pedido,ped.total,ped.metodo_pago,ped.receta_referencia,auth.uid()) returning id_venta into v_venta;
  end if;
  if nuevo in ('CANCELADO','ENTREGADO','DEVUELTO') then
    for reserva in select r.*,i.id_medicamento,d.precio_unitario from public.reservas_pedido r
      join public.inventario i using(id_inventario) join public.detalle_pedido d
      on d.id_pedido=r.id_pedido and d.id_medicamento=i.id_medicamento where r.id_pedido=ped.id_pedido loop
      update public.inventario set reservado=reservado-reserva.cantidad,
        cantidad=cantidad-case when nuevo='ENTREGADO' then reserva.cantidad else 0 end where id_inventario=reserva.id_inventario;
      if nuevo='ENTREGADO' then
        insert into public.detalle_venta(id_venta,id_inventario,id_medicamento,cantidad,precio_unitario)
          values(v_venta,reserva.id_inventario,reserva.id_medicamento,reserva.cantidad,reserva.precio_unitario);
        insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo,id_venta,creado_por)
          values(reserva.id_inventario,ped.id_sucursal,'VENTA',-reserva.cantidad,'Entrega de pedido',v_venta,auth.uid());
      end if;
    end loop;
    -- Conservamos reservas como histórico. Solo los pedidos abiertos tienen reserva vigente.
  end if;
  if nuevo='ENTREGADO' then
    insert into public.movimientos_caja(id_sucursal,tipo,concepto,monto,metodo_pago,id_venta,creado_por)
      values(ped.id_sucursal,'INGRESO','Entrega de pedido',ped.total,ped.metodo_pago,v_venta,auth.uid());
  end if;
  update public.pedidos set estado=nuevo,
    nota_estado=coalesce(p->>'motivo',nota_estado),
    repartidor=case when nuevo='EN_CAMINO' then p->>'repartidor' else repartidor end,
    entregado_en=case when nuevo='ENTREGADO' then now() else entregado_en end where id_pedido=ped.id_pedido;
  return jsonb_build_object('id_pedido',ped.id_pedido,'estado',nuevo,'id_venta',v_venta);
end; $$;

-- El call center puede cambiar la sucursal antes de despachar. Si el destino no
-- tiene stock, la transacción revierte y conserva la reserva original.
create function privado.reasignar_pedido(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare ped public.pedidos; suc public.sucursales; reserva record; item jsonb;
  items jsonb; distancia numeric; minutos integer;
begin
  select * into ped from public.pedidos where id_pedido=(p->>'id_pedido')::bigint for update;
  if not found then raise exception 'Pedido no encontrado' using errcode='P0002'; end if;
  perform privado.exigir(array['GERENTE','CALL_CENTER'],ped.id_sucursal);
  select * into suc from public.sucursales where id_sucursal=(p->>'id_sucursal')::bigint;
  perform privado.exigir(array['GERENTE','CALL_CENTER'],suc.id_sucursal);
  perform privado.sucursal_activa(suc.id_sucursal);
  if ped.estado not in ('PENDIENTE','PREPARANDO') or suc.id_sucursal=ped.id_sucursal or not suc.acepta_pedidos then
    raise exception 'No se puede reasignar este pedido a esa sucursal' using errcode='P0001';
  end if;
  if coalesce(trim(p->>'motivo'),'')='' then raise exception 'Motivo obligatorio' using errcode='22023'; end if;
  distancia := privado.distancia(ped.latitud,ped.longitud,suc.latitud,suc.longitud);
  if distancia>suc.radio_entrega_km then raise exception 'Destino fuera del radio de entrega' using errcode='P0001'; end if;
  minutos := suc.preparacion_minutos+ceil(distancia/suc.velocidad_kmh*60)::integer;
  perform privado.bloquear_stock(least(ped.id_sucursal,suc.id_sucursal));
  perform privado.bloquear_stock(greatest(ped.id_sucursal,suc.id_sucursal));
  select jsonb_agg(jsonb_build_object('id_medicamento',id_medicamento,'cantidad',cantidad)) into items
    from public.detalle_pedido where id_pedido=ped.id_pedido;
  perform privado.validar_items(items,ped.receta_referencia);
  for reserva in select * from public.reservas_pedido where id_pedido=ped.id_pedido loop
    update public.inventario set reservado=reservado-reserva.cantidad where id_inventario=reserva.id_inventario;
  end loop;
  delete from public.reservas_pedido where id_pedido=ped.id_pedido;
  for item in select value from jsonb_array_elements(items) loop
    perform privado.usar_stock(suc.id_sucursal,(item->>'id_medicamento')::bigint,(item->>'cantidad')::integer,null,ped.id_pedido);
  end loop;
  update public.pedidos set id_sucursal=suc.id_sucursal,estado='PENDIENTE',tiempo_estimado_minutos=minutos,
    entrega_estimada=now()+make_interval(mins=>minutos),nota_estado=p->>'motivo',repartidor=null where id_pedido=ped.id_pedido;
  return jsonb_build_object('id_pedido',ped.id_pedido,'id_sucursal',suc.id_sucursal,'estado','PENDIENTE','tiempo_estimado_minutos',minutos);
end; $$;

create function privado.caja(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare suc bigint := (p->>'id_sucursal')::bigint; v_id bigint;
begin
  perform privado.exigir(array['GERENTE','CAJERO'],suc); perform privado.sucursal_activa(suc);
  if coalesce(trim(p->>'concepto'),'')='' then raise exception 'Concepto obligatorio' using errcode='22023'; end if;
  if p->>'id_empleado' is not null and not exists(select 1 from public.empleados where id_empleado=(p->>'id_empleado')::bigint and id_sucursal=suc and estado='ACTIVO') then
    raise exception 'Empleado no pertenece a la sucursal' using errcode='22023';
  end if;
  insert into public.movimientos_caja(id_sucursal,id_empleado,tipo,concepto,monto,metodo_pago,creado_por)
    values(suc,(p->>'id_empleado')::bigint,p->>'tipo',p->>'concepto',(p->>'monto')::numeric,p->>'metodo_pago',auth.uid()) returning id_movimiento into v_id;
  return jsonb_build_object('id_movimiento',v_id);
end; $$;

create function privado.revertir_caja(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare mov public.movimientos_caja; v_id bigint;
begin
  select * into mov from public.movimientos_caja where id_movimiento=(p->>'id_movimiento')::bigint for update;
  if not found then raise exception 'Movimiento no encontrado' using errcode='P0002'; end if;
  perform privado.exigir(array['GERENTE'],mov.id_sucursal);
  if mov.id_venta is not null or mov.id_planilla is not null or mov.id_reversion is not null then
    raise exception 'Solo se revierten movimientos manuales originales' using errcode='P0001';
  end if;
  if coalesce(trim(p->>'motivo'),'')='' then raise exception 'Motivo obligatorio' using errcode='22023'; end if;
  insert into public.movimientos_caja(id_sucursal,tipo,concepto,monto,metodo_pago,id_reversion,creado_por)
    values(mov.id_sucursal,case when mov.tipo='INGRESO' then 'EGRESO' else 'INGRESO' end,p->>'motivo',mov.monto,mov.metodo_pago,mov.id_movimiento,auth.uid()) returning id_movimiento into v_id;
  return jsonb_build_object('id_movimiento',v_id);
end; $$;

create function privado.planilla(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare suc bigint := (p->>'id_sucursal')::bigint; periodo date := (p->>'periodo')::date;
  v_total numeric; v_id bigint; ajuste jsonb; emp public.empleados;
begin
  perform privado.exigir(array['GERENTE'],suc); perform privado.sucursal_activa(suc);
  if periodo is null or extract(day from periodo)<>1 then raise exception 'periodo debe ser el primer día del mes' using errcode='22023'; end if;
  perform id_empleado from public.empleados where id_sucursal=suc order by id_empleado for update;
  if jsonb_typeof(coalesce(p->'ajustes','[]'))<>'array' then raise exception 'ajustes debe ser una lista' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p->'ajustes','[]')) a group by a->>'id_empleado' having count(*)>1) then
    raise exception 'Ajustes de empleado repetidos' using errcode='22023';
  end if;
  for ajuste in select value from jsonb_array_elements(coalesce(p->'ajustes','[]')) loop
    if not exists(select 1 from public.empleados where id_empleado=(ajuste->>'id_empleado')::bigint and id_sucursal=suc and estado='ACTIVO') then
      raise exception 'Ajuste para empleado ajeno o inactivo' using errcode='22023';
    end if;
  end loop;
  select sum(salario) into v_total from public.empleados where id_sucursal=suc and estado='ACTIVO';
  if coalesce(v_total,0)<=0 then raise exception 'No hay empleados con salario para pagar' using errcode='P0001'; end if;
  insert into public.planillas(id_sucursal,periodo,total,creado_por) values(suc,periodo,v_total,auth.uid()) returning id_planilla into v_id;
  for emp in select * from public.empleados where id_sucursal=suc and estado='ACTIVO' loop
    select value into ajuste from jsonb_array_elements(coalesce(p->'ajustes','[]')) a where (a->>'id_empleado')::bigint=emp.id_empleado;
    insert into public.detalle_planilla(id_planilla,id_empleado,salario_base,bonificacion,deduccion)
      values(v_id,emp.id_empleado,emp.salario,coalesce((ajuste->>'bonificacion')::numeric,0),coalesce((ajuste->>'deduccion')::numeric,0));
  end loop;
  select sum(neto) into v_total from public.detalle_planilla where id_planilla=v_id;
  update public.planillas set total=v_total where id_planilla=v_id;
  insert into public.movimientos_caja(id_sucursal,tipo,concepto,monto,metodo_pago,id_planilla,creado_por)
    values(suc,'EGRESO','Planilla '||periodo,v_total,'TRANSFERENCIA',v_id,auth.uid());
  return jsonb_build_object('id_planilla',v_id,'total',v_total);
end; $$;

-- Comprobamos permisos incluso en un reintento: una cuenta puede haber cambiado
-- de rol/sucursal desde la solicitud original y ya no poder leer ese resultado.
create function privado.autorizar_operacion(p_accion text,p jsonb) returns void
language plpgsql set search_path = public, pg_temp as $$
declare suc bigint;
begin
  case p_accion
    when 'entrada' then perform privado.exigir(array['GERENTE','BODEGA'],(p->>'id_sucursal')::bigint);
    when 'ajuste' then
      select id_sucursal into suc from public.inventario where id_inventario=(p->>'id_inventario')::bigint;
      perform privado.exigir(array['GERENTE','BODEGA'],suc);
    when 'venta' then perform privado.exigir(array['GERENTE','VENDEDOR','CAJERO'],(p->>'id_sucursal')::bigint);
    when 'anular_venta' then
      select id_sucursal into suc from public.ventas where id_venta=(p->>'id_venta')::bigint;
      perform privado.exigir(array['GERENTE'],suc);
    when 'traslado' then perform privado.exigir(array['GERENTE','BODEGA'],(p->>'id_sucursal_origen')::bigint);
    when 'recibir_traslado' then
      select id_sucursal_destino into suc from public.traslados where id_traslado=(p->>'id_traslado')::bigint;
      perform privado.exigir(array['GERENTE','BODEGA'],suc);
    when 'pedido' then perform privado.exigir(array['GERENTE','VENDEDOR','CALL_CENTER'],(p->>'id_sucursal')::bigint);
    when 'estado_pedido' then
      select id_sucursal into suc from public.pedidos where id_pedido=(p->>'id_pedido')::bigint;
      if p->>'estado'='CANCELADO' then perform privado.exigir(array['GERENTE','VENDEDOR','CALL_CENTER'],suc);
      else perform privado.exigir(array['GERENTE','VENDEDOR','BODEGA'],suc); end if;
    when 'reasignar_pedido' then
      select id_sucursal into suc from public.pedidos where id_pedido=(p->>'id_pedido')::bigint;
      perform privado.exigir(array['GERENTE','CALL_CENTER'],suc);
      perform privado.exigir(array['GERENTE','CALL_CENTER'],(p->>'id_sucursal')::bigint);
    when 'caja' then perform privado.exigir(array['GERENTE','CAJERO'],(p->>'id_sucursal')::bigint);
    when 'revertir_caja' then
      select id_sucursal into suc from public.movimientos_caja where id_movimiento=(p->>'id_movimiento')::bigint;
      perform privado.exigir(array['GERENTE'],suc);
    when 'planilla' then perform privado.exigir(array['GERENTE'],(p->>'id_sucursal')::bigint);
    else raise exception 'Operación desconocida' using errcode='22023';
  end case;
end; $$;

-- Una clave UUID evita duplicar ventas o pagos si el cliente reintenta la petición.
create function public.ejecutar_operacion(p_accion text,p_datos jsonb,p_clave uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare anterior privado.solicitudes; resultado jsonb;
begin
  if auth.uid() is null or not privado.permitido(array['GERENTE','VENDEDOR','BODEGA','CAJERO','CALL_CENTER']) then
    raise exception 'Cuenta sin permisos operativos' using errcode='42501';
  end if;
  if p_clave is null or jsonb_typeof(p_datos)<>'object' or p_datos is null then
    raise exception 'Clave de idempotencia y datos son obligatorios' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_clave::text,0));
  perform privado.autorizar_operacion(p_accion,p_datos);
  select * into anterior from privado.solicitudes where actor=auth.uid() and clave=p_clave;
  if found then
    if anterior.accion<>p_accion or anterior.datos<>p_datos then raise exception 'Clave ya usada con otros datos' using errcode='P0001'; end if;
    return anterior.resultado;
  end if;
  case p_accion
    when 'entrada' then resultado := privado.entrada(p_datos);
    when 'ajuste' then resultado := privado.ajuste(p_datos);
    when 'venta' then resultado := privado.venta(p_datos);
    when 'anular_venta' then resultado := privado.anular_venta(p_datos);
    when 'traslado' then resultado := privado.traslado(p_datos);
    when 'recibir_traslado' then resultado := privado.recibir_traslado(p_datos);
    when 'pedido' then resultado := privado.pedido(p_datos);
    when 'estado_pedido' then resultado := privado.estado_pedido(p_datos);
    when 'reasignar_pedido' then resultado := privado.reasignar_pedido(p_datos);
    when 'caja' then resultado := privado.caja(p_datos);
    when 'revertir_caja' then resultado := privado.revertir_caja(p_datos);
    when 'planilla' then resultado := privado.planilla(p_datos);
    else raise exception 'Operación desconocida' using errcode='22023';
  end case;
  insert into privado.solicitudes(actor,clave,accion,datos,resultado) values(auth.uid(),p_clave,p_accion,p_datos,resultado);
  return resultado;
end; $$;

-- Los reportes invoker respetan RLS: gerente ve su sucursal, auditor/admin toda la empresa.
create function public.reporte_empresa(p_desde timestamptz,p_hasta timestamptz,p_sucursal bigint default null)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare resultado jsonb;
begin
  perform privado.exigir(array['GERENTE','AUDITOR'],p_sucursal);
  if p_desde is null or p_hasta is null or p_desde>=p_hasta then raise exception 'Rango de fechas inválido' using errcode='22023'; end if;
  select jsonb_build_object(
    'desde',p_desde,'hasta',p_hasta,
    'caja',coalesce((select jsonb_agg(to_jsonb(c)) from (
      select id_sucursal,metodo_pago,
        coalesce(sum(case when tipo='INGRESO' then monto else -monto end) filter(where fecha<p_desde),0) saldo_inicial,
        coalesce(sum(monto) filter(where tipo='INGRESO' and fecha>=p_desde),0) ingresos,
        coalesce(sum(monto) filter(where tipo='EGRESO' and fecha>=p_desde),0) egresos,
        coalesce(sum(case when tipo='INGRESO' then monto else -monto end) filter(where fecha>=p_desde),0) saldo_periodo,
        sum(case when tipo='INGRESO' then monto else -monto end) saldo_final
      from public.movimientos_caja where fecha<p_hasta and (p_sucursal is null or id_sucursal=p_sucursal)
      group by id_sucursal,metodo_pago order by id_sucursal,metodo_pago
    ) c),'[]'::jsonb),
    'planilla_pagada',coalesce((select sum(total) from public.planillas where fecha>=p_desde and fecha<p_hasta and (p_sucursal is null or id_sucursal=p_sucursal)),0),
    'activos',coalesce((select jsonb_agg(to_jsonb(a)) from (
      select id_sucursal,sum(valor) valor_adquisicion,
        sum(greatest(valor_residual,valor-(valor-valor_residual)/vida_util_meses * greatest(0,
          extract(year from age(p_hasta::date,fecha_adquisicion))*12+extract(month from age(p_hasta::date,fecha_adquisicion))))) valor_contable_estimado
      from public.activos where estado<>'BAJA' and fecha_adquisicion<=p_hasta::date and (p_sucursal is null or id_sucursal=p_sucursal) group by id_sucursal
    ) a),'[]'::jsonb),
    'pedidos_atrasados',coalesce((select jsonb_agg(to_jsonb(p)) from public.pedidos p where estado in ('PENDIENTE','PREPARANDO','EN_CAMINO')
      and entrega_estimada<now() and (p_sucursal is null or id_sucursal=p_sucursal)),'[]'::jsonb),
    'stock',coalesce((select jsonb_agg(to_jsonb(v)) from (
      select k.id_sucursal,k.id_medicamento,
        coalesce(sum(i.cantidad),0) cantidad_registrada,coalesce(sum(i.reservado),0) reservado,
        sum(case when i.fecha_vencimiento>current_date and m.estado='ACTIVO' then i.cantidad-i.reservado else 0 end) disponible,
        sum(case when i.fecha_vencimiento<=current_date then i.cantidad else 0 end) vencido,
        coalesce(sum(i.cantidad*i.costo_unitario),0) valor_compra,
        coalesce(max(sm.stock_minimo),0) stock_minimo,
        sum(case when i.fecha_vencimiento>current_date and m.estado='ACTIVO' then i.cantidad-i.reservado else 0 end)<coalesce(max(sm.stock_minimo),0) bajo_minimo
      from (select id_sucursal,id_medicamento from public.inventario
        union select id_sucursal,id_medicamento from public.stock_minimos) k
      join public.medicamentos m using(id_medicamento)
      left join public.inventario i on i.id_sucursal=k.id_sucursal and i.id_medicamento=k.id_medicamento
      left join public.stock_minimos sm on sm.id_sucursal=k.id_sucursal and sm.id_medicamento=k.id_medicamento
      where (p_sucursal is null or k.id_sucursal=p_sucursal) group by k.id_sucursal,k.id_medicamento
    ) v),'[]'::jsonb)
  ) into resultado;
  return resultado;
end; $$;

-- exigir también se usa desde el reporte invoker, sin dar acceso a otros helpers.
revoke execute on all functions in schema privado from public,anon,authenticated;
grant execute on function privado.permitido(text[],bigint),privado.exigir(text[],bigint) to authenticated;
revoke execute on function public.ejecutar_operacion(text,jsonb,uuid),public.consultar_disponibilidad(jsonb),public.reporte_empresa(timestamptz,timestamptz,bigint) from public,anon;
grant execute on function public.ejecutar_operacion(text,jsonb,uuid),public.consultar_disponibilidad(jsonb),public.reporte_empresa(timestamptz,timestamptz,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
