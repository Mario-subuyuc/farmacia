begin;

create view public.autorizaciones_personal with (security_barrier = true) as
select p.*, c.nombre, c.email
from public.permisos_operativos p
join public.cuentas_personal c using (id_usuario)
where privado.permitido(array['ADMIN']::text[]);

revoke all on public.autorizaciones_personal from public, anon, authenticated;
grant select on public.autorizaciones_personal to authenticated;

commit;
