import {notifyUser} from '../services/user-feedback.js';
import { useEffect, useState } from 'react';
import { ArrowRight, Search, Pill, MapPin, Phone, ShieldCheck, RefreshCw, ShoppingCart, Plus } from 'lucide-react';
import { api } from '../services/api.js';
import { money } from '../utils/format.js';
import { Loading, Notice, Empty } from '../components/Feedback.jsx';
import ProductAutocomplete from '../components/ProductAutocomplete.jsx';
import ProductPrice from '../components/ProductPrice.jsx';
import OrderTracking from '../components/OrderTracking.jsx';
import Modal from '../components/Modal.jsx';
import ShoppingCartPanel from '../components/ShoppingCartPanel.jsx';
import { CART_KEY, readCart, addToCart } from '../utils/cart.js';
import { Pagination } from '../components/DataTable.jsx';

// Vista pública: no consulta perfiles ni utiliza un token de empleado.
export default function PublicCatalogPage({ onNavigate, hasSession }) {
  const [cart, setCart] = useState(readCart);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [lastToken, setLastToken] = useState(() => { try { return localStorage.getItem('nexo-last-order') || ''; } catch { return ''; } });
  const [addedId, setAddedId] = useState(null);
  const [animation, setAnimation] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState('');
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { setCartNotice('No se pudo guardar el carrito en este navegador.'); } }, [cart]);
  function add(product) {
    if (!product.sucursales.length) return;
    if (cart.find(item=>item.id_medicamento===product.id_medicamento)?.cantidad>=99) { setCartNotice('Máximo 99 unidades por producto.');notifyUser('Máximo 99 unidades por producto.','warning'); return; }
    setCart(previous => addToCart(previous, product));
    setAddedId(product.id_medicamento); setAnimation(value=>value+1);
    setCartNotice(product.nombre + ' agregado al carrito.');notifyUser(product.nombre+' agregado al carrito.','success');
  }
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', id_sucursal: '', categoria: '', page: 1 });
  const [result, setResult] = useState({ data: [], sucursales: [], categorias: [], pagination: { total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let ignore = false;
    setLoading(true); setError('');
    api.publicGet('/catalogo', { ...filters, limit: 12 }).then(data => { if (!ignore) { setResult(data); setCart(rows=>rows.map(item=>{const product=data.data.find(p=>p.id_medicamento===item.id_medicamento);return product?{...item,precio_venta:product.precio_venta}:item;})); } })
      .catch(failure => { if (!ignore) setError(failure.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [filters, version]);
  function filter(name, value) { setFilters(previous => ({ ...previous, [name]: value, page: 1 })); }
  useEffect(()=>{document.title='Catálogo | NexoFarma';},[]);
  return <div className="storefront">
    <a className="skip-link" href="#catalog-content" onClick={event => { event.preventDefault(); document.getElementById('catalog-content').focus(); }}>Ir al catálogo</a>
    <header className="store-header"><a href="#home" className="brand"><span className="brand-mark">+</span><span>Nexo<span className="brand-light">Farma</span></span></a>
      <button className="button secondary" onClick={() => { try { setLastToken(localStorage.getItem('nexo-last-order') || ''); } catch {} setTrackingOpen(true); }}>Seguir mi pedido</button>
      <button key={animation} className={`button primary ${animation ? 'cart-bump' : ''}`} onClick={() => setCartOpen(true)}><ShoppingCart size={18} />Carrito ({cart.reduce((sum, item) => sum + item.cantidad, 0)})</button>
      <button className="button secondary" onClick={() => onNavigate(hasSession ? 'inicio' : 'login')}><ShieldCheck size={18} />{hasSession ? 'Panel del personal' : 'Acceso del personal'}</button></header>
    <main id="catalog-content" className="store-content" tabIndex={-1}><section className="store-hero"><div><span className="eyebrow">Tu farmacia, más cerca</span><h1>Encuentra lo que necesitas.<br /><em>Consulta antes de visitar.</em></h1><p>Busca medicamentos y descubre en qué sucursales están disponibles. Acceso libre, sin crear una cuenta.</p></div><div className="store-illustration" aria-hidden="true"><Pill size={72} strokeWidth={1.3} /><span>+</span><MapPin size={36} /></div></section>
      <section className="panel store-filters" aria-label="Filtros del catálogo"><form onSubmit={event => { event.preventDefault(); filter('q', search.trim()); }}>
        <label className="store-search">Buscar producto o principio activo<div className="search-box"><Search size={20} /><ProductAutocomplete value={search} onChange={setSearch} onSelect={product=>filter('q',product.nombre)} category={filters.categoria} branch={filters.id_sucursal} maxLength={100} placeholder="Por ejemplo: paracetamol" /><button className="button primary" type="submit">Buscar<ArrowRight size={16} /></button></div></label>
        <label>Sucursal<select aria-label="Sucursal" value={filters.id_sucursal} onChange={event => filter('id_sucursal', event.target.value)}><option value="">Todas las sucursales</option>{result.sucursales.map(branch => <option key={branch.id_sucursal} value={branch.id_sucursal}>{branch.nombre} · {branch.departamento}</option>)}</select></label>
        <label>Categoría<select aria-label="Categoría" value={filters.categoria} onChange={event => filter('categoria', event.target.value)}><option value="">Todas las categorías</option>{result.categorias.map(category => <option key={category}>{category}</option>)}</select></label>
      </form><div className="store-filter-bottom"><span>Al elegir una sucursal mostramos los productos disponibles allí.</span><button className="button subtle small" onClick={() => { setSearch(''); setFilters({ q: '', id_sucursal: '', categoria: '', page: 1 }); }}>Limpiar filtros</button></div></section>
      <div className="section-heading"><div><h2>Catálogo de medicamentos</h2><p className="muted">{loading ? 'Consultando disponibilidad…' : `${result.pagination.total} productos encontrados`}</p></div><button className="icon-button" aria-label="Actualizar catálogo" disabled={loading} onClick={() => setVersion(v => v + 1)}><RefreshCw size={19} /></button></div>
      <p role="status" className="cart-notice">{cartNotice}</p>
      <Notice>{error}</Notice>
      {loading ? <Loading text="Cargando productos…" /> : error ? <Empty description="No pudimos consultar el catálogo. Puedes actualizar e intentar nuevamente." /> : result.data.length === 0 ? <Empty description="No encontramos productos con estos filtros. Prueba otra búsqueda o sucursal." /> : <div className="product-grid">{result.data.map(product => <article className="product-card" key={product.id_medicamento}>
        <div className="product-visual"><ProductImage product={product} /><span className="badge green">{product.categoria}</span></div>
        <div className="product-body"><span className="eyebrow">{product.principio_activo}</span><h3>{product.nombre}</h3><p>{product.descripcion || 'Consulta detalles del producto en la sucursal.'}</p>
          <div className="product-price"><ProductPrice product={product} /><span>{product.requiere_receta ? 'Requiere receta médica' : 'Sin receta'}</span></div>
          <div className={`stock-note ${product.sucursales.length ? 'available' : ''}`}><span className="badge-dot" />{product.sucursales.length ? `Disponible en ${product.sucursales.length} ${product.sucursales.length === 1 ? 'sucursal' : 'sucursales'}` : 'Sin disponibilidad actualmente'}</div>
          {product.sucursales.length > 0 && <details className="product-branches"><summary>Ver sucursales disponibles</summary>{product.sucursales.map(branch => <div className="product-branch" key={branch.id_sucursal}><strong><MapPin size={15} />{branch.nombre}</strong><span>{branch.departamento} · {branch.direccion}</span>{branch.telefono && <span><Phone size={14} />{branch.telefono}</span>}</div>)}</details>}
          <button key={addedId===product.id_medicamento ? animation : 0} className={`button primary add-to-cart ${addedId===product.id_medicamento ? 'product-added' : ''}`} disabled={!product.sucursales.length} onClick={() => add(product)}><Plus size={17} />{product.sucursales.length ? 'Agregar al carrito' : 'Sin existencias'}</button>
        </div></article>)}</div>}
      {!error && !loading && <Pagination page={filters.page} total={result.pagination.total} limit={12} loading={loading} onChange={page => setFilters(previous => ({ ...previous, page }))} />}
      <p className="muted">Fotografías de referencia; la presentación puede variar. <a href="/catalog-photo-credits.html" target="_blank" rel="noreferrer">Créditos y licencias de las fotografías</a></p>
      <div className="store-note"><ShieldCheck size={20} /><p>La disponibilidad puede cambiar antes de tu visita. Los medicamentos con receta requieren su presentación en la farmacia. Este catálogo permite consultar; todavía no recibe compras por internet.</p></div>
      {trackingOpen && <Modal title="Seguimiento de pedido" onClose={() => setTrackingOpen(false)} wide><OrderTracking initialToken={lastToken} /></Modal>}
      {cartOpen && <ShoppingCartPanel items={cart} onChange={setCart} onClose={() => setCartOpen(false)} />}
    </main><footer className="store-footer"><span>NexoFarma · Salud cerca de ti</span><span>Guatemala · Precios en quetzales</span></footer>
  </div>;
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  return product.imagen_url && !failed ? <img src={product.imagen_url} alt={product.nombre} loading="lazy" onError={() => setFailed(true)} /> : <Pill size={56} strokeWidth={1.2} />;
}
