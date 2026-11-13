-- Un medicamento diferente y un lote inicial por sucursal, datos ficticios.
begin;
lock table public.medicamentos,public.inventario,public.stock_minimos in share row exclusive mode;
create temporary table carga_exclusivos on commit drop as
with tipos(sucursal,sufijo,nombre,categoria,principio,compra,venta,receta,imagen_url) as (values
 ('GUA01','CETI10','Cetirizina 10 mg','ANTIALERGICO','Cetirizina',9.00,18.00,false,'https://walmartgt.vteximg.com.br/arquivos/ids/288367/Alersone-10-Mg-10-Tabletas-1-32451.jpg?v=637935080079130000'),
 ('MIX01','VITC500','Vitamina C 500 mg','SUPLEMENTO','Ácido ascórbico',18.00,35.00,false,'https://walmartgt.vteximg.com.br/arquivos/ids/984909/tabletas-masticables-cebion-vitamina-c-sabor-mandarina-500-mg-7702418004863.jpg?v=639123042405370000'),
 ('XELA01','ANTI120','Antiácido suspensión 120 ml','GASTROINTESTINAL','Hidróxido de aluminio y magnesio',14.00,28.00,false,'https://farmaciauniversalpe.vteximg.com.br/arquivos/ids/164217/16867_1.jpg?v=638986518626400000'),
 ('PET01','LOSA50','Losartán 50 mg','CARDIOVASCULAR','Losartán',22.00,44.00,true,'https://walmartgt.vteximg.com.br/arquivos/ids/291234/Losartan-Mk-50-Mg-20-Tabletas-1-32827.jpg?v=637955915595430000'),
 ('JUT01','SALB100','Salbutamol inhalador 100 mcg','RESPIRATORIO','Salbutamol',35.00,65.00,true,'https://walmartgt.vteximg.com.br/arquivos/ids/356407/Inhalador-Salbutamol-17gr-100mcg-1-56558.jpg?v=638170943568300000')
)
select t.*,s.id_sucursal,p.id_proveedor,t.sucursal||'-MED-'||t.sufijo||'-01' codigo
from tipos t join public.sucursales s on s.codigo=t.sucursal
join public.proveedores p on p.email=lower(t.sucursal)||'-proveedor-04@example.com';

do $$ begin
 if (select count(*) from carga_exclusivos)<>5 then raise exception 'Falta alguna sucursal o proveedor inicial'; end if;
end $$;

insert into public.medicamentos(codigo,nombre,descripcion,categoria,principio_activo,precio_compra,precio_venta,requiere_receta,estado,id_proveedor,imagen_url)
select codigo,nombre||' · '||sucursal,
 'Producto ficticio con stock inicial exclusivo en '||sucursal||'. Unidad: un empaque comercial. Precios, presentación y vencimiento simulados; fotografía referencial. Confirmar requisitos de dispensación antes de uso real.',
 categoria,principio,compra,venta,receta,'ACTIVO',id_proveedor,imagen_url
from carga_exclusivos on conflict(codigo) do nothing;

with nuevos as (
 insert into public.inventario(id_sucursal,id_medicamento,lote,fecha_vencimiento,costo_unitario,cantidad,reservado)
 select c.id_sucursal,m.id_medicamento,c.sucursal||'-LOTE-'||c.sufijo||'-20261113',date '2028-11-30',c.compra,25,0
 from carga_exclusivos c join public.medicamentos m on m.codigo=c.codigo
 on conflict(id_sucursal,id_medicamento,lote) do nothing
 returning id_inventario,id_sucursal,cantidad
)
insert into public.movimientos_medicamentos(id_inventario,id_sucursal,tipo,cantidad,motivo)
select id_inventario,id_sucursal,'ENTRADA',cantidad,'Carga inicial ficticia de medicamento exclusivo por sucursal' from nuevos;

insert into public.stock_minimos(id_sucursal,id_medicamento,stock_minimo)
select c.id_sucursal,m.id_medicamento,10 from carga_exclusivos c join public.medicamentos m on m.codigo=c.codigo
on conflict(id_sucursal,id_medicamento) do nothing;

do $$ begin
 if (select count(*) from carga_exclusivos c join public.medicamentos m on m.codigo=c.codigo
     join public.inventario i on i.id_medicamento=m.id_medicamento and i.id_sucursal=c.id_sucursal
     and i.lote=c.sucursal||'-LOTE-'||c.sufijo||'-20261113')<>5 then
  raise exception 'No se completaron los cinco medicamentos exclusivos';
 end if;
end $$;
select public.generar_alertas_inventario();
commit;
