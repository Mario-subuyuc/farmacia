begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('catalogo','catalogo',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy catalogo_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='catalogo' and exists(select 1 from public.perfiles where id_usuario=auth.uid() and activo and rol='ADMIN'));
create policy catalogo_admin_delete on storage.objects for delete to authenticated
using (bucket_id='catalogo' and exists(select 1 from public.perfiles where id_usuario=auth.uid() and activo and rol='ADMIN'));
create policy catalogo_admin_select on storage.objects for select to authenticated
using (bucket_id='catalogo' and exists(select 1 from public.perfiles where id_usuario=auth.uid() and activo and rol='ADMIN'));
commit;
