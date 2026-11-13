begin;
alter table public.pedidos add column departamento varchar(100);
alter table public.pedidos alter column latitud drop not null, alter column longitud drop not null;
update public.sucursales set departamento=trim(regexp_replace(departamento,'\s+',' ','g'));
update public.pedidos p set departamento=s.departamento from public.sucursales s where s.id_sucursal=p.id_sucursal;
create function privado.departamento_pedido() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.departamento is null then select departamento into new.departamento from public.sucursales where id_sucursal=new.id_sucursal; end if;
 return new;
end; $$;
create trigger departamento_pedido before insert on public.pedidos for each row execute function privado.departamento_pedido();
create or replace function public.consultar_disponibilidad(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare resultado jsonb; lat numeric := (p_datos->>'latitud')::numeric; lon numeric := (p_datos->>'longitud')::numeric;
begin
  perform privado.exigir(array['GERENTE','VENDEDOR','CALL_CENTER']);
  if coalesce(trim(p_datos->>'departamento'),'')='' and (lat is null or lon is null or lat not between -90 and 90 or lon not between -180 and 180) then
    raise exception 'Coordenadas inválidas' using errcode='22023';
  end if;
  -- Para consultar no exigimos receta: indicamos qué productos la requieren.
  perform privado.validar_items(p_datos->'items','CONSULTA');
  select coalesce(jsonb_agg(to_jsonb(c) order by c.tiempo_estimado_minutos nulls last,c.id_sucursal),'[]'::jsonb) into resultado from (
    select s.id_sucursal,s.nombre,s.departamento,s.direccion,
      case when p_datos ? 'departamento' then null else round(privado.distancia(lat,lon,s.latitud,s.longitud),2) end distancia_km, s.preparacion_minutos,
      case when p_datos ? 'departamento' then null else s.preparacion_minutos + ceil(privado.distancia(lat,lon,s.latitud,s.longitud)/s.velocidad_kmh*60)::integer end tiempo_estimado_minutos,
      array['EFECTIVO','TARJETA','TRANSFERENCIA'] metodos_pago,
      (select sum(public.precio_catalogo(m)*(i->>'cantidad')::integer) from jsonb_array_elements(p_datos->'items') i
        join public.medicamentos m on m.id_medicamento=(i->>'id_medicamento')::bigint) total,
      (select jsonb_agg(jsonb_build_object('id_medicamento',m.id_medicamento,'requiere_receta',m.requiere_receta,
        'precio_unitario',public.precio_catalogo(m),'disponible',coalesce((select sum(v.cantidad-v.reservado) from public.inventario v
        where v.id_sucursal=s.id_sucursal and v.id_medicamento=m.id_medicamento and v.fecha_vencimiento>current_date),0)))
        from jsonb_array_elements(p_datos->'items') i join public.medicamentos m on m.id_medicamento=(i->>'id_medicamento')::bigint) items
    from public.sucursales s where s.estado='ACTIVA' and s.acepta_pedidos
      and (case when p_datos ? 'departamento' then public.normalizar_busqueda(s.departamento)=public.normalizar_busqueda(p_datos->>'departamento') else privado.distancia(lat,lon,s.latitud,s.longitud)<=s.radio_entrega_km end)
      and not exists(select 1 from jsonb_array_elements(p_datos->'items') i where
        coalesce((select sum(v.cantidad-v.reservado) from public.inventario v where v.id_sucursal=s.id_sucursal
          and v.id_medicamento=(i->>'id_medicamento')::bigint and v.fecha_vencimiento>current_date),0)<(i->>'cantidad')::integer)
    order by tiempo_estimado_minutos nulls last,s.id_sucursal limit 100
  ) c;
  return resultado;
end; $$;


create or replace function privado.pedido(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare suc public.sucursales; item jsonb; v_total numeric; v_id bigint; distancia numeric; minutos integer; precio numeric;
begin
  select * into suc from public.sucursales where id_sucursal=(p->>'id_sucursal')::bigint;
  perform privado.exigir(array['GERENTE','VENDEDOR','CALL_CENTER'],suc.id_sucursal);
  perform privado.sucursal_activa(suc.id_sucursal);
  if not suc.acepta_pedidos then raise exception 'Sucursal no acepta pedidos' using errcode='P0001'; end if;
  if coalesce(trim(p->>'departamento'),'')<>'' then
    if public.normalizar_busqueda(p->>'departamento')<>public.normalizar_busqueda(suc.departamento) then raise exception 'Sucursal fuera del departamento solicitado' using errcode='22023'; end if;
    if coalesce(trim(p->>'direccion_entrega'),'')='' then raise exception 'Direccion obligatoria' using errcode='22023'; end if;
    p:=(p-'latitud'-'longitud')||jsonb_build_object('departamento',suc.departamento);
    minutos:=suc.preparacion_minutos;
  else
  if coalesce(trim(p->>'direccion_entrega'),'')='' or p->>'latitud' is null or p->>'longitud' is null
    or (p->>'latitud')::numeric not between -90 and 90 or (p->>'longitud')::numeric not between -180 and 180 then
    raise exception 'Dirección y coordenadas válidas son obligatorias' using errcode='22023';
  end if;
  distancia := privado.distancia((p->>'latitud')::numeric,(p->>'longitud')::numeric,suc.latitud,suc.longitud);
  if distancia>suc.radio_entrega_km then raise exception 'Dirección fuera del radio de entrega' using errcode='P0001'; end if;
  minutos := suc.preparacion_minutos+ceil(distancia/suc.velocidad_kmh*60)::integer;
  end if;
  perform privado.bloquear_stock(suc.id_sucursal);
  v_total := privado.validar_items(p->'items',p->>'receta_referencia');
  insert into public.pedidos(id_cliente,id_sucursal,direccion_entrega,latitud,longitud,metodo_pago,canal,total,
    tiempo_estimado_minutos,entrega_estimada,receta_referencia,creado_por)
  values((p->>'id_cliente')::bigint,suc.id_sucursal,p->>'direccion_entrega',(p->>'latitud')::numeric,(p->>'longitud')::numeric,
    p->>'metodo_pago',p->>'canal',v_total,minutos,now()+make_interval(mins=>minutos),p->>'receta_referencia',auth.uid()) returning id_pedido into v_id;
  for item in select value from jsonb_array_elements(p->'items') loop
    select public.precio_catalogo(medicamentos) into precio from public.medicamentos where id_medicamento=(item->>'id_medicamento')::bigint;
    insert into public.detalle_pedido(id_pedido,id_medicamento,cantidad,precio_unitario)
      values(v_id,(item->>'id_medicamento')::bigint,(item->>'cantidad')::integer,precio);
    perform privado.usar_stock(suc.id_sucursal,(item->>'id_medicamento')::bigint,(item->>'cantidad')::integer,null,v_id);
  end loop;
  return jsonb_build_object('id_pedido',v_id,'total',v_total,'tiempo_estimado_minutos',minutos,'estado','PENDIENTE');
end; $$;


do $migration$
declare d text;
begin
 d:=pg_get_functiondef('privado.reasignar_pedido(jsonb)'::regprocedure);
 d:=replace(d,'  distancia := privado.distancia(ped.latitud,ped.longitud,suc.latitud,suc.longitud);', $body$  if ped.latitud is null or ped.longitud is null then
    if public.normalizar_busqueda(ped.departamento)<>public.normalizar_busqueda(suc.departamento) then raise exception 'Sucursal fuera del departamento solicitado' using errcode='22023'; end if;
    distancia:=0;
  else
    distancia := privado.distancia(ped.latitud,ped.longitud,suc.latitud,suc.longitud);
  end if;$body$);
 execute d;
end $migration$;
notify pgrst, 'reload schema';
commit;
