-- Catálogo ficticio compartido por la migración y database/seed.sql.
-- Conserva precios, stock y ventas existentes: solo inserta lo que falta.
begin;
create or replace function privado.cargar_catalogo_demo()
returns void language plpgsql set search_path = pg_catalog, public as $$
begin
  perform pg_advisory_xact_lock(7062026);
  insert into public.sucursales(codigo,nombre,departamento,direccion,telefono,tipo,latitud,longitud,radio_entrega_km)
  values
    ('DEMO-GUA','Farmacia Demo Guatemala','Guatemala','Centro comercial demo zona 1','5555-0101','FARMACIA',14.6407,-90.5133,15),
    ('DEMO-MIX','Farmacia Demo Mixco','Guatemala','Centro comercial demo Mixco','5555-0102','FARMACIA',14.6333,-90.6000,15),
    ('DEMO-XELA','Stand Demo Xela','Quetzaltenango','Gasolinera demo Xela','5555-0103','STAND',14.8347,-91.5181,10)
  on conflict(codigo) do nothing;

  -- Precios y presentación ficticios para probar el sistema.
  insert into public.medicamentos(codigo,nombre,descripcion,categoria,principio_activo,precio_compra,precio_venta,requiere_receta)
  values
    ('DEMO-PARA','Paracetamol 500 mg','Caja de prueba','ANALGESICO','Paracetamol',5,10,false),
    ('DEMO-AMOX','Amoxicilina 500 mg','Caja de prueba con receta','ANTIBIOTICO','Amoxicilina',15,25,true),
    ('DEMO-SUERO','Suero oral','Sobre de prueba','HIDRATACION','Sales de rehidratación',2,5,false),
    ('DEMO-IBU','Ibuprofeno 400 mg','Caja ficticia de 10 tabletas','ANALGESICO','Ibuprofeno',8,16,false),
    ('DEMO-LORA','Loratadina 10 mg','Caja ficticia de 10 tabletas','ANTIALERGICO','Loratadina',7,14,false),
    ('DEMO-CETI','Cetirizina 10 mg','Caja ficticia de 10 tabletas','ANTIALERGICO','Cetirizina',9,18,false),
    ('DEMO-OME','Omeprazol 20 mg','Caja ficticia de 14 cápsulas','GASTROINTESTINAL','Omeprazol',12,24,false),
    ('DEMO-ANTI','Antiácido suspensión','Frasco ficticio de 120 ml','GASTROINTESTINAL','Hidróxido de aluminio y magnesio',14,28,false),
    ('DEMO-VITC','Vitamina C 500 mg','Frasco ficticio de 30 tabletas','SUPLEMENTO','Ácido ascórbico',18,35,false),
    ('DEMO-SALB','Salbutamol inhalador','Inhalador ficticio de prueba','RESPIRATORIO','Salbutamol',35,65,true),
    ('DEMO-LOSA','Losartán 50 mg','Caja ficticia de 30 tabletas','CARDIOVASCULAR','Losartán',22,44,true),
    ('DEMO-CREMA','Crema de hidrocortisona','Tubo ficticio sin stock para probar disponibilidad','DERMATOLOGICO','Hidrocortisona',11,22,true)
  on conflict(codigo) do nothing;

  -- Cada fila indica el stock inicial de Guatemala, Mixco y Xela.
  -- Cero permite probar productos agotados. No genera una entrada de cero.
  with cantidades(codigo,guatemala,mixco,xela) as (values
    ('DEMO-PARA',100,100,100), ('DEMO-AMOX',100,100,100), ('DEMO-SUERO',100,100,100),
    ('DEMO-IBU',80,25,0), ('DEMO-LORA',45,12,30), ('DEMO-CETI',0,35,8),
    ('DEMO-OME',60,18,5), ('DEMO-ANTI',15,0,22), ('DEMO-VITC',75,30,0),
    ('DEMO-SALB',12,4,0), ('DEMO-LOSA',20,0,0), ('DEMO-CREMA',0,0,0)
  ), nuevos as (
    insert into public.inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad)
    select s.id_sucursal,m.id_medicamento,'DEMO-LOTE-A',current_date+180,m.precio_compra,
      case s.codigo when 'DEMO-GUA' then c.guatemala when 'DEMO-MIX' then c.mixco else c.xela end
    from cantidades c join public.medicamentos m on m.codigo=c.codigo
      cross join public.sucursales s where s.codigo in ('DEMO-GUA','DEMO-MIX','DEMO-XELA')
    order by s.id_sucursal,m.id_medicamento
    on conflict(id_sucursal,id_medicamento,lote) do nothing returning *
  ) insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo)
    select id_inventario,id_sucursal,'ENTRADA',cantidad,'Carga inicial DEMO' from nuevos where cantidad>0;

  -- Un segundo lote permite probar la salida por vencimiento (FEFO).
  with nuevos as (
    insert into public.inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad)
    select s.id_sucursal,m.id_medicamento,'DEMO-LOTE-B',current_date+365,m.precio_compra,50
    from public.sucursales s cross join public.medicamentos m
    where s.codigo='DEMO-GUA' and m.codigo='DEMO-PARA'
    on conflict(id_sucursal,id_medicamento,lote) do nothing returning *
  ) insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo)
    select id_inventario,id_sucursal,'ENTRADA',cantidad,'Carga inicial DEMO' from nuevos;

  insert into public.stock_minimos(id_sucursal,id_medicamento,stock_minimo)
  select s.id_sucursal,m.id_medicamento,20
  from public.sucursales s cross join public.medicamentos m
  where s.codigo in ('DEMO-GUA','DEMO-MIX','DEMO-XELA')
    and m.codigo in ('DEMO-PARA','DEMO-AMOX','DEMO-SUERO','DEMO-IBU','DEMO-LORA','DEMO-CETI',
      'DEMO-OME','DEMO-ANTI','DEMO-VITC','DEMO-SALB','DEMO-LOSA','DEMO-CREMA')
  on conflict(id_sucursal,id_medicamento) do nothing;
end $$;
revoke all on function privado.cargar_catalogo_demo() from public;
-- Esta migración incorpora los nuevos datos en bases existentes y nuevas.
select privado.cargar_catalogo_demo();
commit;
