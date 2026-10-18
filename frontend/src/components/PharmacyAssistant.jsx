import { useEffect, useState } from 'react';
import { MessageCircle, ArrowLeft, Search, Pill } from 'lucide-react';
import { usePublicContent } from '../hooks/usePublicContent.js';
import ProductAutocomplete from './ProductAutocomplete.jsx';
import Modal from './Modal.jsx';
import OrderTracking from './OrderTracking.jsx';
import { api } from '../services/api.js';
import { money, words } from '../utils/format.js';
const questions = [
 ['¿Cómo compro?', 'Abre el catálogo, agrega productos al carrito y elige Continuar con el pago. Completa la entrega y selecciona la forma de pago al recibir.'],
 ['¿Cómo puedo pagar?', 'Puedes elegir efectivo, tarjeta o transferencia al recibir. Coordina con la sucursal el terminal o los datos de transferencia. No solicitamos datos de tarjeta en el chat.'],
 ['¿Dónde entregan?', 'La cobertura depende de tu ubicación y de la sucursal. Se comprueba al confirmar el pedido. Consulta los productos para ver en qué sucursales están disponibles.'],
 ['¿Puedo pedir productos con receta?', 'Adjunta una imagen de tu receta al finalizar la compra. El personal deberá aprobarla antes de preparar el pedido.'],
 ['¿Cómo funcionan las promociones?', 'Las promociones vigentes muestran el precio regular, el descuento y el precio final. El precio se verifica en la base al confirmar tu pedido.'],
 ['¿Cómo rastreo mi pedido?', 'Elige Rastrear mi pedido e introduce tu código privado de 64 caracteres. El seguimiento muestra el estado registrado por la farmacia, no la posición GPS.']
];
export default function PharmacyAssistant({onCatalog}) {
  const content=usePublicContent();
  const faq=content?content.filter(item=>item.tipo==='FAQ').map(item=>[item.titulo,item.cuerpo]):questions;
  const [open,setOpen]=useState(false), [mode,setMode]=useState('menu'), [query,setQuery]=useState('');
  const [categories,setCategories]=useState([]),[products,setProducts]=useState([]),[selected,setSelected]=useState(null);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[answer,setAnswer]=useState('');
  useEffect(()=>{if(!open)return;let active=true;api.publicGet('/catalogo',{limit:1}).then(result=>{if(active)setCategories(result.categorias);}).catch(()=>{});return()=>{active=false;};},[open]);
  async function search(category) {
    setBusy(true);setMessage('');setSelected(null);setProducts([]);
    try {
      const result=await api.publicPost('/asistente/productos',category?{categoria:category}:{consulta:query});
      setProducts(result.data);setMode('search');
      setMessage(result.necesita_nombre?'Me falta el nombre del producto. Escríbelo o elige una categoría.':!result.data.length?'No encontré coincidencias. Prueba solo con el nombre, revisa la escritura o elige una categoría.':result.pagination.total>8?'Encontré varias opciones. Elige un producto o añade su dosis para precisar la búsqueda.':'Elige un producto para consultar su información.');
    }catch(failure){setMessage(failure.message);}finally{setBusy(false);}
  }
  async function promotions(){setMode('search');setBusy(true);setProducts([]);setSelected(null);try{const result=await api.publicGet('/catalogo',{limit:1});setProducts((result.promociones||[]).slice(0,8));setMessage(result.promociones?.length?'Estas son promociones vigentes. Elige un producto.':'No hay promociones vigentes en este momento. Puedes explorar las categorías.');}catch(failure){setMessage(failure.message);}finally{setBusy(false);}}
  function menu(){setMode('menu');setSelected(null);setMessage('');setAnswer('');}
  let token='';try{token=localStorage.getItem('nexo-last-order')||'';}catch{}
  return <><button className="assistant-launch" onClick={()=>setOpen(true)} aria-label="Abrir asistente de farmacia"><MessageCircle size={22}/><span>¿Te ayudamos?</span></button>
    {open && <Modal title="Asistente NexoFarma" description="Productos, promociones y ayuda para tu compra." onClose={()=>setOpen(false)}><div className="pharmacy-chat">
      {mode!=='menu' && <button className="button subtle small" onClick={menu}><ArrowLeft size={15}/>Menú principal</button>}
      <div className="assistant-message">{mode==='menu'?'¡Hola! Elige en qué puedo ayudarte. Consulto información pública de productos y el estado de tu pedido con su código privado.':mode==='tracking'?'Ten a mano tu código privado.':mode==='faq'?'Selecciona una pregunta para ver su respuesta.':'Busca por nombre, principio activo o categoría. No importan las tildes ni las mayúsculas.'}</div>
      {mode==='menu' && <div className="assistant-choices">{[['Buscar un medicamento',()=>setMode('search')],['Elegir una categoría',()=>setMode('categories')],['Ver promociones',promotions],['Preguntas frecuentes',()=>setMode('faq')],['Rastrear mi pedido',()=>setMode('tracking')]].map(([label,action])=><button key={label} onClick={action}>{label} →</button>)}</div>}
      {(mode==='search'||mode==='categories') && <><form className="assistant-search" onSubmit={e=>{e.preventDefault();search();}}><label htmlFor="assistant-query">Nombre del producto<ProductAutocomplete id="assistant-query" required maxLength={100} value={query} onChange={setQuery} onSelect={product=>{setProducts([product]);setSelected(product);setMessage('');}} placeholder="Ej.: PARACETAMÓL 500"/></label><button className="button primary" disabled={busy} aria-label="Buscar producto en el asistente"><Search size={18}/></button></form>
        <div className="assistant-categories">{categories.map(category=><button key={category} disabled={busy} onClick={()=>search(category)}>{words(category)}</button>)}</div>
        {busy && <p role="status">Consultando productos…</p>}<p role="status">{message}</p>
        <div className="assistant-results">{products.map(product=><button key={product.id_medicamento} onClick={()=>setSelected(product)}><Pill size={18}/><span>{product.nombre}<small>{money(product.precio_venta)} {Number(product.descuento_aplicado)>0?` · −${product.descuento_aplicado}%`:''}</small></span></button>)}</div>
        {selected && <article className="assistant-product" aria-live="polite"><h3>{selected.nombre}</h3><p>{selected.descripcion}</p><p>Principio activo: {selected.principio_activo}</p><strong>{money(selected.precio_venta)}</strong>{Number(selected.descuento_aplicado)>0 && <p>Antes: <del>{money(selected.precio_regular)}</del> · Ahorra {selected.descuento_aplicado}%</p>}<p>{selected.requiere_receta?'Requiere receta y validación en farmacia.':'Sin receta.'}</p><h4>Disponibilidad por sucursal</h4>{selected.sucursales.length?selected.sucursales.map(branch=><p key={branch.id_sucursal}><strong>{branch.nombre}</strong><br/>{branch.direccion}{branch.telefono && <><br/><a href={`tel:${branch.telefono.replace(/[^+0-9]/g,'')}`}>{branch.telefono}</a></>}</p>):<p>Sin existencias disponibles actualmente.</p>}<button className="button primary" onClick={()=>{setOpen(false);onCatalog();}}>Abrir catálogo</button></article>}
      </>}
      {mode==='faq' && <><div className="assistant-choices">{faq.map(([question,text])=><button key={question} onClick={()=>setAnswer(text)}>{question}</button>)}</div>{answer && <p className="assistant-message" role="status">{answer}</p>}</>}
      {mode==='tracking' && <OrderTracking initialToken={token}/>}
      <p className="assistant-note">Ayuda automática para compras. No ofrece diagnósticos ni recomendaciones de tratamiento.</p>
    </div></Modal>}
  </>;
}
