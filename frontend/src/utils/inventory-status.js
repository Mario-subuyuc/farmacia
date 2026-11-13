import { today } from './format.js';

export function inventoryStatus(row, currentDay = today()) {
  const labels = [];
  const end = new Date(`${currentDay}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 30);
  const limit = end.toISOString().slice(0, 10);
  const expired = row.fecha_vencimiento <= currentDay;
  const soon = !expired && row.fecha_vencimiento <= limit;
  const empty = Number(row.cantidad) - Number(row.reservado || 0) <= 0;
  if (expired) labels.push('Vencido');
  else if (soon) labels.push('Vence en 30 días o menos');
  if (empty) labels.push('Sin unidades disponibles');
  return {
    labels,
    className: expired
      ? 'inventory-expired'
      : empty
        ? 'inventory-empty'
        : soon
          ? 'inventory-expiring'
          : '',
  };
}
