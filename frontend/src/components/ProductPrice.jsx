import { money } from '../utils/format.js';
export default function ProductPrice({product}) {
  return <span className="product-price-group">{Number(product.descuento_aplicado)>0 && <del>{money(product.precio_regular)}</del>}<strong>{money(product.precio_venta)}</strong>{Number(product.descuento_aplicado)>0 && <span className="promo-badge">−{product.descuento_aplicado}%</span>}</span>;
}
