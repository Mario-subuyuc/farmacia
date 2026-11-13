# Activos fijos iniciales

Carga del 13 de noviembre de 2026: 15 activos por sucursal y 75 en total. Códigos: `GUA01`, `MIX01`, `XELA01`, `PET01` y `JUT01`, seguidos del tipo y número de dos dígitos. Ejemplo: `XELA01-SILLA-01`; nombre visible: `Silla 01 · XELA01`.

| Tipo | Cantidad por sucursal | Valor unitario simulado | Vida útil simulada |
|---|---:|---:|---:|
| Silla | 3 | Q350.00 | 60 meses |
| Computadora | 2 | Q4,500.00 | 36 meses |
| Equipo POS | 2 | Q1,800.00 | 60 meses |
| Mostrador | 2 | Q3,500.00 | 120 meses |
| Refrigerador | 2 | Q6,000.00 | 96 meses |
| Estantería | 4 | Q1,500.00 | 120 meses |

Valor total de referencia: Q38,650.00 por sucursal y Q193,250.00 para las cinco. Todos tienen estado `ACTIVO`, fecha de adquisición ficticia `2026-11-13` y valor residual simulado del 10 %.

Estos valores son datos ficticios de prueba, no cotizaciones comerciales, facturas ni parámetros fiscales. Las vidas útiles son supuestos para ejercitar el cálculo de depreciación del portal. El registro de refrigeradores no acredita características técnicas para conservar medicamentos.

La carga manual `database/data/003_activos_fijos.sql` no crea compras ni movimientos de caja. Conserva los registros existentes con el mismo código y evita duplicados al repetirla. La tabla y las relaciones originales se mantienen.
