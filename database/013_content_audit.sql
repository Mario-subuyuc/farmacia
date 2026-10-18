begin;
insert into public.contenidos(tipo,titulo,cuerpo,orden)
select 'FAQ',v.titulo,v.cuerpo,v.orden from (values
 ('¿Necesito una cuenta para comprar?','No. Puedes preparar tu carrito y confirmar un pedido sin registrarte. Guarda tu código privado para consultar su estado.',5),
 ('¿Cómo sé si hay existencias?','Consulta la disponibilidad por sucursal en el catálogo. Al revisar el total y confirmar se vuelve a comprobar el inventario; la reserva se realiza al confirmar, no al agregar al carrito.',6),
 ('¿Dónde realizan entregas?','La cobertura depende del radio y horario de la sucursal. Introduce una dirección completa y verifica las coordenadas antes de revisar el total. El costo de envío aparece antes de confirmar.',7),
 ('¿Qué pasa si no confirmo mi compra?','El carrito no reserva inventario. Los pedidos confirmados que siguen pendientes de preparación vencen a las dos horas; los productos reservados se liberan automáticamente.',8),
 ('¿Las fotografías muestran el empaque que recibiré?','Las imágenes son referencias. Revisa nombre, presentación y dosis en el catálogo, y consulta con la farmacia si necesitas confirmar una marca o empaque específico.',9)
) v(titulo,cuerpo,orden) where not exists(select 1 from public.contenidos c where c.tipo='FAQ' and c.titulo=v.titulo);
create trigger historial after insert or update or delete on public.contenidos for each row execute function privado.auditar('id_contenido');
create trigger historial after insert or update or delete on public.cupones for each row execute function privado.auditar('id_cupon');
commit;
