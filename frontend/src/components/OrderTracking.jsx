import {confirmAction,notifyUser} from '../services/user-feedback.js';
import { useEffect, useState } from 'react';
import { savedOrders } from '../utils/order-history.js';
import { api } from '../services/api.js';
import { money, dateTime, words } from '../utils/format.js';
import { Notice } from './Feedback.jsx';

export default function OrderTracking({ initialToken = '' }) {
  const [token, setToken] = useState(initialToken);
  const [active, setActive] = useState(initialToken);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [history,setHistory]=useState(savedOrders);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!active) return;
    let ignore = false;
    async function refresh() {
      setBusy(true);
      try { const result = await api.publicPost('/tienda/seguimiento', {token:active}); if (!ignore) {setOrder(result.data); setError('');} }
      catch (failure) { if (!ignore) { setError(failure.message); setOrder(null); } }
      finally { if (!ignore) setBusy(false); }
    }
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => { ignore = true; clearInterval(timer); };
  }, [active, version]);
  async function cancel(){setBusy(true);setError('');try{await api.publicPost('/tienda/cancelar',{token:active});notifyUser('Pedido cancelado. Se liberaron las reservas de inventario.','success');setVersion(v=>v+1);}catch(failure){setError(failure.message);}finally{setBusy(false);}}
  const steps = ['PENDIENTE', 'PREPARANDO', 'EN_CAMINO', 'ENTREGADO'];
  return <section className="panel tracking-panel"><h2>Seguir mi pedido</h2><p>Usa tu código privado para consultar el estado. Se actualiza cada minuto.</p>
    {history.length>0 && <details className="order-history"><summary>Mis compras en este navegador ({history.length})</summary><p>Estos accesos son privados. Puedes consultar otro dispositivo pegando el código del pedido.</p>{history.map(row=><button key={row.token} className="button subtle small" onClick={()=>{setToken(row.token);setActive(row.token);setVersion(v=>v+1);}}>Pedido #{row.id} · {money(row.total)}</button>)}<button className="button subtle small" onClick={()=>{localStorage.removeItem('nexo-order-history');localStorage.removeItem('nexo-last-order');setHistory([]);}}>Borrar historial de este dispositivo</button></details>}
    <form className="tracking-search" onSubmit={event => {event.preventDefault();setOrder(null);setActive(token.trim());setVersion(v=>v+1);}}>
      <label>Código de seguimiento<input required pattern="[a-f0-9]{64}" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" /></label><button className="button primary" disabled={busy}>Consultar pedido</button>
    </form><Notice>{error}</Notice>
    {order && <div className="tracking-result"><h3>Pedido #{order.id_pedido}</h3><p role="status"><strong>Estado: {words(order.estado)}</strong></p>
      {steps.includes(order.estado) && <ol className="order-steps">{steps.map((step,index) => <li className={index <= steps.indexOf(order.estado) ? 'reached' : ''} key={step} aria-current={order.estado===step?'step':undefined}>{words(step)}</li>)}</ol>}
      {['CANCELADO','DEVUELTO'].includes(order.estado) && <p>Contacta a la sucursal para consultar alternativas.</p>}
      <p>{order.sucursal} {order.telefono_sucursal && `· Tel. ${order.telefono_sucursal}`}</p>
      <p>Pago: <strong>{words(order.estado_pago||'PENDIENTE')}</strong> · Receta: {words(order.receta_estado||'NO_REQUIERE')}</p>
      {order.costo_envio!==undefined && <p>Productos: {money(order.subtotal)} · Envío: {money(order.costo_envio)} · Cupón: −{money(order.descuento_cupon)}</p>}
      {order.expira_en && order.estado==='PENDIENTE' && <p>La reserva pendiente vence: {dateTime(order.expira_en)}</p>}
      <p>Entrega estimada: {dateTime(order.entrega_estimada)}</p><p>Total: <strong>{money(order.total)}</strong> · {words(order.metodo_pago)} al recibir</p>
      <ul>{order.items.map((item,index) => <li key={index}>{item.cantidad} × {item.nombre}</li>)}</ul>
      {['PENDIENTE','PREPARANDO'].includes(order.estado)&&order.estado_pago!=='PAGADO' && <div className="cart-actions"><button className="button danger" disabled={busy} onClick={async()=>{if(await confirmAction({title:'¿Cancelar este pedido?',text:'Se cancelará el pedido y se liberarán los productos reservados. La cancelación no realiza reembolsos bancarios.',confirmText:'Confirmar cancelación',danger:true}))await cancel();}}>Cancelar pedido</button></div>}
      <button className="button secondary" disabled={busy} onClick={()=>setVersion(v=>v+1)}>Actualizar estado</button>
    </div>}
  </section>;
}
