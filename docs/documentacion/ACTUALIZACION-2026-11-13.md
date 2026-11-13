# Actualización del expediente técnico

Fecha: 13 de noviembre de 2026. Complementa el expediente RUP del 18 de octubre; prevalece para los cambios posteriores. Referencia completa: [Estado actual](../ESTADO-ACTUAL.md). No se modificaron los Word, PDF, ZIP ni diagramas exportados anteriormente; sus conteos de tablas, columnas y relaciones corresponden a su corte original.

## Cambios de base de datos desde la entrega anterior

| Migración | Cambio |
|---|---|
| 018 | Procesamiento de correo de inscripción por token y etapa, cierre validado por intento y entrega inmediata por HTTP. |
| 019 | Departamento en pedidos, coordenadas opcionales y disponibilidad del call center por departamento. |
| 020 | Vista `cuentas_personal`: usuario y correo para administradores activos. |
| 021 | Vista `autorizaciones_personal`: identidad de cuentas en permisos operativos. |
| 022 | Vista `auditoria_usuarios`: nombre del actor conservando el alcance de lectura de auditoría. |
| 023 | Colores predeterminados azules de plantillas, conservando personalizaciones. |
| 024 | Fotografías de productos de referencia mediante URL externas. |
| 025 | `empleados.id_usuario`: UUID opcional, único, FK a perfiles con `ON DELETE SET NULL`, validación de sucursal y vistas `cuentas_empleados` / `empleados_cuentas`. |
| 026 | Unificación de medicamentos iniciales por códigos conocidos; conserva lotes, cantidades, reservas, referencias y promoción existente. |

La relación empleado/cuenta no automatiza altas laborales ni pagos. Los salarios y el estado del empleado se ingresan manualmente; la planilla toma empleados laboralmente activos. La baja del acceso no implica baja laboral y eliminar la cuenta no elimina la ficha del empleado.

## Datos y nomenclatura

Se limpiaron los datos operativos conservando autenticación, permisos, sucursales, configuración y auditoría, y luego se registraron los conjuntos ficticios documentados en `database/data/`. Actualmente hay cinco sucursales, 31 cuentas, treinta empleados, 75 activos, veinte clientes, veinte proveedores, diez medicamentos, treinta lotes y 750 unidades. Hay once eventos y 140 inscripciones confirmadas; no hay planillas, ventas ni pedidos en la instantánea de esta revisión.

Los medicamentos son compartidos: su nombre ya no contiene la sucursal y su código es `MED-PARA500-01`, por ejemplo. La sucursal permanece en inventario y códigos de lote. Clientes y proveedores también se comparten; sus prefijos son referencias de los datos ficticios. Los proveedores se seleccionan en compras y en el proveedor principal del producto.

## Interfaz y límites

La paleta es azul/blanco/verde azulado. El aside usa acordeones por clic o teclado y búsqueda, sin hover automático ni tarjeta «Estás en…». Inventario distingue vencimiento y falta de disponibilidad con color y texto. El panel consulta pedidos pendientes cada treinta segundos; esto no equivale a notificaciones push. Diseño de correos tiene ejemplos por categoría.

El servidor impide inscribirse o confirmar eventos ya iniciados; sigue pendiente ocultar visualmente el formulario de eventos pasados. Auditor y call center conservan alcance entre sucursales. No hay cálculo laboral integral, cobro bancario automático, certificación de inventario real ni garantía de entrega en bandeja de entrada por aceptación SMTP.

## Evidencia y respaldo

Las pruebas recientes incluyen unificación sin pérdida de inventario, relación empleado/cuenta y formulario manual, correo por categoría, menú por clic y avisos de pedidos/inventario. No se declara una ejecución completa nueva de todas las suites en esta actualización documental.

El respaldo incluye esquemas de aplicación, Auth y metadatos de Storage; los binarios se respaldan aparte. El dump anterior no contiene todas las cargas recientes, como se explica en [Estado actual](../ESTADO-ACTUAL.md). No se ha hecho una restauración aislada de prueba. Ningún respaldo, contraseña, token ni archivo de credenciales se incluye en este expediente ni en el commit.
