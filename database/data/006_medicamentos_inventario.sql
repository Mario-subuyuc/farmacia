-- Medicamentos y existencias ficticias. Carga inicial manual, sin pagos ni compras.
begin;
lock table public.medicamentos,public.inventario,public.stock_minimos in share row exclusive mode;
create temporary table carga_medicamentos on commit drop as
with tipos(numero,sufijo,nombre,categoria,principio,compra,venta,stock,imagen_url) as (values
 (1,'PARA500','Paracetamol 500 mg','ANALGESICO','Paracetamol',5.00,10.00,20,'https://walmartgt.vteximg.com.br/arquivos/ids/859333/95004_01.jpg?v=638905248408630000'),
 (2,'IBU400','Ibuprofeno 400 mg','ANALGESICO','Ibuprofeno',8.00,16.00,22,'https://cdn.shopify.com/s/files/1/0368/1363/5716/files/7703763270620.jpg?v=1794544612'),
 (3,'LORA10','Loratadina 10 mg','ANTIALERGICO','Loratadina',7.00,14.00,25,'https://walmartgt.vteximg.com.br/arquivos/ids/327207/Loratadina-Luveck-10Mg-10-Comprimidos-1-40527.jpg?v=638052898334970000'),
 (4,'OME20','Omeprazol 20 mg','GASTROINTESTINAL','Omeprazol',12.00,24.00,28,'https://cdn.shopify.com/s/files/1/0368/1363/5716/files/7798032937205.jpg?v=1794544100'),
 (5,'SUERO','Suero oral','HIDRATACION','Sales de rehidratación oral',2.00,5.00,30,'https://walmartgt.vteximg.com.br/arquivos/ids/807434/93455_01.jpg?v=638820819168330000')
)
select s.id_sucursal,s.codigo sucursal,t.*,p.id_proveedor,
 'MED-'||t.sufijo||'-01' codigo
from public.sucursales s cross join tipos t
join public.proveedores p on p.email=lower(s.codigo)||'-proveedor-'||lpad((((t.numero-1)%4)+1)::text,2,'0')||'@example.com'
where s.codigo in ('GUA01','MIX01','XELA01','PET01','JUT01');

do $$ begin
 if (select count(*) from carga_medicamentos)<>25 then raise exception 'Se requieren cinco sucursales y sus proveedores iniciales'; end if;
end $$;

insert into public.medicamentos(codigo,nombre,descripcion,categoria,principio_activo,precio_compra,precio_venta,requiere_receta,estado,id_proveedor,imagen_url)
select distinct on (codigo) codigo,nombre,
 'Producto ficticio de referencia. Unidad de inventario: un empaque comercial; en suero, un sobre. Precios y presentación simulados. Fotografía referencial; confirmar marca, empaque y requisitos de dispensación antes de uso real.',
 categoria,principio,compra,venta,false,'ACTIVO',id_proveedor,imagen_url
from carga_medicamentos order by codigo,sucursal on conflict(codigo) do nothing;

with nuevos as (
 insert into public.inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad,reservado)
 select c.id_sucursal,m.id_medicamento,c.sucursal||'-LOTE-'||c.sufijo||'-20261113',date '2028-11-30',c.compra,c.stock,0
 from carga_medicamentos c join public.medicamentos m on m.codigo=c.codigo
 on conflict(id_sucursal,id_medicamento,lote) do nothing
 returning id_inventario,id_sucursal,cantidad
)
insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo)
select id_inventario,id_sucursal,'ENTRADA',cantidad,'Carga inicial ficticia solicitada por administrador: existencias de referencia'
from nuevos;

insert into public.stock_minimos(id_sucursal,id_medicamento,stock_minimo)
select c.id_sucursal,m.id_medicamento,10 from carga_medicamentos c join public.medicamentos m on m.codigo=c.codigo
on conflict(id_sucursal,id_medicamento) do nothing;

do $$ begin
 if (select count(*) from carga_medicamentos c join public.medicamentos m on m.codigo=c.codigo
     join public.inventario i on i.id_medicamento=m.id_medicamento and i.id_sucursal=c.id_sucursal
     and i.lote=c.sucursal||'-LOTE-'||c.sufijo||'-20261113')<>25 then
  raise exception 'No se completaron los veinticinco productos y lotes esperados';
 end if;
end $$;
select public.generar_alertas_inventario();
commit;
