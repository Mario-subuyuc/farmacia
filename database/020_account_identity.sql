begin;

-- Solo administradores activos pueden consultar la identidad de las cuentas.
-- La vista no expone contraseñas, tokens ni otros datos privados de auth.users.
create view public.cuentas_personal with (security_barrier = true) as
select p.*, u.email,
       coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
                nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')) as nombre
from public.perfiles p
join auth.users u on u.id = p.id_usuario
where privado.permitido(array['ADMIN']::text[]);

revoke all on public.cuentas_personal from public, anon, authenticated;
grant select on public.cuentas_personal to authenticated;

commit;
