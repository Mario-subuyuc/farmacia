# Guía de interfaz y experiencia de usuario

## Alcance y criterio

Revisión del prototipo público y administrativo, con inspección de pantallas, recorrido de compra y operación, navegación por teclado y pruebas automatizadas. No sustituye pruebas de usabilidad con clientes, personal de farmacia y operadores de call center. Antes de producción deben realizarse sesiones con esos perfiles y medir finalización de tareas, errores y tiempos.

## Hallazgos y cambios

- Menú administrativo extenso: búsqueda por nombre de módulo, sin distinción de tildes o mayúsculas, recuperación cuando no hay coincidencias, opción activa y contexto de pantalla y sucursal.
- Texto tenue y datos pequeños: mayor contraste en portada, catálogo, acceso, reportes e inventario; tablas con texto de 13 px y encabezados de 12 px; foco visible y controles táctiles ampliados en móvil.
- Avisos dispersos: componente Notice con título, texto e icono por severidad, SweetAlert2 para avisos breves y confirmaciones, y un historial de los últimos 30 mensajes de esta sesión. El aviso detallado permanece en pantalla después de cerrar el toast. El historial no se guarda en disco y se limpia al cerrar sesión.
- Riesgo de acciones accidentales: confirmación con foco inicial en Volver sin cambios para vaciar carrito, cancelar pedidos, anular/revertir movimientos, ajustes negativos y determinadas operaciones de stock/devolución/precio. Cerrar un formulario de creación o edición de registros modificado pide descartar los cambios. Esto no es recuperación automática de borradores ni protección contra cerrar todo el navegador.
- Proceso de compra: pasos visibles de entrega/pago, revisión del total y confirmación; aviso de pedido creado sin exponer el código privado en el historial de avisos.
- Estados ambiguos: verde para completado, rojo para rechazo/cancelación/error, ámbar para atención y azul para información. Los colores siempre se acompañan de texto; un rechazo de negocio no equivale necesariamente a una falla técnica.
- Accesibilidad: etiquetas asociadas, ayuda de campos vinculada mediante aria-describedby, navegación con foco y restauración al cerrar modales. El menú móvil permite Escape y mantiene el foco dentro mientras está abierto. Se respeta la preferencia de movimiento reducido.
- Conectividad: el navegador muestra un aviso cuando detecta pérdida de conexión. navigator.onLine no garantiza disponibilidad de la API; los errores de solicitud se siguen mostrando junto al contexto correspondiente. No se afirma que una operación se guardó hasta obtener éxito del servidor.

## Sonidos y preferencias

El botón Avisos abre el historial y la opción Sonidos de alerta. El sonido comienza desactivado, se habilita por una acción explícita del usuario y la preferencia se conserva en ese navegador. Web Audio genera dos tonos suaves diferenciados para éxito, advertencia y error; se limita la frecuencia para evitar una acumulación de sonidos. Si el navegador no permite audio, la información visual permanece. Los sonidos complementan la interfaz; no son alarmas clínicas ni garantizan atención del usuario.

## Referencia para desarrolladores

- `frontend/src/services/user-feedback.js`: notifyUser, confirmAction, historial y sonidos. Usar titleText/text y nunca interpolar información del usuario como HTML.
- `frontend/src/components/Feedback.jsx`: Notice, Loading y Empty. Los errores conservan su texto junto al formulario; los avisos transitorios no reemplazan las instrucciones.
- `frontend/src/components/ExperienceTools.jsx`: historial, preferencia de sonido y estado de conectividad.
- SweetAlert2 se inserta dentro del dialog nativo abierto cuando corresponde, para no quedar detrás de la capa modal del navegador. La cancelación no debe enviar solicitudes ni modificar datos.
- Conservar validaciones, permisos e idempotencia del servidor. Ningún mensaje de interfaz debe sustituirlos. No reproducir sonidos por cada pulsación ni abrir una confirmación para cada acción rutinaria.
- Evitar incluir contraseñas, recetas o códigos privados en avisos e historial. Integraciones nuevas deben proporcionar instrucciones de recuperación concretas al fallar.

## Validación

La suite E2E incluye confirmación y cancelación del vaciado de carrito, persistencia de preferencia de sonido, pérdida y recuperación de conexión, búsqueda de módulos, protección de cambios no guardados y errores de acceso que conservan los datos introducidos. Axe analiza reglas WCAG A/AA en inventario, reportes, portada, catálogo y acceso. Estas comprobaciones automáticas tienen un alcance limitado y no certifican accesibilidad completa. Se inspeccionan también capturas de escritorio y móvil y se mantienen pruebas de los flujos de negocio existentes.

Referencia de la biblioteca: [SweetAlert2](https://sweetalert2.github.io/).
