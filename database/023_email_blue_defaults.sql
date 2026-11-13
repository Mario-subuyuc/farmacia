begin;
alter table public.plantillas_correo alter column color_principal set default '#123e54';
alter table public.plantillas_correo alter column color_fondo set default '#f3f8fc';
-- Actualiza solo los colores originales; conserva las personalizaciones.
update public.plantillas_correo set
 color_principal=case when lower(color_principal)='#225e4e' then '#123e54' else color_principal end,
 color_fondo=case when lower(color_fondo)='#f0f4ee' then '#f3f8fc' else color_fondo end
where lower(color_principal)='#225e4e' or lower(color_fondo)='#f0f4ee';
commit;
