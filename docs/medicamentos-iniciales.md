# Medicamentos e inventario inicial

Carga del 13 de noviembre de 2026: cinco medicamentos comunes con inventario en cada sucursal (`GUA01`, `MIX01`, `XELA01`, `PET01` y `JUT01`). Un lote por producto y sucursal, 25 lotes y 625 unidades iniciales en total.

| Medicamento | Sufijo del código | Stock por sucursal | Costo simulado | Venta simulada |
|---|---|---:|---:|---:|
| Paracetamol 500 mg | MED-PARA500-01 | 20 | Q5.00 | Q10.00 |
| Ibuprofeno 400 mg | MED-IBU400-01 | 22 | Q8.00 | Q16.00 |
| Loratadina 10 mg | MED-LORA10-01 | 25 | Q7.00 | Q14.00 |
| Omeprazol 20 mg | MED-OME20-01 | 28 | Q12.00 | Q24.00 |
| Suero oral | MED-SUERO-01 | 30 | Q2.00 | Q5.00 |

Ejemplo actual: código compartido `MED-PARA500-01`, nombre `Paracetamol 500 mg` y lote por sucursal `XELA01-LOTE-PARA500-20261113`. La tabla de medicamentos es compartida; la sucursal se identifica en inventario, no en el nombre del producto. La existencia efectiva puede trasladarse mediante las operaciones del portal.

Cada sucursal recibe 125 unidades. La unidad simulada es un empaque comercial o un sobre de suero; no se cuentan tabletas individuales dentro del empaque. Las presentaciones, concentraciones, marcas y precios deben verificarse contra los productos reales antes de operar comercialmente.

Todos están activos, sin promociones, sin reservas y con mínimo de reposición de 10 unidades. La fecha de vencimiento ficticia es `2028-11-30`. El indicador de receta se deja en `false` exclusivamente para estos datos de prueba; no representa una clasificación sanitaria real.

Los cinco medicamentos comunes conservan como proveedor principal el de sus registros originales de Guatemala; cada compra puede utilizar otro proveedor de la red. Los productos exclusivos conservan su proveedor original. Las fotografías son URL externas ya seleccionadas; sus fuentes están en `imagenes-medicamentos.md`. Pueden mostrar otra marca o cantidad de empaque.

La carga manual `database/data/006_medicamentos_inventario.sql` registra movimientos de entrada para los lotes nuevos, recalcula alertas y no genera compras ni movimientos de caja. Repetirla conserva medicamentos, lotes y mínimos existentes sin reponer stock consumido ni duplicar entradas.

## Medicamentos adicionales exclusivos

La carga `database/data/007_medicamentos_exclusivos.sql` agrega un producto diferente por sucursal, con 25 unidades, mínimo de 10 y vencimiento ficticio `2028-11-30`.

| Sucursal | Medicamento | Código |
|---|---|---|
| Guatemala | Cetirizina 10 mg | MED-CETI10-01 |
| Mixco | Vitamina C 500 mg | MED-VITC500-01 |
| Xela | Antiácido suspensión 120 ml | MED-ANTI120-01 |
| Petén | Losartán 50 mg | MED-LOSA50-01 |
| Jutiapa | Salbutamol inhalador 100 mcg | MED-SALB100-01 |

Ahora son diez productos en el catálogo compartido, seis medicamentos y 150 unidades por sucursal, 750 unidades en total. Los medicamentos adicionales tienen stock únicamente en su sucursal de referencia; esto no impide futuros traslados autorizados. Se asigna el proveedor 04 de cada sucursal. Losartán y salbutamol tienen el indicador de receta activado para probar ese flujo; estos datos no sustituyen la validación sanitaria del producto real. Se registran entradas de inventario, sin generar compras ni egresos de caja.

La migración `026_unify_initial_medicines.sql` corrige los treinta registros anteriores, que estaban separados por sucursal, y los unifica en diez productos sin sufijos de sucursal. Conserva los treinta lotes, cantidades, reservas, mínimos y referencias operativas; no agrupa productos arbitrarios por similitud de nombre. Las cargas manuales 006 y 007 también utilizan los códigos compartidos para evitar recrear duplicados.

Durante la unificación se conservó la promoción existente del 10 % de suero oral en el producto compartido; desde entonces se aplica al mismo producto de toda la red. Si hubiera promociones distintas entre duplicados, la migración se detendría para evitar descartar una configuración.
