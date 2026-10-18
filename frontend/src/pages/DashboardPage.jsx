import InventoryAlertNotice from '../components/InventoryAlertNotice.jsx';
import { useEffect, useState } from 'react';
import { ArrowRight, MapPin, Plus, ArrowUpRight } from 'lucide-react';
import { can, modules } from '../config/modules.js';
import { today, money, number, reportDates } from '../utils/format.js';
import { Metric, CashBreakdown, reportTotals } from '../components/Summary.jsx';
import DataTable from '../components/DataTable.jsx';
import { Loading, Notice, Empty } from '../components/Feedback.jsx';
import Icon from '../components/Icon.jsx';

export default function DashboardPage({ client, profile, references, branch, onNavigate }) {
  const [state, setState] = useState({ loading: true, error: '', report: null, orders: [], lots: 0 });
  const finance = can(profile, ['ADMIN', 'GERENTE', 'AUDITOR']);
  useEffect(function () {
    let ignore = false;
    setState(old => ({ ...old, loading: true, error: '' }));
    const scope = branch ? { id_sucursal: branch } : {};
    const canReadOrders = can(profile, modules.pedidos.read);
    Promise.all([
      finance ? client.get('/reportes/resumen', { ...reportDates(`${today().slice(0, 7)}-01`, today()), ...scope }) : Promise.resolve(null),
      canReadOrders ? client.get('/pedidos', { ...scope, estado: 'PENDIENTE', limit: 5, sort: 'desc' }) : Promise.resolve({ data: [], pagination: { total: 0 } }),
      client.get('/inventario', { ...scope, limit: 1 }),
    ]).then(function ([report, orders, stock]) {
      if (!ignore) setState({ loading: false, error: '', report: report?.data, orders: orders.data, ordersTotal: orders.pagination.total, lots: stock.pagination.total });
    }).catch(function (error) { if (!ignore) setState({ loading: false, error: error.message, report: null, orders: [], lots: 0 }); });
    return function () { ignore = true; };
  }, [client, branch, finance, profile.rol]);
  const totals = state.report ? reportTotals(state.report) : null;
  const branches = (references.sucursales || []).filter(s => !branch || Number(s.id_sucursal) === Number(branch));
  const lowStock = state.report?.stock.filter(s => s.bajo_minimo) || [];
  return <div className="page-stack">{can(profile,['ADMIN','GERENTE','BODEGA','AUDITOR'])&&<InventoryAlertNotice client={client} branch={branch} onNavigate={onNavigate}/>}
    <div className="page-heading"><div><p className="eyebrow">Visión general</p><h1>Tu red, en un solo lugar.</h1><p>Lo que necesitas saber para cuidar cada operación.</p></div><span className="date-chip">{new Intl.DateTimeFormat('es-GT', { dateStyle: 'long', timeZone: 'America/Guatemala' }).format(new Date())}</span></div>
    <section className="welcome-card"><div><span className="welcome-tag"><span />Conectando salud y cercanía</span><h2>Cada sucursal cuenta.<br />Cada entrega también.</h2><p>Organiza tu inventario, acompaña a tu equipo y mantén<br className="desktop-break" /> los medicamentos cerca de quienes los necesitan.</p>
      <div className="welcome-actions">{can(profile, modules.pedidos.read) && <button className="button primary" onClick={() => onNavigate('pedidos')}>Gestionar pedidos<ArrowRight size={17} /></button>}
        <button className="button text" onClick={() => onNavigate('inventario')}>Ver inventario<ArrowUpRight size={17} /></button></div></div>
      <div className="network-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="art-node node-one"><Icon name="Building2" size={27} /><span>Sucursales</span></div><div className="art-node node-two"><Icon name="Truck" size={27} /><span>Entregas</span></div><div className="art-node node-three"><Icon name="Package" size={25} /><span>Inventario</span></div>
        <div className="art-center"><Plus size={58} strokeWidth={4} /></div><span className="art-dot dot-one" /><span className="art-dot dot-two" /></div>
    </section>
    <Notice>{state.error}</Notice>
    {state.loading ? <Loading text="Preparando tu resumen…" /> : state.error ? <Empty title="Resumen no disponible" description="Comprueba la conexión y vuelve a entrar al inicio para actualizar." /> : <>
      <div className="metrics-grid">{finance ? <>
        <Metric title="Ingresos del mes" value={money(totals?.income)} note="Todos los medios de pago" icon="Wallet" />
        <Metric title="Egresos del mes" value={money(totals?.expense)} note="Gastos y pagos registrados" icon="Banknote" tone="amber" />
        <Metric title="Unidades disponibles" value={number(totals?.stock)} note="Sin reservas ni vencidos" icon="Package" tone="blue" />
        <Metric title="Activos de la red" value={money(totals?.assets)} note="Valor contable estimado" icon="Monitor" tone="purple" />
      </> : <>
        <Metric title="Sucursales visibles" value={number(branches.length)} note="Localidades de la red" icon="Building2" />
        <Metric title="Lotes registrados" value={number(state.lots)} note="Según el alcance de tu cuenta" icon="Package" tone="blue" />
        <Metric title="Pedidos pendientes" value={number(state.ordersTotal)} note="Por preparar" icon="ShoppingBag" tone="amber" />
        <Metric title="Medicamentos" value={number(references.medicamentos?.length)} note="En el catálogo disponible" icon="Pill" tone="purple" />
      </>}</div>
      <div className="dashboard-columns"><section className="panel"><div className="panel-heading"><div><h2>{finance ? 'Flujo de fondos' : 'Tu espacio de trabajo'}</h2><p>{finance ? 'Ingresos y egresos del mes actual' : 'Acceso rápido a tus operaciones'}</p></div>{finance && <button className="button text small" onClick={() => onNavigate('reportes')}>Ver reporte<ArrowUpRight size={16} /></button>}</div>
        {finance ? <CashBreakdown rows={state.report?.caja || []} /> : <div className="quick-links">{['inventario', 'ventas', 'pedidos', 'traslados'].filter(name => can(profile, modules[name].read)).map(name => <button key={name} onClick={() => onNavigate(name)}><Icon name={modules[name].icon} /><span>{modules[name].title}</span><ArrowRight size={16} /></button>)}</div>}
      </section><section className="panel"><div className="panel-heading"><div><h2>Atención a tiempo</h2><p>Prioridades de la operación</p></div><Icon name="Activity" /></div>
        <div className="priority-list"><button onClick={() => onNavigate(finance ? 'reportes' : 'pedidos')} disabled={!can(profile, modules.pedidos.read)}><span className="priority-icon amber"><Icon name="ShoppingBag" /></span><span><strong>{finance ? `${state.report?.pedidos_atrasados.length || 0} entregas con retraso` : 'Da seguimiento a tus pedidos'}</strong><small>{finance ? 'Promesa de entrega vencida' : 'Consulta el estado de tus pedidos'}</small></span><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate(finance ? 'reportes' : 'inventario')}><span className="priority-icon blue"><Icon name="Package" /></span><span><strong>{finance ? `${lowStock.length} productos por reponer` : 'Revisa tus existencias'}</strong><small>{finance ? 'Por debajo del mínimo configurado' : 'Disponibilidad por lote y sucursal'}</small></span><ArrowRight size={16} /></button></div>
        <div className="care-note"><span className="care-symbol">+</span><p>Una buena coordinación empieza con información al día.</p></div>
      </section></div>
      {can(profile, modules.pedidos.read) && <section className="panel"><div className="panel-heading"><div><h2>Pedidos por atender</h2><p>Últimos pedidos pendientes de preparación</p></div><button className="button text small" onClick={() => onNavigate('pedidos')}>Todos los pedidos<ArrowRight size={16} /></button></div>
        <DataTable rows={state.orders} columns={['id_pedido', 'id_cliente', 'id_sucursal', 'entrega_estimada', 'total', 'estado']} rowKey="id_pedido" references={references} emptyText="No hay pedidos pendientes en este alcance." /></section>}
      <section><div className="section-heading"><h2>Tu red de sucursales</h2><button className="button text small" onClick={() => onNavigate('sucursales')}>Ver sucursales<ArrowRight size={16} /></button></div>
        {branches.length ? <div className="branch-cards">{branches.slice(0, 6).map(s => <article className="branch-card" key={s.id_sucursal}><span className="branch-icon"><Icon name="Building2" size={23} /></span><span className="branch-type">{s.tipo === 'STAND' ? 'Stand de farmacia' : 'Farmacia'}</span><h3>{s.nombre}</h3><p><MapPin size={14} />{s.departamento}</p><div><span className={`branch-state ${s.estado === 'ACTIVA' ? '' : 'inactive'}`}>{s.estado === 'ACTIVA' ? 'Activa' : 'Inactiva'}</span><small>{s.acepta_pedidos ? 'Con entregas' : 'Sin entregas'}</small></div></article>)}</div> : <Empty title="Tu red está por comenzar" description="Registra una sucursal para comenzar a operar." />}</section>
    </>}
  </div>;
}
