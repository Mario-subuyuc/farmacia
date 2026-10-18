import {notifyUser} from '../services/user-feedback.js';
﻿import { useRef, useState } from 'react';
import { api } from '../services/api.js';
import { money } from '../utils/format.js';
import { cartTotal } from '../utils/cart.js';
import { Notice } from './Feedback.jsx';
import { saveOrder } from '../utils/order-history.js';
import OrderTracking from './OrderTracking.jsx';

function privateCode() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n=>n.toString(16).padStart(2,'0')).join(''); }
export default function CheckoutForm({ items, onCompleted, onBack, onBusy }) {
  const [form, setForm] = useState({ nombre:'', apellido:'', telefono:'', direccion_entrega:'', latitud:'', longitud:'', id_sucursal:'', metodo_pago:'EFECTIVO',email:'',cupon:'' });
  const [quote,setQuote] = useState(null);
  const [recipe,setRecipe] = useState('');
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const attempt = useRef(null);
  if (!attempt.current) { try { attempt.current=JSON.parse(sessionStorage.getItem('nexo-checkout-attempt')); } catch {} }
  if(!attempt.current)attempt.current={clave:crypto.randomUUID(),token:privateCode()};
  const [storageError, setStorageError] = useState(false);
  const [cart, setCart] = useState(items);
  const [locationBusy, setLocationBusy] = useState(false);
  async function availableBranches() {
    setError('');setBusy(true);
    try {
      const all = []; let page = 1; let result;
      do { result=await api.publicGet('/catalogo', {page,limit:48});all.push(...result.data);page++; } while(all.length<result.pagination.total && page<210);
      setCart(rows=>rows.map(item=>{const product=all.find(p=>p.id_medicamento===item.id_medicamento);return product?{...item,precio_venta:product.precio_venta}:item;}));
      const matching=result.sucursales.filter(branch=>cart.every(item=>all.find(p=>p.id_medicamento===item.id_medicamento)?.sucursales.some(s=>s.id_sucursal===branch.id_sucursal)));
      setBranches(matching);
      if (!matching.length) setError('No hay una sucursal con todos estos productos disponibles. Ajusta tu carrito.');
    } catch(failure){setError(failure.message);} finally{setBusy(false);}
  }
  function change(event){setQuote(null);setForm(old=>({...old,[event.target.name]:event.target.value}));}
  function location() {
    if(!navigator.geolocation){setError('Introduce las coordenadas de entrega manualmente.');return;}
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(position=>{setForm(old=>({...old,latitud:String(position.coords.latitude),longitud:String(position.coords.longitude)}));setLocationBusy(false);},()=>{setError('No se pudo obtener tu ubicación. Introduce las coordenadas de entrega.');setLocationBusy(false);},{timeout:10000});
  }
  async function submit(event) {
    event.preventDefault();setError('');
    if(cart.some(item=>item.requiere_receta)&&!recipe){setError('Adjunta tu receta para que el personal pueda validarla.');return;}
    const data={...form,email:form.email||null,cupon:form.cupon.trim().toUpperCase()||null,receta_path:recipe||null,id_sucursal:Number(form.id_sucursal),latitud:Number(form.latitud),longitud:Number(form.longitud),items:cart.map(({id_medicamento,cantidad})=>({id_medicamento,cantidad}))};
    const fingerprint=JSON.stringify(data);
    if(!attempt.current || attempt.current.fingerprint!==fingerprint) attempt.current={fingerprint,clave:crypto.randomUUID(),token:attempt.current?.token||privateCode()};
    try { sessionStorage.setItem('nexo-checkout-attempt',JSON.stringify(attempt.current)); } catch {}
    const pending={...data,clave:attempt.current.clave,token:attempt.current.token};
    setBusy(true);onBusy(true);
    try{
      if(!quote||quote.fingerprint!==fingerprint){const preview=await api.publicPost('/tienda/cotizar',pending);setQuote({...preview.data,fingerprint});return;}
      const result=await api.publicPost('/tienda/pedidos',{...pending,total_aceptado:quote.total});
      setReceipt(result);notifyUser('Pedido #'+result.data.id_pedido+' confirmado. Conserva tu código privado.','success');
      try{saveOrder(result);}catch{setStorageError(true);}
      try { sessionStorage.removeItem('nexo-checkout-attempt'); } catch {}
      onCompleted();
    }catch(failure){setError(failure.message);if([400,409].includes(failure.status))setQuote(null);}finally{setBusy(false);onBusy(false);}
  }
  async function upload(event){
    const file=event.target.files[0];if(!file)return;setError('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5242880){setError('Adjunta una imagen JPEG, PNG o WebP de hasta 5 MB.');return;}
    setBusy(true);onBusy(true);setRecipe('');setQuote(null);
    try{const result=await api.uploadPrescription(attempt.current.token,file);setRecipe(result.data.path);}catch(failure){setError(failure.message);}finally{setBusy(false);onBusy(false);}
  }
  if(receipt)return <div className="page-stack"><h3>Pedido confirmado #{receipt.data.id_pedido}</h3><p>Se reservó tu inventario. Total confirmado: <strong>{money(receipt.data.total)}</strong>.</p><p>Guarda este código privado para consultar tu pedido desde otro dispositivo:</p><code className="tracking-code">{receipt.token}</code>{storageError && <p>No se pudo guardar el código en este navegador. Cópialo antes de cerrar.</p>}<OrderTracking initialToken={receipt.token} /></div>;
  return <form onSubmit={submit} className="page-stack checkout-form"><fieldset disabled={busy} className="checkout-fieldset"><ol className="checkout-progress" aria-label="Pasos de compra"><li className={!quote?'current':'done'} aria-current={!quote?'step':undefined}><span>1</span>Entrega y pago</li><li className={quote?'current':''} aria-current={quote?'step':undefined}><span>2</span>Revisar total</li><li><span>3</span>Confirmación</li></ol><h3>Entrega y forma de pago</h3>
    <div className="checkout-grid">{[['nombre','Nombre','text'],['apellido','Apellido','text'],['telefono','Teléfono','tel']].map(([name,label,type])=><label key={name}>{label}<input name={name} type={type} required maxLength={name==='telefono'?20:100} value={form[name]} onChange={change} /></label>)}</div>
    <label>Correo para avisos (opcional)<input type="email" name="email" maxLength={150} value={form.email} onChange={change}/><small>Recibirás avisos cuando el servicio de correo esté activo. Conserva tu código privado para el seguimiento.</small></label>
    <label>Dirección de entrega<textarea name="direccion_entrega" required maxLength={255} value={form.direccion_entrega} onChange={change} placeholder="Calle, número, zona, municipio y referencia" /></label>
    <button type="button" className="button secondary" disabled={locationBusy} onClick={location}>{locationBusy?'Obteniendo ubicación…':'Usar mi ubicación para la entrega'}</button>
    <div className="checkout-grid"><label>Latitud<input name="latitud" type="number" step="any" min="-90" max="90" required value={form.latitud} onChange={change}/></label><label>Longitud<input name="longitud" type="number" step="any" min="-180" max="180" required value={form.longitud} onChange={change}/></label></div>
    <p className="muted">Verifica que la ubicación corresponda a tu dirección. Comprobaremos la cobertura de entrega al confirmar.</p>
    <button type="button" className="button secondary" onClick={availableBranches} disabled={busy}>Buscar sucursales con mis productos</button>
    <label>Sucursal que entregará<select name="id_sucursal" required value={form.id_sucursal} onChange={change}><option value="">Selecciona una sucursal</option>{branches.map(branch=><option key={branch.id_sucursal} value={branch.id_sucursal}>{branch.nombre}</option>)}</select></label>
    <label>Forma de pago<select name="metodo_pago" value={form.metodo_pago} onChange={change}><option value="EFECTIVO">Efectivo al recibir</option><option value="TARJETA">Tarjeta al recibir</option><option value="TRANSFERENCIA">Transferencia al recibir</option></select></label>
    <p>El pago se realiza al recibir el pedido. Coordina la transferencia o el uso de terminal con la sucursal. No introduzcas datos de tarjeta aquí.</p>
    <label>Cupón (opcional)<input name="cupon" maxLength={30} value={form.cupon} onChange={change} placeholder="CÓDIGO"/></label>
    <p>Total estimado de productos: <strong>{money(cartTotal(cart))}</strong>. Confirmaremos precio y stock al enviar tu pedido.</p>
    {cart.some(item=>item.requiere_receta) && <label>Imagen de la receta<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}/><small>{recipe?'Receta cargada en almacenamiento privado. El personal debe aprobarla antes de preparar el pedido.':'Adjunta una imagen de hasta 5 MB. Solo el personal autorizado podrá revisarla.'}</small></label>}
    {quote && <section className="checkout-quote" aria-live="polite"><h3>Revisa tu total antes de confirmar</h3><p>Productos: {money(quote.subtotal)}</p><p>Envío: {money(quote.costo_envio)}</p><p>Descuento de cupón: −{money(quote.descuento_cupon)}</p><strong>Total a pagar al recibir: {money(quote.total)}</strong></section>}
    <Notice>{error}</Notice><div className="cart-actions"><button type="button" className="button secondary" disabled={busy} onClick={onBack}>Volver al carrito</button><button className="button primary" disabled={busy}>{busy?'Procesando…':quote?'Confirmar pedido':'Revisar total'}</button></div></fieldset>
  </form>;
}
