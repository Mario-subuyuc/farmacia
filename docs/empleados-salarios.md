# Empleados y salarios de referencia

Configuración del 13 de noviembre de 2026: 30 empleados ficticios, seis por sucursal, vinculados individualmente a las cuentas existentes. Los nombres personales son ficticios. El código `EMP-GERENTE-XELA01`, por ejemplo, permite localizar la ficha del usuario `gerente-xela01`. El administrador no se registra como empleado automáticamente.

| Puesto | Salario base mensual por persona | Personas |
|---|---:|---:|
| Gerente de sucursal | Q7,000.00 | 5 |
| Vendedor de farmacia | Q4,500.00 | 5 |
| Auxiliar de bodega | Q4,200.00 | 5 |
| Cajero | Q4,300.00 | 5 |
| Agente de call center | Q4,500.00 | 5 |
| Auditor operativo | Q6,500.00 | 5 |

Total de salarios base: Q31,000.00 por sucursal y Q155,000.00 por mes para las cinco sucursales. Son montos propuestos y redondeados para datos de prueba, no promedios estadísticos exactos ni salarios netos. Se usa la misma referencia mensual por puesto en todas las sucursales; el horario de apertura de la tienda no establece la jornada ni el contrato de sus empleados. No se ha calculado un prorrateo para Jutiapa, que atiende fines de semana.

## Referencias consultadas

- [MINTRAB, salario mínimo 2026](https://mintrabajo.gob.gt/salario-minimo/): base no agrícola mensual CE1 Q4,002.28 y CE2 Q3,816.90; bonificación incentivo separada de Q250.00. Todos los salarios base propuestos superan ambas bases mínimas.
- [Computrabajo, gerente de tienda](https://gt.computrabajo.com/salarios/gerente-de-tienda): media publicada Q7,005 mensuales, utilizada para redondear la referencia de gerente.
- [Computrabajo, auditor/a](https://gt.computrabajo.com/salarios/auditora): media publicada Q6,581 mensuales, utilizada como referencia aproximada de auditor.
- [Computrabajo, farmacia](https://gt.computrabajo.com/salarios/farmacia): referencia agregada del sector; no equivale al salario de cada puesto. Los demás importes son estimaciones internas para el conjunto ficticio.

## Flujo manual

1. Crear la cuenta de acceso con su rol y sucursal.
2. En Empleados, crear la ficha con nombre, puesto y salario base, y seleccionar el usuario vinculado. El vínculo es opcional, único y debe coincidir con la sucursal. No se genera una ficha automáticamente al crear una cuenta.
3. Al pagar el período, generar manualmente la planilla de empleados laboralmente activos. La operación existente toma el salario de cada ficha y permite ingresar bonificaciones y deducciones.

La bonificación incentivo no está incluida en `empleados.salario`. Al preparar una planilla de mes completo, registrar Q250 por empleado en bonificaciones cuando corresponda y revisar las demás deducciones y prestaciones. Con esa bonificación de referencia, el total bruto ilustrativo sería Q162,500 para los 30 empleados. No se generaron planillas ni movimientos de caja en esta carga.

Desactivar el acceso del usuario no modifica automáticamente su estado laboral ni elimina su salario. Eliminar su cuenta desvincula la ficha y conserva el historial del empleado. Las cuentas y salarios no se sincronizan ni se sobrescriben al repetir la carga manual.

## Archivos

La migración `025_employee_accounts.sql` agrega el vínculo, las validaciones y las vistas de consulta con alcance por sucursal. La carga `database/data/002_empleados.sql` inserta únicamente los empleados ficticios previstos. No ejecutar el seeder demo anterior.
