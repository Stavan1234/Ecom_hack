import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, imageUrl, money } from './api.js';
import { useApp } from './store.jsx';

function LabStrip() {
  const { mode, publicDemo } = useApp();
  if (!mode) return null;
  if (publicDemo) {
    return (
      <div className="lab-strip secure">
        <span><b>Public preview.</b> A fictional shop running in secure mode only. Use fabricated details, never real ones.</span>
        <Link to="/lab">About this project →</Link>
      </div>
    );
  }
  return (
    <div className={`lab-strip ${mode}`}>
      <span>
        <b>Training environment.</b> Fictional shop, loopback only.{' '}
        <span className="lab-strip-mode">{mode === 'vulnerable' ? 'Intentionally vulnerable mode' : 'Secure mode'}</span>
      </span>
      <Link to="/lab">Security Lab →</Link>
    </div>
  );
}

function Header() {
  const { user, cartCount, logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="site-header">
      <div className="header-row">
        <button type="button" className="menu-toggle" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
          <span /><span /><span />
        </button>
        <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Main">
          <NavLink to="/shop/timepieces">Timepieces</NavLink>
          <NavLink to="/shop/automobiles">Automobiles</NavLink>
          <NavLink to="/shop/accessories">Atelier</NavLink>
          <NavLink to="/journal">Journal</NavLink>
          <NavLink to="/boutiques">Boutiques</NavLink>
        </nav>
        <Link to="/" className="brand" aria-label="Halden and Voss home">Halden <i>&amp;</i> Voss</Link>
        <div className="header-actions">
          <form onSubmit={submit} className="header-search" role="search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search the collection" />
          </form>
          {user ? (
            <>
              {user.role === 'admin' && <Link to="/admin" className="head-link">Admin</Link>}
              <Link to="/account" className="head-link" title={user.email}>{user.displayName}</Link>
              <button type="button" className="head-link as-button" onClick={async () => { await logout(); navigate('/'); }}>Sign out</button>
            </>
          ) : (
            <Link to="/login" className="head-link">Sign in</Link>
          )}
          <Link to="/bag" className="head-link bag-link">Bag{cartCount > 0 && <span className="bag-count">{cartCount}</span>}</Link>
        </div>
      </div>
    </header>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/newsletter', { method: 'POST', body: { email } });
      setState({ ok: 'Thank you. You are on the list for our next private preview.' });
      setEmail('');
    } catch (error) {
      setState({ error: error.message });
    }
  };
  return (
    <form className="newsletter" onSubmit={submit}>
      <label htmlFor="news-email">The private preview list</label>
      <div>
        <input id="news-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" />
        <button type="submit">Join</button>
      </div>
      {state.ok && <p className="form-ok">{state.ok}</p>}
      {state.error && <p className="form-error">{state.error}</p>}
    </form>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <p className="brand">Halden <i>&amp;</i> Voss</p>
          <p>Fine timepieces and collector automobiles, made in small numbers since an entirely fictional 1889.</p>
          <Newsletter />
        </div>
        <div>
          <h4>Collection</h4>
          <Link to="/shop/timepieces">Timepieces</Link>
          <Link to="/shop/automobiles">Automobiles</Link>
          <Link to="/shop/accessories">Atelier accessories</Link>
          <Link to="/engraving">Engraving studio</Link>
          <a href="/classic/search">Classic catalogue</a>
        </div>
        <div>
          <h4>The Maison</h4>
          <Link to="/about">Our story</Link>
          <Link to="/journal">Journal</Link>
          <Link to="/boutiques">Boutiques</Link>
          <Link to="/care">Care and servicing</Link>
        </div>
        <div>
          <h4>Client service</h4>
          <Link to="/contact">Contact us</Link>
          <Link to="/policies/shipping">Shipping</Link>
          <Link to="/policies/returns">Returns</Link>
          <Link to="/policies/privacy">Privacy</Link>
          <Link to="/lab">Security Lab</Link>
        </div>
      </div>
      <p className="footer-note">Halden &amp; Voss is a fictional brand created for a security training exercise. No product, person or order here is real, and nothing can be purchased.</p>
    </footer>
  );
}

export function Layout() {
  const { toast } = useApp();
  return (
    <div className="site">
      <LabStrip />
      <Header />
      <main className="site-main"><Outlet /></main>
      <Footer />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export function ProductCard({ product }) {
  const { addToCart, notify } = useApp();
  const soldOut = Number(product.stock) === 0;
  return (
    <article className="product-card">
      <Link to={`/product/${product.slug}`} className="product-image">
        <img src={imageUrl(product.slug)} alt={product.name} loading="lazy" />
        {Number(product.stock) > 0 && Number(product.stock) <= 2 && <span className="tag">Last {product.stock}</span>}
        {soldOut && <span className="tag">Sold out</span>}
      </Link>
      <div className="product-meta">
        <p className="eyebrow">{product.collection}</p>
        <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
        <div className="product-foot">
          <span className="price">{money(product.price)}</span>
          {!soldOut && (
            <button type="button" className="link-button" onClick={() => { addToCart(product.slug); notify(`${product.name} added to your bag`); }}>
              Add to bag
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }) {
  return <div className="product-grid">{products.map((p) => <ProductCard key={`${p.id}-${p.slug}`} product={p} />)}</div>;
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="product-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card"><div className="skeleton img" /><div className="skeleton line" /><div className="skeleton line short" /></div>
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-mark" aria-hidden="true" />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="spinner-wrap" role="status"><div className="spinner" /><span>{label}</span></div>;
}

export function RequireLogin({ children }) {
  const { user, ready } = useApp();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) {
    return (
      <div className="page narrow">
        <EmptyState title="Please sign in" action={<Link className="btn" to={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link>}>
          You need an account to view this page.
        </EmptyState>
      </div>
    );
  }
  return children;
}

export function Stars({ value }) {
  return <span className="stars" aria-label={`${value} out of 5`}>{'★'.repeat(value)}<span>{'★'.repeat(5 - value)}</span></span>;
}
