import { useEffect, useState } from 'react';
import { can, modules } from '../config/modules.js';
import { notifyUser } from '../services/user-feedback.js';

export default function OrderAlertNotice({ client, profile, branch, onNavigate }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const allowed = can(profile, modules.pedidos.read);
  useEffect(() => {
    if (!allowed) return;
    let active = true,
      running = false;
    const seen = new Set();
    setOrders([]);
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const rows = await client.getAll('/pedidos', {
          estado: 'PENDIENTE',
          ...(branch ? { id_sucursal: branch } : {}),
        });
        if (!active) return;
        setOrders(rows);
        setError('');
        const added = rows.filter((row) => !seen.has(String(row.id_pedido)));
        rows.forEach((row) => seen.add(String(row.id_pedido)));
        if (added.length)
          notifyUser(
            `${added.length} pedido(s) pendiente(s) requieren atención. Revisa Pedidos y entregas.`,
            'info',
          );
      } catch {
        if (active) setError('No se pudieron consultar los pedidos pendientes.');
      } finally {
        running = false;
      }
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [client, allowed, branch, profile.id_usuario]);
  if (!allowed || (!orders.length && !error)) return null;
  return (
    <section className="order-alert-banner" role="status">
      <div>
        <strong>{error || `${orders.length} pedido(s) pendiente(s) de atención`}</strong>
        {!error && (
          <p>
            Revisa la receta, el pago y la preparación de los pedidos de tus sucursales autorizadas.
          </p>
        )}
      </div>
      <button className="button secondary small" onClick={() => onNavigate('pedidos')}>
        Revisar pedidos
      </button>
    </section>
  );
}
