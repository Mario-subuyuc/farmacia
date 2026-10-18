import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { today, reportDates, money, number } from '../utils/format.js';
import { Metric, CashBreakdown, reportTotals } from '../components/Summary.jsx';
import ReportTable from '../components/ReportTable.jsx';
import { Loading, Notice } from '../components/Feedback.jsx';


export default function ReportsPage({ client, branch, references }) {
  const [dates, setDates] = useState({ from: `${today().slice(0, 7)}-01`, through: today() });
  const [applied, setApplied] = useState(dates);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState('caja');
  useEffect(function () {
    let ignore = false; setBusy(true); setError(''); setReport(null);
    client.get('/reportes/resumen', { ...reportDates(applied.from, applied.through), id_sucursal: branch }).then(result => { if (!ignore) setReport(result.data); })
      .catch(failure => { if (!ignore) setError(failure.message); }).finally(() => { if (!ignore) setBusy(false); });
    return () => { ignore = true; };
  }, [client, branch, applied]);
  const totals = report ? reportTotals(report) : null;
  const columns = {
    caja: ['id_sucursal', 'metodo_pago', 'saldo_inicial', 'ingresos', 'egresos', 'saldo_periodo', 'saldo_final'],
    stock: ['id_sucursal', 'id_medicamento', 'cantidad_registrada', 'reservado', 'disponible', 'vencido', 'stock_minimo', 'bajo_minimo', 'valor_compra'],
    activos: ['id_sucursal', 'valor_adquisicion', 'valor_contable_estimado'],
    pedidos_atrasados: ['id_pedido', 'id_cliente', 'id_sucursal', 'entrega_estimada', 'estado', 'total'],
  };
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">Control de la empresa</p><h1>Reportes</h1><p>Fondos, patrimonio y prioridades de tu red.</p></div>
    </div>
    <form className="panel date-filter" onSubmit={event => { event.preventDefault(); if (dates.from > dates.through) { setError('La fecha inicial debe ser anterior o igual a la final.'); return; } setApplied({ ...dates }); }}>
      <label>Desde<input type="date" required value={dates.from} onChange={e => setDates(old => ({ ...old, from: e.target.value }))} /></label>
      <label>Hasta, incluido<input type="date" required value={dates.through} onChange={e => setDates(old => ({ ...old, through: e.target.value }))} /></label>
      <button className="button primary" disabled={busy}><RefreshCw size={17} />Actualizar reporte</button></form>
    <Notice>{error}</Notice>{busy ? <Loading /> : report && <>
      <div className="metrics-grid"><Metric title="Ingresos del período" value={money(totals.income)} note="Todos los medios de pago" icon="Wallet" />
        <Metric title="Egresos del período" value={money(totals.expense)} note="Gastos y pagos registrados" icon="Banknote" tone="amber" />
        <Metric title="Planilla pagada" value={money(report.planilla_pagada)} note="Durante el período seleccionado" icon="UsersRound" tone="blue" />
        <Metric title="Entregas atrasadas" value={number(report.pedidos_atrasados.length)} note="Situación actual" icon="Truck" tone="purple" /></div>
      <section className="panel"><div className="panel-heading"><div><h2>Flujo por forma de pago</h2><p>El efectivo está separado de tarjetas y transferencias.</p></div></div><CashBreakdown rows={report.caja} /></section>
      <section className="panel"><div className="tabs" role="tablist" aria-label="Tablas del reporte">{[['caja', 'Caja'], ['stock', 'Inventario'], ['activos', 'Activos'], ['pedidos_atrasados', 'Entregas atrasadas']].map(([key, title]) =>
        <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{title}</button>)}</div>
        <ReportTable key={tab+'-'+applied.from+'-'+applied.through+'-'+branch} title={'Reporte '+tab} context={'Período: '+applied.from+' al '+applied.through+' | Sucursal: '+(references.sucursales?.find(row=>String(row.id_sucursal)===String(branch))?.nombre||'Todas las autorizadas')} rows={report[tab]} columns={columns[tab]} references={references} />
        <p className="report-note">Caja y planilla corresponden al período. Inventario y atrasos muestran el estado actual; los activos vigentes tienen un valor contable estimado. No es un balance histórico completo.</p>
      </section>
    </>}
  </div>;
}
