# Clientes iniciales

Carga del 13 de noviembre de 2026: 20 clientes ficticios, cuatro por código de sucursal (`GUA01`, `MIX01`, `XELA01`, `PET01` y `JUT01`). Formato: `XELA01-CLIENTE-01` hasta `XELA01-CLIENTE-04`, equivalente en las otras sucursales.

Los nombres y direcciones son ficticios. Los correos usan `example.com` y los teléfonos comienzan con `0000`, sin contacto operativo. No se generaron cuentas de acceso, ventas, pedidos ni pagos.

La tabla de clientes se comparte entre toda la red y no tiene una columna de sucursal. El código indica la agrupación de referencia para este conjunto de datos, no una restricción: el cliente puede comprar en cualquier sucursal. Las ventas y pedidos identifican la sucursal que atiende cada transacción.

La carga manual `database/data/004_clientes.sql` conserva los registros existentes con el mismo código y evita duplicados al repetirse. El listado de Clientes muestra el código para facilitar su identificación y búsqueda.
