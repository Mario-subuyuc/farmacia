begin;
alter table public.empleados add column id_usuario uuid unique references public.perfiles(id_usuario) on delete set null;

create function privado.validar_cuenta_empleado() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.id_usuario is not null and not exists(
  select 1 from public.perfiles p where p.id_usuario=new.id_usuario
   and (p.id_sucursal=new.id_sucursal or (p.rol='ADMIN' and p.id_sucursal is null and privado.permitido(array['ADMIN'])))
 ) then raise exception 'La cuenta del empleado debe pertenecer a la misma sucursal' using errcode='23514'; end if;
 return new;
end; $$;
create trigger validar_cuenta before insert or update of id_usuario,id_sucursal on public.empleados
for each row execute function privado.validar_cuenta_empleado();

create view public.cuentas_empleados with (security_barrier=true) as
select p.id_usuario,p.id_sucursal,p.rol,
 coalesce(nullif(trim(u.raw_user_meta_data->>'username'),''),u.email) as nombre,u.email
from public.perfiles p join auth.users u on u.id=p.id_usuario
where (p.id_sucursal is not null and privado.permitido(array['GERENTE','AUDITOR'],p.id_sucursal))
 or privado.permitido(array['ADMIN']);

create view public.empleados_cuentas with (security_barrier=true) as
select e.*,coalesce(nullif(trim(u.raw_user_meta_data->>'username'),''),u.email) as usuario_cuenta
from public.empleados e left join auth.users u on u.id=e.id_usuario
where privado.permitido(array['GERENTE','AUDITOR'],e.id_sucursal);

revoke all on public.cuentas_empleados,public.empleados_cuentas from public,anon,authenticated;
grant select on public.cuentas_empleados,public.empleados_cuentas to authenticated;
commit;
