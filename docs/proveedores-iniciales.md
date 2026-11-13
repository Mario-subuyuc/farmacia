# Proveedores iniciales

Carga del 13 de noviembre de 2026: 20 proveedores ficticios, cuatro por sucursal de referencia (`GUA01`, `MIX01`, `XELA01`, `PET01` y `JUT01`).

La tabla no tiene un campo `codigo`. La nomenclatura forma parte del nombre visible: `XELA01-PROVEEDOR-01 · Distribuidora Salud Integral`.

| Número | Empresa ficticia |
|---|---|
| 01 | Distribuidora Salud Integral |
| 02 | Suministros Farma Norte |
| 03 | Droguería Bienestar |
| 04 | Distribuidora Medisalud |

Los cuatro nombres se repiten con el prefijo de cada sucursal, como registros independientes. Todos están activos. Las personas de contacto y direcciones son ficticias; los correos usan `example.com` y los teléfonos comienzan con `0000`, sin contacto operativo.

Los proveedores se comparten en toda la red. El prefijo agrupa los datos de referencia; no restringe qué sucursal puede comprarles. La sucursal de cada compra se registra en la operación correspondiente.

La carga manual `database/data/005_proveedores.sql` conserva los registros existentes con exactamente el mismo nombre, evita duplicados al repetirse y no crea compras, productos, usuarios ni movimientos de caja.
