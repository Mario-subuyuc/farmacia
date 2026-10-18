import {confirmAction,notifyUser} from '../services/user-feedback.js';
import { useState } from 'react';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import CheckoutForm from './CheckoutForm.jsx';
import Modal from './Modal.jsx';
import { money } from '../utils/format.js';
import { cartTotal } from '../utils/cart.js';

export default function ShoppingCartPanel({ items, onChange, onClose }) {
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  function quantity(id, value) {
    if (!Number.isInteger(value) || value < 1 || value > 99) {setMessage('La cantidad debe ser un número entero entre 1 y 99.');notifyUser('La cantidad debe ser un número entero entre 1 y 99.','warning');return;}
    onChange(items.map(item => item.id_medicamento === id ? { ...item, cantidad: value } : item));
  }
  function download() {
    const text = ['Mi lista de compra — NexoFarma', '', ...items.map(item => `${item.cantidad} × ${item.nombre}: ${money(Number(item.precio_venta) * item.cantidad)}${item.requiere_receta ? ' (requiere receta)' : ''}`), '', `Total estimado: ${money(cartTotal(items))}`, 'Confirma precio, existencias y receta en la farmacia. Esta lista no es un pedido confirmado.'].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'lista-compra-nexofarma.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Lista descargada. Preséntala en la farmacia para confirmar tu compra.');
  }
  return <Modal title="Mi carrito" description="Revisa tus medicamentos y cantidades." onClose={onClose} busy={busy} wide>
    {checkout ? <CheckoutForm items={items} onCompleted={() => onChange([])} onBack={() => setCheckout(false)} onBusy={setBusy} /> : !items.length ? <div className="cart-empty"><ShoppingCart size={42} /><h3>Tu carrito está vacío</h3><p>Agrega medicamentos desde el catálogo.</p><button className="button primary" onClick={onClose}>Explorar catálogo</button></div> : <>
      <div className="cart-items">{items.map(item => <article className="cart-item" key={item.id_medicamento}>
        {item.imagen_url && <img src={item.imagen_url} alt="" />}
        <div className="cart-item-info"><h3>{item.nombre}</h3><p>{money(item.precio_venta)} por unidad</p>{item.requiere_receta && <span className="badge">Requiere receta</span>}</div>
        <div className="cart-quantity"><button className="icon-button" disabled={item.cantidad <= 1} aria-label={`Reducir cantidad de ${item.nombre}`} onClick={() => quantity(item.id_medicamento, item.cantidad - 1)}><Minus size={16} /></button><input type="number" min="1" max="99" aria-label={`Cantidad de ${item.nombre}`} value={item.cantidad} onChange={event => quantity(item.id_medicamento, Number(event.target.value))} /><button className="icon-button" disabled={item.cantidad >= 99} aria-label={`Aumentar cantidad de ${item.nombre}`} onClick={() => quantity(item.id_medicamento, item.cantidad + 1)}><Plus size={16} /></button></div>
        <strong>{money(Number(item.precio_venta) * item.cantidad)}</strong>
        <button className="icon-button" aria-label={`Quitar ${item.nombre}`} onClick={() => onChange(items.filter(row => row.id_medicamento !== item.id_medicamento))}><Trash2 size={18} /></button>
      </article>)}</div>
      <div className="cart-total"><span>Total estimado</span><strong>{money(cartTotal(items))}</strong></div>
      <p className="muted">Confirma precio y existencias en la sucursal. El carrito no reserva productos. Presenta tu receta cuando corresponda.</p>
      <div className="cart-actions"><button className="button subtle" onClick={async() => {if(await confirmAction({title:"¿Vaciar tu carrito?",text:"Se quitarán todos los productos. Puedes volver a agregarlos desde el catálogo.",confirmText:"Sí, vaciar carrito",danger:true}))onChange([]);}}>Vaciar carrito</button><button className="button secondary" onClick={onClose}>Seguir comprando</button><button className="button secondary" onClick={download}>Descargar lista</button><button className="button primary" onClick={() => setCheckout(true)}>Continuar con el pago</button></div>
      <p role="status">{message}</p>
    </>}
  </Modal>;
}
