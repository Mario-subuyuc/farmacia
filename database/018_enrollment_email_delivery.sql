begin;

-- Selecciona como máximo un correo del token vigente y la etapa solicitada.
create function public.tomar_correo_inscripcion(p_hash text,p_evento text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r privado.correos_eventos;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_evento is null or
    p_evento not in ('CONFIRMAR_INSCRIPCION','INSCRIPCION_CONFIRMADA') then
  raise exception 'Selección de correo inválida' using errcode='22023';
 end if;
 with pendiente as (
  select c.id from privado.correos_eventos c
  join public.inscripciones i using(id_inscripcion)
  join public.eventos e using(id_evento)
  where i.token_hash=p_hash and c.evento=p_evento
   and c.clave=(case p_evento when 'CONFIRMAR_INSCRIPCION' then 'CONFIRMAR-' else 'INSCRITO-' end)||i.id_inscripcion||'-'||i.token_hash
   and c.intentos<5 and c.estado in ('PENDIENTE','ENVIANDO') and c.proximo_intento<=now()
   and e.publicado and e.inicio>now()
   and ((p_evento='CONFIRMAR_INSCRIPCION' and i.estado='PENDIENTE' and i.expira_en>now())
    or (p_evento='INSCRIPCION_CONFIRMADA' and i.estado='CONFIRMADA'))
  order by c.id for update of c skip locked limit 1
 )
 update privado.correos_eventos c set estado='ENVIANDO',intentos=intentos+1,
  proximo_intento=now()+interval '5 minutes'
 from pendiente p where c.id=p.id returning c.* into r;
 if not found then return '[]'::jsonb;end if;
 return jsonb_build_array(jsonb_build_object('tipo','EVENTO','id',r.id,'intento',r.intentos,
  'destino',r.destino,'evento',r.evento,'mensaje',r.cuerpo,'action_url',r.action_url));
end $$;

-- El intento es la versión del arrendamiento: un proceso atrasado no puede
-- cerrar una fila que otro proceso ya volvió a reclamar.
create function public.cerrar_correo_inscripcion(p_id bigint,p_intento integer,p_ok boolean) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update privado.correos_eventos set
  estado=case when p_ok then 'ENVIADO' when intentos>=5 then 'ERROR' else 'PENDIENTE' end,
  proximo_intento=now()+interval '15 minutes'
 where id=p_id and estado='ENVIANDO' and intentos=p_intento;
 return found;
end $$;

revoke all on function public.tomar_correo_inscripcion(text,text),public.cerrar_correo_inscripcion(bigint,integer,boolean) from public,anon,authenticated;
grant execute on function public.tomar_correo_inscripcion(text,text),public.cerrar_correo_inscripcion(bigint,integer,boolean) to service_role;

-- Conserva la API general para pedidos, alertas y recordatorios, excluyendo
-- correos antiguos cuyo token ya fue sustituido en la inscripción.
do $$ declare d text;begin
 d:=pg_get_functiondef('public.tomar_correos(text)'::regprocedure);
 if position('order by c.id for update of c skip locked limit 10' in d)=0 then
  raise exception 'La definición de tomar_correos no coincide con la migración 016';
 end if;
 d:=replace(d,'order by c.id for update of c skip locked limit 10',
  'and (c.evento not in (''CONFIRMAR_INSCRIPCION'',''INSCRIPCION_CONFIRMADA'') or c.clave=(case c.evento when ''CONFIRMAR_INSCRIPCION'' then ''CONFIRMAR-'' else ''INSCRITO-'' end)||i.id_inscripcion||''-''||i.token_hash) order by c.id for update of c skip locked limit 10');
 d:=replace(d,'''action_url'',r.action_url','''action_url'',r.action_url,''intento'',r.intentos');
 execute d;
end $$;
commit;
