import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api, imageUrl, money, shortDate } from '../api.js';
import { EmptyState, ProductGrid, RequireLogin, Spinner, Stars } from '../components.jsx';
import { useApp } from '../store.jsx';

export function AccountLayout() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  return (
    <RequireLogin>
      <div className="page account">
        <header className="page-head">
          <p className="eyebrow">Your account</p>
          <h1>{user?.displayName}</h1>
          <p>{user?.email}{user?.role === 'admin' ? ' · Administrator' : ''}</p>
        </header>
        <div className="account-layout">
          <nav className="account-nav">
            <NavLink end to="/account">Overview</NavLink>
            <NavLink to="/account/orders">Orders</NavLink>
            <NavLink to="/account/wishlist">Wishlist</NavLink>
            <NavLink to="/account/settings">Settings</NavLink>
            {user?.role === 'admin' && <Link to="/admin">Admin dashboard</Link>}
            <button type="button" className="account-signout" onClick={async () => { await logout(); navigate('/'); }}>Sign out</button>
          </nav>
          <div className="account-body"><Outlet /></div>
        </div>
      </div>
    </RequireLogin>
  );
}

export function Overview() {
  const { user } = useApp();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    Promise.all([api('/api/orders'), api('/api/wishlist')])
      .then(([o, w]) => setStats({ orders: o.orders, wishlist: w.products }))
      .catch(() => setStats({ orders: [], wishlist: [] }));
  }, []);
  if (!stats) return <Spinner />;
  return (
    <div>
      <div className="stat-cards">
        <div className="stat-card"><span className="stat-value">{stats.orders.length}</span><span className="stat-label">Orders</span></div>
        <div className="stat-card"><span className="stat-value">{stats.wishlist.length}</span><span className="stat-label">Wishlist</span></div>
        <div className="stat-card"><span className="stat-value">{user?.role === 'admin' ? 'Admin' : 'Member'}</span><span className="stat-label">Account</span></div>
      </div>
      <h2 className="account-h2">Recent orders</h2>
      {stats.orders.length === 0
        ? <p className="muted">You have not placed any orders yet.</p>
        : (
          <div className="order-list">
            {stats.orders.slice(0, 3).map((o) => (
              <Link key={o.id} to={`/account/orders/${o.id}`} className="order-row">
                <div><strong>Order #{o.id}</strong><span>{shortDate(o.created_at)}</span></div>
                <span className={`status ${o.status.toLowerCase()}`}>{o.status}</span>
                <span className="price">{money(o.total)}</span>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}

export function Orders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { api('/api/orders').then((d) => setOrders(d.orders)).catch(() => setOrders([])); }, []);
  if (!orders) return <Spinner />;
  if (orders.length === 0) return <EmptyState title="No orders yet" action={<Link className="btn" to="/shop">Start shopping</Link>} />;
  return (
    <div className="order-list">
      {orders.map((o) => (
        <Link key={o.id} to={`/account/orders/${o.id}`} className="order-row">
          <div><strong>Order #{o.id}</strong><span>{shortDate(o.created_at)} · {o.items.length} item{o.items.length > 1 ? 's' : ''}</span></div>
          <span className={`status ${o.status.toLowerCase()}`}>{o.status}</span>
          <span className="price">{money(o.total)}</span>
        </Link>
      ))}
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setOrder(null);
    setError(null);
    api(`/api/orders/${id}`).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <EmptyState title="Order unavailable" action={<Link className="btn" to="/account/orders">Back to orders</Link>}>{error}</EmptyState>;
  if (!order) return <Spinner />;

  return (
    <div className="order-detail">
      <Link to="/account/orders" className="text-link">← All orders</Link>
      <div className="order-detail-head">
        <h2 className="account-h2">Order #{order.id}</h2>
        <span className={`status ${order.status.toLowerCase()}`}>{order.status}</span>
      </div>
      <p className="muted">Placed {shortDate(order.created_at)}</p>
      <div className="order-items">
        {order.items.map((it) => (
          <div key={it.product_id} className="order-item">
            <Link to={`/product/${it.slug}`} className="order-item-thumb"><img src={imageUrl(it.slug)} alt={it.name} /></Link>
            <div><strong>{it.name}</strong><span>Quantity: {it.quantity}</span></div>
            <span className="price">{money(it.unit_price * it.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="order-ship">
        <div><h4>Delivery</h4><p>{order.ship_name}<br />{order.ship_address}<br />{order.ship_city}, {order.ship_country}</p></div>
        {order.note && <div><h4>Note</h4><p>{order.note}</p></div>}
        <div><h4>Total</h4><p className="price">{money(order.total)}</p></div>
      </div>
    </div>
  );
}

export function Wishlist() {
  const [products, setProducts] = useState(null);
  useEffect(() => { api('/api/wishlist').then((d) => setProducts(d.products)).catch(() => setProducts([])); }, []);
  if (!products) return <Spinner />;
  if (products.length === 0) return <EmptyState title="Your wishlist is empty" action={<Link className="btn" to="/shop">Find something to love</Link>} />;
  return <ProductGrid products={products} />;
}

export function Settings() {
  const { user, refreshAuth, notify, mode } = useApp();
  const [profile, setProfile] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState({});

  useEffect(() => { api('/api/profile').then((d) => setProfile(d.profile)).catch(() => {}); }, []);
  if (!profile) return <Spinner />;

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg({});
    try {
      await api('/api/profile', { method: 'POST', body: profile });
      await refreshAuth();
      notify('Profile updated.');
    } catch (err) { setMsg({ profile: err.message }); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setMsg({});
    try {
      await api('/api/account/password', { method: 'POST', body: pw });
      setPw({ currentPassword: '', newPassword: '' });
      notify('Password changed.');
    } catch (err) { setMsg({ pw: err.message }); }
  };

  return (
    <div className="settings">
      <form onSubmit={saveProfile} className="settings-block">
        <h2 className="account-h2">Profile</h2>
        {msg.profile && <div className="inline-error">{msg.profile}</div>}
        <div className="field"><label>Display name</label><input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} /></div>
        <div className="field"><label>Full name</label><input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
        <div className="field-row">
          <div className="field"><label>Phone</label><input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
          <div className="field"><label>City</label><input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} /></div>
        </div>
        <div className="field"><label>Address</label><input value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></div>
        <div className="field"><label>Country</label><input value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} /></div>
        <button className="btn">Save profile</button>
      </form>

      <form onSubmit={savePassword} className="settings-block">
        <h2 className="account-h2">Password</h2>
        {msg.pw && <div className="inline-error">{msg.pw}</div>}
        {mode === 'vulnerable' && <div className="inline-note">In vulnerable mode the current password is not checked and other sessions are not revoked.</div>}
        <div className="field"><label>Current password</label><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
        <div className="field"><label>New password</label><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></div>
        <button className="btn">Change password</button>
      </form>
    </div>
  );
}
