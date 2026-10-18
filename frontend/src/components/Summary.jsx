import Icon from './Icon.jsx';
import { money } from '../utils/format.js';
import { Empty } from './Feedback.jsx';

export function Metric({ title, value, note, icon, tone = 'green' }) {
  return <article className="metric"><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}><Icon name={icon} size={21} /></span></div>
    <strong>{value}</strong><small>{note}</small></article>;
}
export function reportTotals(report) {
  return { income: report.caja.reduce((sum, r) => sum + Number(r.ingresos), 0), expense: report.caja.reduce((sum, r) => sum + Number(r.egresos), 0),
    assets: report.activos.reduce((sum, r) => sum + Number(r.valor_contable_estimado), 0),
    stock: report.stock.reduce((sum, r) => sum + Number(r.disponible), 0) };
}
export function CashBreakdown({ rows }) {
  if (!rows.length) return <Empty title="Sin movimientos en el período" description="Aquí verás los ingresos y egresos registrados." />;
  const groups = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].map(method => {
    const matches = rows.filter(r => r.metodo_pago === method);
    return { name: method, income: matches.reduce((sum, r) => sum + Number(r.ingresos), 0), expense: matches.reduce((sum, r) => sum + Number(r.egresos), 0) };
  });
  const max = Math.max(1, ...groups.flatMap(r => [r.income, r.expense]));
  return <div className="cash-chart"><div className="chart-legend"><span><i className="income-dot" />Ingresos</span><span><i className="expense-dot" />Egresos</span></div>
    {groups.map(group => <div className="chart-row" key={group.name}><div className="chart-label"><span>{group.name === 'EFECTIVO' ? 'Efectivo' : group.name === 'TARJETA' ? 'Tarjeta' : 'Transferencia'}</span>
      <small>{money(group.income)} / {money(group.expense)}</small></div>
      <div className="bar-track"><div className="bar income-bar" style={{ width: `${group.income / max * 100}%` }} /></div>
      <div className="bar-track"><div className="bar expense-bar" style={{ width: `${group.expense / max * 100}%` }} /></div></div>)}
  </div>;
}
