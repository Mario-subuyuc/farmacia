# Medicamentos e inventario inicial

Carga del 13 de noviembre de 2026: 25 registros de medicamento, cinco por cada sucursal de referencia (`GUA01`, `MIX01`, `XELA01`, `PET01` y `JUT01`). Un lote por producto en su sucursal, 25 lotes y 625 unidades en total.

| Medicamento | Sufijo del código | Stock por sucursal | Costo simulado | Venta simulada |
|---|---|---:|---:|---:|
| Paracetamol 500 mg | MED-PARA500-01 | 20 | Q5.00 | Q10.00 |
| Ibuprofeno 400 mg | MED-IBU400-01 | 22 | Q8.00 | Q16.00 |
| Loratadina 10 mg | MED-LORA10-01 | 25 | Q7.00 | Q14.00 |
| Omeprazol 20 mg | MED-OME20-01 | 28 | Q12.00 | Q24.00 |
| Suero oral | MED-SUERO-01 | 30 | Q2.00 | Q5.00 |

Ejemplo: `XELA01-MED-PARA500-01`, con nombre `Paracetamol 500 mg · XELA01` y lote `XELA01-LOTE-PARA500-20261113`. La tabla de medicamentos es compartida; para este conjunto se usan códigos separados por sucursal conforme a la nomenclatura solicitada. La existencia efectiva depende de la tabla de inventario y puede trasladarse mediante las operaciones del portal.

Cada sucursal recibe 125 unidades. La unidad simulada es un empaque comercial o un sobre de suero; no se cuentan tabletas individuales dentro del empaque. Las presentaciones, concentraciones, marcas y precios deben verificarse contra los productos reales antes de operar comercialmente.

Todos están activos, sin promociones, sin reservas y con mínimo de reposición de 10 unidades. La fecha de vencimiento ficticia es `2028-11-30`. El indicador de receta se deja en `false` exclusivamente para estos datos de prueba; no representa una clasificación sanitaria real.

Los proveedores se asignan del 01 al 04 de la misma sucursal de referencia; el quinto medicamento usa el proveedor 01. Las fotografías son URL externas ya seleccionadas; sus fuentes están en `imagenes-medicamentos.md`. Pueden mostrar otra marca o cantidad de empaque.

La carga manual `database/data/006_medicamentos_inventario.sql` registra movimientos de entrada para los lotes nuevos, recalcula alertas y no genera compras ni movimientos de caja. Repetirla conserva medicamentos, lotes y mínimos existentes sin reponer stock consumido ni duplicar entradas.

## Medicamentos adicionales exclusivos

La carga `database/data/007_medicamentos_exclusivos.sql` agrega un producto diferente por sucursal, con 25 unidades, mínimo de 10 y vencimiento ficticio `2028-11-30`.

| Sucursal | Medicamento | Código |
|---|---|---|
| Guatemala | Cetirizina 10 mg | GUA01-MED-CETI10-01 |
| Mixco | Vitamina C 500 mg | MIX01-MED-VITC500-01 |
| Xela | Antiácido suspensión 120 ml | XELA01-MED-ANTI120-01 |
| Petén | Losartán 50 mg | PET01-MED-LOSA50-01 |
| Jutiapa | Salbutamol inhalador 100 mcg | JUT01-MED-SALB100-01 |

Ahora son 30 registros, seis medicamentos y 150 unidades por sucursal, 750 unidades en total. Los medicamentos adicionales tienen stock únicamente en su sucursal de referencia; esto no impide futuros traslados autorizados. Se asigna el proveedor 04 de cada sucursal. Losartán y salbutamol tienen el indicador de receta activado para probar ese flujo; estos datos no sustituyen la validación sanitaria del producto real. Se registran entradas de inventario, sin generar compras ni egresos de caja.
