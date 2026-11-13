# Datos iniciales: sucursales

La carga manual `database/data/001_sucursales.sql` registra únicamente la configuración de sucursales acordada el 13 de noviembre de 2026. No inserta usuarios, proveedores, medicamentos ni inventario.

| Código | Nombre | Departamento | Días | Horas (Guatemala) |
|---|---|---|---|---|
| GUA01 | Farmacia Guatemala | Guatemala | Todos | 24 horas |
| MIX01 | Farmacia Mixco | Guatemala | Todos | 24 horas |
| XELA01 | Farmacia Xela | Quetzaltenango | Todos | 24 horas |
| PET01 | Farmacia Petén | Petén | Lunes a viernes | 06:00–18:00 |
| JUT01 | Farmacia Jutiapa | Jutiapa | Sábado y domingo | 06:00–18:00 |

Los identificadores y asignaciones de usuarios de las tres sucursales existentes se conservan. Los códigos permiten distinguir las sucursales sin depender del número interno.

Los campos `apertura`, `cierre` y `dias_entrega` se usan para el horario de pedidos del portal. Los días siguen ISO: 1 es lunes y 7 domingo.

Las direcciones y coordenadas nuevas son referencias para datos de prueba, no ubicaciones verificadas de locales. Los teléfonos nuevos quedan vacíos hasta contar con datos reales. Las direcciones y teléfonos anteriores todavía son los datos demo conservados. Confirmar estos datos y los costos de envío antes de operar entregas reales.

No ejecutar el seeder demo anterior para continuar la carga. La configuraci?n de usuarios se describe a continuaci?n.

## Usuarios por sucursal

Se configuran seis cuentas por sucursal: `gerente`, `vendedor`, `bodega`, `cajero`, `callcenter` y `auditor`. El usuario sigue el formato `rol-codigo`, por ejemplo `gerente-xela01`, y el correo de prueba es `gerente-xela01@example.com`. Son direcciones de prueba sin bandeja de correo.

Se conserva como ?nica cuenta administradora la indicada por el propietario del proyecto. Las contrase?as no se incluyen en el repositorio: el listado de acceso queda en `backups/usuarios-sucursales-2026-11-13.csv`, excluido de Git.

La asignaci?n de sucursal no cambia las reglas de acceso actuales de cada rol. En particular, auditor y call center conservan sus capacidades de consulta entre sucursales previstas en las pol?ticas existentes.
