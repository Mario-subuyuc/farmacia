const moneyFormatter = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
export function money(value) { return moneyFormatter.format(Number(value || 0)); }
export function number(value) { return new Intl.NumberFormat('es-GT').format(Number(value || 0)); }
export function words(value) {
  return String(value || '').toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
}
export function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala' }).format(date);
}
export function dateOnly(value) { return value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—'; }
export function today() {
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Guatemala' }).formatToParts(new Date());
  function part(type) { return parts.find(p => p.type === type).value; }
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function nextDay(date) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
export function reportDates(from, through) {
  return { desde: `${from}T00:00:00-06:00`, hasta: `${nextDay(through)}T00:00:00-06:00` };
}
