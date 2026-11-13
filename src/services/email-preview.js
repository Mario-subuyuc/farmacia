export function emailPreview(template = {}) {
  const examples = {
    GENERAL: { subject: 'Información de tu farmacia', event: '', text: 'Hola, aquí encontrarás las novedades y avisos de tu red de farmacias.' },
    ALERTA: { subject: 'Alerta de inventario', event: 'STOCK_BAJO', text: 'Sucursal Central · medicamento de ejemplo\nDisponible: 8 unidades · mínimo: 20 unidades.\nRevisa el inventario y coordina la reposición.' },
    PEDIDO: { subject: 'Tu pedido está confirmado', event: 'CONFIRMADO', text: 'Hola, recibimos tu pedido de ejemplo.\nLa sucursal está coordinando su preparación. Consulta el avance con tu código privado.' },
    EVENTO: { subject: 'Tu inscripción está confirmada', event: 'INSCRIPCION_CONFIRMADA', text: 'Hola, tu inscripción está confirmada.\nTe esperamos en la sucursal en la fecha y hora de tu actividad.' },
  };
  return { ...(examples[template.tipo] || examples.GENERAL), template };
}
