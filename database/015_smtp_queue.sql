begin;
alter table public.alertas_inventario add column correo_estado text not null default 'PENDIENTE',add column intentos integer not null default 0,add column proximo_intento timestamptz not null default now();
create function public.tomar_correos(p_destino text default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare resultado jsonb:='[]';r record;
begin
 for r in with pendientes as(select id_notificacion from public.notificaciones where intentos<5 and estado in ('PENDIENTE','ENVIANDO') and proximo_intento<=now() order by id_notificacion for update skip locked limit 10)
 update public.notificaciones n set estado='ENVIANDO',intentos=intentos+1,proximo_intento=now()+interval '5 minutes' from pendientes p where n.id_notificacion=p.id_notificacion returning n.* loop
 resultado:=resultado||jsonb_build_array(jsonb_build_object('tipo','PEDIDO','id',r.id_notificacion,'destino',r.destino,'evento',r.evento,'mensaje','Tu pedido #'||r.id_pedido||' tiene una actualización: '||replace(r.evento,'_',' ')||'. Consulta el seguimiento con tu código privado.'));
 end loop;
 if p_destino is not null then
 for r in with pendientes as(select id_alerta from public.alertas_inventario where estado='ACTIVA' and intentos<5 and correo_estado in ('PENDIENTE','ENVIANDO') and proximo_intento<=now() order by id_alerta for update skip locked limit 10)
 update public.alertas_inventario a set correo_estado='ENVIANDO',intentos=intentos+1,proximo_intento=now()+interval '5 minutes' from pendientes p where a.id_alerta=p.id_alerta returning a.* loop
 resultado:=resultado||jsonb_build_array(jsonb_build_object('tipo','ALERTA','id',r.id_alerta,'destino',p_destino,'evento',r.tipo,'mensaje','Alerta de inventario de la sucursal #'||r.id_sucursal||': '||r.mensaje||'. Revisa el panel Alertas de inventario y coordina con tus proveedores.'));
 end loop;end if;return resultado;
end $$;
create function public.cerrar_correo(p_tipo text,p_id bigint,p_ok boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_tipo='PEDIDO' then update public.notificaciones set estado=case when p_ok then 'ENVIADO' when intentos>=5 then 'ERROR' else 'PENDIENTE' end,proximo_intento=now()+interval '15 minutes',ultimo_error=case when p_ok then null else 'SMTP no confirmó la entrega' end where id_notificacion=p_id and estado='ENVIANDO';
 elsif p_tipo='ALERTA' then update public.alertas_inventario set correo_estado=case when p_ok then 'ENVIADO' when intentos>=5 then 'ERROR' else 'PENDIENTE' end,enviado_en=case when p_ok then now() else enviado_en end,proximo_intento=now()+interval '15 minutes' where id_alerta=p_id and correo_estado='ENVIANDO';end if;
end $$;
revoke all on function public.tomar_correos(text),public.cerrar_correo(text,bigint,boolean) from public,anon,authenticated;
grant execute on function public.tomar_correos(text),public.cerrar_correo(text,bigint,boolean) to service_role;
commit;
