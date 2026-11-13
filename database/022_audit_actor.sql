begin;

-- Conserva el alcance de la política de lectura de auditoría.
create view public.auditoria_usuarios with (security_barrier = true) as
select a.*, coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
                     nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                     u.email) as actor_usuario
from public.auditoria a
left join auth.users u on u.id = a.actor
where (a.id_sucursal is not null and privado.permitido(array['GERENTE','AUDITOR'],a.id_sucursal))
   or (a.antes->>'id_sucursal' is not null and privado.permitido(array['GERENTE','AUDITOR'],(a.antes->>'id_sucursal')::bigint))
   or privado.permitido(array['AUDITOR']);

revoke all on public.auditoria_usuarios from public, anon, authenticated;
grant select on public.auditoria_usuarios to authenticated;

commit;
