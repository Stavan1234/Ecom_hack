import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, shortDate } from '../api.js';
import { EmptyState, Spinner } from '../components.jsx';
import { useApp } from '../store.jsx';

export default function Admin() {
  const { user, ready, mode } = useApp();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ready) return;
    api('/api/admin/stats').then((d) => setData((s) => ({ ...s, stats: d }))).catch((e) => setError(e.message));
  }, [ready]);

  useEffect(() => {
    if (tab === 'users' && !data.users) api('/api/admin/users').then((d) => setData((s) => ({ ...s, users: d.users }))).catch(() => {});
    if (tab === 'orders' && !data.orders) api('/api/admin/orders').then((d) => setData((s) => ({ ...s, orders: d.orders }))).catch(() => {});
  }, [tab, data]);

  if (!ready) return <div className="page"><Spinner /></div>;

  if (error) {
    return (
      <div className="page narrow">
        <EmptyState title="Administrator access required" action={<Link className="btn" to="/">Return home</Link>}>
          {error}
        </EmptyState>
      </div>
    );
  }
  if (!data.stats) return <div className="page"><Spinner /></div>;

  const { stats } = data;

  return (
    <div className="page admin">
      <header className="page-head">
        <p className="eyebrow">Administration</p>
        <h1>Dashboard</h1>
        {user?.role !== 'admin' && mode === 'vulnerable' && (
          <div className="inline-note">You are viewing this as <strong>{user?.role}</strong>. The storefront hid the Admin link, but the API did not enforce the role. This is the Lab 6 access-control finding.</div>
        )}
      </header>

      <div className="chips" style={{ marginBottom: 28 }}>
        {['overview', 'orders', 'users'].map((t) => (
          <button type="button" key={t} className={`chip ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="stat-cards admin-stats">
            <div className="stat-card"><span className="stat-value">{money(stats.revenue)}</span><span className="stat-label">Revenue</span></div>
            <div className="stat-card"><span className="stat-value">{stats.orders}</span><span className="stat-label">Orders</span></div>
            <div className="stat-card"><span className="stat-value">{stats.customers}</span><span className="stat-label">Customers</span></div>
            <div className="stat-card"><span className="stat-value">{stats.products}</span><span className="stat-label">Products</span></div>
          </div>
          <div className="admin-cols">
            <div>
              <h2 className="account-h2">Revenue by category</h2>
              <div className="bar-list">
                {stats.byCategory.map((c) => {
                  const max = Math.max(...stats.byCategory.map((x) => x.revenue));
                  return (
                    <div key={c.category} className="bar-row">
                      <span className="bar-label">{c.category}</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.revenue / max) * 100}%` }} /></div>
                      <span className="bar-value">{money(c.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h2 className="account-h2">Low stock</h2>
              <div className="order-list">
                {stats.lowStock.map((p) => (
                  <div key={p.slug} className="order-row"><div><strong>{p.name}</strong></div><span className={`status ${p.stock === 0 ? 'cancelled' : 'processing'}`}>{p.stock} left</span></div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'orders' && (
        !data.orders ? <Spinner /> : (
          <table className="admin-table">
            <thead><tr><th>#</th><th>Customer</th><th>Destination</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}><td>#{o.id}</td><td>{o.email}</td><td>{o.ship_city}, {o.ship_country}</td><td><span className={`status ${o.status.toLowerCase()}`}>{o.status}</span></td><td>{money(o.total)}</td></tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'users' && (
        !data.users ? <Spinner /> : (
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Role</th><th>Location</th><th>Orders</th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}><td>{u.id}</td><td>{u.email}</td><td>{u.display_name}</td><td><span className={`role ${u.role}`}>{u.role}</span></td><td>{u.city || '—'}, {u.country || '—'}</td><td>{u.order_count}</td></tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
