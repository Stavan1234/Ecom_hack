import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, imageUrl, money } from '../api.js';
import { EmptyState, Spinner } from '../components.jsx';
import { useApp } from '../store.jsx';

export function Cart() {
  const { cart, setQuantity, clearCart } = useApp();
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    if (cart.length === 0) { setQuote({ lines: [], total: 0 }); return; }
    api('/api/cart/quote', { method: 'POST', body: { items: cart } }).then(setQuote).catch(() => setQuote({ lines: [], total: 0 }));
  }, [cart]);

  if (!quote) return <div className="page"><Spinner /></div>;
  if (quote.lines.length === 0) {
    return <div className="page"><EmptyState title="Your bag is empty" action={<Link className="btn" to="/shop">Discover the collection</Link>}>Pieces you add will appear here.</EmptyState></div>;
  }

  return (
    <div className="page">
      <header className="page-head"><h1>Your bag</h1></header>
      <div className="cart-layout">
        <div className="cart-lines">
          {quote.lines.map(({ product, quantity }) => (
            <div key={product.slug} className="cart-line">
              <Link to={`/product/${product.slug}`} className="cart-thumb"><img src={imageUrl(product.slug)} alt={product.name} /></Link>
              <div className="cart-line-info">
                <p className="eyebrow">{product.collection}</p>
                <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
                <p className="price">{money(product.price)}</p>
              </div>
              <div className="cart-line-controls">
                <div className="qty">
                  <button type="button" onClick={() => setQuantity(product.slug, quantity - 1)} aria-label="Decrease">−</button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => setQuantity(product.slug, quantity + 1)} aria-label="Increase">+</button>
                </div>
                <button type="button" className="link-button" onClick={() => setQuantity(product.slug, 0)}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="link-button" onClick={clearCart}>Empty bag</button>
        </div>
        <aside className="cart-summary">
          <h2>Summary</h2>
          <div className="summary-row"><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>
          <div className="summary-row"><span>Delivery</span><span>Complimentary</span></div>
          <div className="summary-row total"><span>Total</span><span>{money(quote.total)}</span></div>
          <Link to="/checkout" className="btn block">Proceed to checkout</Link>
          <p className="summary-note">A simulated checkout. No payment is taken and nothing ships.</p>
        </aside>
      </div>
    </div>
  );
}

export function Checkout() {
  const { cart, user, clearCart, notify } = useApp();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', country: '', note: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cart.length === 0) { setQuote({ lines: [], total: 0 }); return; }
    api('/api/cart/quote', { method: 'POST', body: { items: cart } }).then(setQuote).catch(() => setQuote({ lines: [], total: 0 }));
  }, [cart]);

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.displayName }));
  }, [user]);

  if (!quote) return <div className="page"><Spinner /></div>;
  if (!user) {
    return <div className="page narrow"><EmptyState title="Please sign in to check out" action={<Link className="btn" to="/login?next=/checkout">Sign in</Link>} /></div>;
  }
  if (quote.lines.length === 0) {
    return <div className="page"><EmptyState title="Your bag is empty" action={<Link className="btn" to="/shop">Discover the collection</Link>} /></div>;
  }

  const place = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api('/api/orders', { method: 'POST', body: { items: cart, ...form } });
      clearCart();
      notify('Order placed. Thank you.');
      navigate(`/order-confirmed/${d.order.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head"><h1>Checkout</h1></header>
      <div className="cart-layout">
        <form className="checkout-form" onSubmit={place}>
          <h2>Delivery details</h2>
          {error && <div className="inline-error">{error}</div>}
          <div className="field"><label htmlFor="name">Full name</label><input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="address">Address</label><input id="address" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="field-row">
            <div className="field"><label htmlFor="city">City</label><input id="city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="field"><label htmlFor="country">Country</label><input id="country" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="note">Delivery note (optional)</label><textarea id="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <button className="btn block" disabled={busy}>{busy ? 'Placing order…' : `Place order · ${money(quote.total)}`}</button>
          <p className="summary-note">Simulated only. No card is requested and no payment is taken.</p>
        </form>
        <aside className="cart-summary">
          <h2>Your order</h2>
          {quote.lines.map(({ product, quantity }) => (
            <div key={product.slug} className="summary-row"><span>{quantity} × {product.name}</span><span>{money(product.price * quantity)}</span></div>
          ))}
          <div className="summary-row total"><span>Total</span><span>{money(quote.total)}</span></div>
        </aside>
      </div>
    </div>
  );
}

export function OrderConfirmed() {
  const { id } = useParams();
  return (
    <div className="page narrow">
      <div className="confirm">
        <div className="confirm-mark" aria-hidden="true">✓</div>
        <h1>Thank you</h1>
        <p>Your order <strong>#{id}</strong> has been placed. A fictional confirmation would normally arrive by email.</p>
        <div className="confirm-cta">
          <Link to={`/account/orders/${id}`} className="btn">View order</Link>
          <Link to="/shop" className="btn ghost">Continue browsing</Link>
        </div>
      </div>
    </div>
  );
}
