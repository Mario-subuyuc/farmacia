# Referencia actual del portal

Fecha de corte: **13 de noviembre de 2026**, hora de Guatemala. Datos comprobados por consultas de lectura a la base conectada; migraciones hasta `026_unify_initial_medicines.sql`. Esta guía y sus referencias son la documentación operativa vigente. Los Word, PDF y diagramas exportados anteriormente conservan su fecha histórica.

## Datos comprobados

| Entidad | Cantidad |
|---|---:|
| Sucursales | 5 |
| Cuentas, perfiles y autorizaciones | 31: un administrador y 30 cuentas por rol/sucursal |
| Empleados vinculados a usuarios | 30 |
| Activos fijos | 75 |
| Clientes / proveedores | 20 / 20 |
| Medicamentos únicos | 10 |
| Lotes / mínimos de inventario | 30 / 30 |
| Unidades registradas / reservadas | 750 / 0 |
| Eventos / inscripciones confirmadas | 11 / 140 |
| Planillas / pedidos / ventas | 0 / 0 / 0 |

Es una instantánea; las operaciones posteriores pueden cambiarla. Los datos personales, importes, contactos y ubicaciones de las cargas son ficticios o referenciales. Los correos de prueba usan `example.com`. Las credenciales solo están en el archivo local excluido de Git.

## Sucursales

| Código | Sucursal | Departamento | Atención |
|---|---|---|---|
| GUA01 | Farmacia Guatemala | Guatemala | Todos los días, 24 horas |
| MIX01 | Farmacia Mixco | Guatemala | Todos los días, 24 horas |
| XELA01 | Farmacia Xela | Quetzaltenango | Todos los días, 24 horas |
| PET01 | Farmacia Petén | Petén | Lunes a viernes, 06:00–18:00 |
| JUT01 | Farmacia Jutiapa | Jutiapa | Sábado y domingo, 06:00–18:00 |

Cada sucursal tiene gerente, vendedor, bodega, cajero, call center y auditor. Usuarios como `gerente-xela01` tienen su sucursal asignada. Auditor y call center mantienen consultas entre sucursales según las políticas existentes. El administrador gestiona toda la red; el selector de sucursal filtra, no concede permisos adicionales.

## Funcionamiento actual

- **Medicamentos:** diez productos sin sufijo de sucursal. Cinco comunes tienen stock en todas y cinco adicionales stock exclusivo inicial. Cada sucursal tiene seis productos y 150 unidades. Código compartido `MED-PARA500-01`; lote local `XELA01-LOTE-PARA500-20261113`. Vencimiento ficticio 30/11/2028 y mínimo de diez unidades. Suero oral conserva una promoción global del 10 %.
- **Clientes y proveedores:** el prefijo indica sucursal de referencia; son tablas compartidas, sin restricción comercial por ese prefijo. El código del proveedor forma parte del nombre visible porque la tabla no tiene un campo de código independiente.
- **Empleados y planillas:** vínculo opcional y único `empleados.id_usuario → perfiles.id_usuario`. Se crea manualmente la ficha y se ingresa salario base; una cuenta nueva no crea empleado ni planilla. La planilla se genera manualmente para empleados laboralmente activos. Desactivar el acceso no cambia su estado laboral. La bonificación y deducciones se ingresan en los ajustes de planilla, no se calculan automáticamente como obligaciones laborales completas.
- **Call center:** disponibilidad por departamento, sin exigir coordenadas del cliente. Otros flujos, como checkout y configuración de sucursal, conservan ubicación y condiciones de entrega.
- **Cuentas:** Accesos y permisos y Autorizaciones específicas muestran usuario y correo. Auditoría muestra Usuario, o Sistema cuando no hay actor.
- **Eventos:** uno por mes de enero a noviembre de 2026, rotando sucursales, el día 20 o siguiente día de atención, de 10:00 a 12:00. Confirmación de inscripción no acredita asistencia presencial. El servidor rechaza inscripciones y confirmaciones cuando la actividad comenzó; el formulario todavía puede mostrarse para eventos pasados.
- **Interfaz:** paleta azul, blanco y verde azulado. Acordeones del aside por clic o teclado, sin despliegue por hover; la búsqueda abre coincidencias. Se retiró «Estás en…». Las tarjetas informativas de Inventario y Operaciones de farmacia se integran con el diseño azul.
- **Inventario:** filas vencidas rojas, por vencer en treinta días ámbar y sin unidades disponibles azules, siempre con texto. Vencido tiene prioridad visual. Los avisos de pedidos pendientes se consultan cada treinta segundos y al recuperar el foco; no son notificaciones push fuera del navegador.
- **Correos:** ejemplos distintos para GENERAL, ALERTA, PEDIDO y EVENTO, fondo configurable y colores predeterminados azules. Guardar un diseño no envía correo. Los envíos dependen de SMTP y del entorno.

## Referencias

- [Sucursales y usuarios](datos-iniciales.md), [empleados y salarios](empleados-salarios.md), [activos](activos-iniciales.md).
- [Clientes](clientes-iniciales.md), [proveedores](proveedores-iniciales.md), [medicamentos e inventario](medicamentos-iniciales.md), [imágenes](imagenes-medicamentos.md), [eventos](eventos-iniciales.md).
- [Interfaz](UX-UI.md), [operación y respaldos](OPERACION.md), [correo en Vercel](despliegue-correos-vercel.md).
- [Limpieza histórica](limpieza-datos.md): los datos vacíos de esa etapa no describen el estado posterior a las cargas.

## Cargas y respaldos

No ejecutar `db:seed` sobre esta base para continuar la carga: recrea datos DEMO anteriores. Las cargas revisadas están en `database/data/001_…008_…`; son tareas manuales, no migraciones ni tareas de arranque. Las cargas 006/007 ya utilizan medicamentos compartidos; la migración 026 corrige los registros anteriores sin cambiar cantidades, reservas ni lotes.

El último respaldo completo comprobado antes de esta revisión documental es `nexofarma-2026-11-13T10-37-29-139Z.dump`, anterior a varias cargas actuales. Los respaldos parciales por operación no sustituyen una nueva copia completa. El script incluye `public`, `privado`, `auth` y `storage`; los archivos binarios de Storage requieren copia separada. No se ha probado una restauración aislada. Las copias y credenciales están excluidas de Git.
