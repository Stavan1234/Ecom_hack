import { Router } from 'express';
import { db, md5, hashPassword, verifyPassword } from '../db.js';
import { isSecure } from '../mode.js';
import { logEvent, captureHttp } from '../events.js';
import { requireLogin, isForeignOrigin, rotateSession } from '../security.js';

export const accountRouter = Router();

const PROFILE_FIELDS = ['display_name', 'full_name', 'phone', 'address', 'city', 'country'];
const DISPLAY_NAME = /^[\p{L}\p{N} .,'’-]{2,40}$/u;

const readProfile = (id) => db.prepare('SELECT id, email, display_name, full_name, phone, address, city, country, role, vip_optin, created_at FROM users WHERE id = ?').get(id);

function isFormPost(req) {
  return String(req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
}

function applyProfileUpdate(req, values) {
  const before = readProfile(req.user.id);
  const secure = isSecure();
  const changes = {};
  for (const field of PROFILE_FIELDS) {
    if (values[field] !== undefined) changes[field] = String(values[field]).trim().slice(0, 200);
  }
  if (secure && changes.display_name !== undefined && !DISPLAY_NAME.test(changes.display_name)) {
    return { error: 'Display name may contain letters, numbers and basic punctuation (2-40 characters).', before };
  }
  if (!secure && values.role !== undefined) {
    // VULNERABLE: mass assignment lets a customer set their own role (Lab 6).
    changes.role = String(values.role);
    logEvent(req, { action: 'PROFILE_UPDATE', result: 'success', securityEvent: 'MASS_ASSIGNMENT', details: { from_role: before.role, to_role: changes.role } });
  } else if (secure && values.role !== undefined) {
    logEvent(req, { action: 'PROFILE_UPDATE', result: 'blocked', securityEvent: 'MASS_ASSIGNMENT_BLOCKED', details: { attempted_role: String(values.role) } });
  }
  const keys = Object.keys(changes);
  if (keys.length) {
    db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => changes[k]), req.user.id);
  }
  const after = readProfile(req.user.id);
  const foreign = isForeignOrigin(req);
  const changed = before.display_name !== after.display_name;
  logEvent(req, {
    action: 'PROFILE_UPDATE', result: 'success', status: 200,
    securityEvent: foreign ? 'CSRF_SUCCESS' : 'PROFILE_CHANGED',
    details: { display_name_from: before.display_name, display_name_to: after.display_name, fields: keys, cross_origin: foreign, sec_fetch_site: req.headers['sec-fetch-site'] ?? 'absent' },
  });
  return { before, after, changed };
}

accountRouter.get('/profile', requireLogin, (req, res) => {
  res.json({ profile: readProfile(req.user.id) });
});

// Accepts JSON from the storefront and, on purpose, classic form posts too.
// In vulnerable mode that is all a CSRF page needs.
accountRouter.post('/profile', (req, res) => {
  if (!req.user) {
    captureHttp(req, 'csrf', { status: 401, note: 'No authenticated session reached the server (cookie not sent or not valid)' });
    logEvent(req, {
      action: 'PROFILE_UPDATE', result: 'failure', status: 401, securityEvent: isForeignOrigin(req) ? 'CSRF_NO_COOKIE' : null,
      details: { note: 'No session cookie reached the server', sec_fetch_site: req.headers['sec-fetch-site'] ?? 'absent' },
    });
    if (isFormPost(req)) return res.status(401).type('text').send('The request reached the server without a valid session cookie, so nothing changed.');
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
  const { error, before, after } = applyProfileUpdate(req, req.body ?? {});
  if (error) {
    captureHttp(req, 'csrf', { status: 400, error }, before.display_name, before.display_name);
    return res.status(400).json({ error });
  }
  captureHttp(req, 'csrf', { status: isFormPost(req) ? 303 : 200, note: isFormPost(req) ? 'Redirected back to /account' : 'JSON profile returned' }, before.display_name, after.display_name);
  if (isFormPost(req)) return res.redirect(303, '/account');
  res.json({ profile: after });
});

// VULNERABLE: a state change over GET. Even SameSite=Lax cookies accompany top-level GET navigations.
accountRouter.get('/profile/quick-update', (req, res) => {
  if (isSecure()) {
    logEvent(req, { action: 'PROFILE_UPDATE', result: 'blocked', securityEvent: 'CSRF_BLOCKED', status: 405, details: { reason: 'State changes are not allowed over GET' } });
    return res.status(405).type('text').send('State changes are not accepted over GET in secure mode.');
  }
  if (!req.user) return res.status(401).type('text').send('The request reached the server without a valid session cookie, so nothing changed.');
  const { before, after } = applyProfileUpdate(req, { display_name: req.query.display_name });
  captureHttp(req, 'csrf', { status: 303, note: 'Redirected back to /account' }, before.display_name, after.display_name);
  res.redirect(303, '/account');
});

accountRouter.post('/account/password', requireLogin, (req, res) => {
  const current = String(req.body?.currentPassword ?? '');
  const next = String(req.body?.newPassword ?? '');
  if (!next) return res.status(400).json({ error: 'Please enter a new password.' });

  if (isSecure()) {
    const { password_hash: stored } = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(current, stored)) {
      logEvent(req, { action: 'PASSWORD_CHANGE', result: 'failure', securityEvent: 'PASSWORD_CHANGE_FAILED', status: 403 });
      return res.status(403).json({ error: 'Your current password is incorrect.' });
    }
    if (next.length < 10 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next)) {
      return res.status(400).json({ error: 'Passwords need at least 10 characters with upper case, lower case and a number.' });
    }
  }
  db.prepare('UPDATE users SET legacy_pw = ?, password_hash = ? WHERE id = ?').run(md5(next), hashPassword(next), req.user.id);

  let csrfToken = null;
  if (isSecure()) {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.session.id);
    csrfToken = rotateSession(req, res).csrf_token;
  }
  logEvent(req, { action: 'PASSWORD_CHANGE', result: 'success', securityEvent: 'PASSWORD_CHANGED', status: 200, details: { other_sessions_revoked: isSecure() } });
  res.json({ ok: true, csrfToken });
});

function orderDetail(order) {
  const items = db.prepare(`SELECT oi.product_id, oi.name, oi.unit_price, oi.quantity, p.slug FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`).all(order.id);
  return { ...order, items };
}

accountRouter.get('/orders', requireLogin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id).map(orderDetail);
  res.json({ orders });
});

accountRouter.post('/orders', requireLogin, (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const { name, address, city, country, note } = req.body ?? {};
  if (!items.length) return res.status(400).json({ error: 'Your bag is empty.' });
  if (![name, address, city, country].every((v) => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ error: 'Please complete your delivery details.' });
  }
  const lines = [];
  for (const item of items.slice(0, 50)) {
    const product = db.prepare('SELECT id, name, price, stock, slug FROM products WHERE slug = ? AND published = 1').get(String(item.slug));
    const quantity = Math.floor(Number(item.quantity));
    if (!product) return res.status(400).json({ error: 'An item in your bag is no longer available.' });
    if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'Invalid quantity.' });
    if (product.stock < quantity) return res.status(409).json({ error: `Only ${product.stock} of ${product.name} available.` });
    lines.push({ ...product, quantity });
  }
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const { lastInsertRowid } = db.prepare(`INSERT INTO orders (user_id, status, subtotal, shipping, total, ship_name, ship_address, ship_city, ship_country, note, created_at)
    VALUES (?, 'Processing', ?, 0, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, subtotal, subtotal, name.slice(0, 80), address.slice(0, 200), city.slice(0, 80), country.slice(0, 80), String(note ?? '').slice(0, 300), new Date().toISOString());
  const orderId = Number(lastInsertRowid);
  for (const l of lines) {
    db.prepare('INSERT INTO order_items (order_id, product_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)').run(orderId, l.id, l.name, l.price, l.quantity);
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(l.quantity, l.id);
  }
  logEvent(req, { action: 'ORDER_CREATE', result: 'success', securityEvent: 'ORDER_PLACED', status: 201, details: { order_id: orderId, total: subtotal } });
  res.status(201).json({ order: orderDetail(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)) });
});

accountRouter.get('/orders/:id', requireLogin, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  const notOwner = order && order.user_id !== req.user.id && req.user.role !== 'admin';
  if (isSecure()) {
    // SECURE: ownership enforced on the server. Same 404 as a missing order, so IDs cannot be probed.
    if (!order || notOwner) {
      if (notOwner) logEvent(req, { action: 'ORDER_READ', result: 'blocked', securityEvent: 'ACCESS_DENIED', status: 404, details: { order_id: order.id, reason: 'Not the owner' } });
      return res.status(404).json({ error: 'We could not find that order.' });
    }
    return res.json({ order: orderDetail(order) });
  }
  if (!order) return res.status(404).json({ error: 'We could not find that order.' });
  // VULNERABLE: any signed-in user can read any order by changing the number (IDOR).
  if (notOwner) logEvent(req, { action: 'ORDER_READ', result: 'success', securityEvent: 'IDOR_ACCESS', status: 200, details: { order_id: order.id, owner_user_id: order.user_id } });
  res.json({ order: orderDetail(order) });
});

// VULNERABLE: horizontal access to another customer's profile by numeric ID.
accountRouter.get('/users/:id', requireLogin, (req, res) => {
  const id = Number(req.params.id);
  const notSelf = id !== req.user.id && req.user.role !== 'admin';
  if (isSecure() && notSelf) {
    logEvent(req, { action: 'USER_READ', result: 'blocked', securityEvent: 'ACCESS_DENIED', status: 403, details: { target_user_id: id } });
    return res.status(403).json({ error: 'You do not have access to this profile.' });
  }
  const profile = readProfile(id);
  if (!profile) return res.status(404).json({ error: 'No such user.' });
  if (notSelf) logEvent(req, { action: 'USER_READ', result: 'success', securityEvent: 'IDOR_ACCESS', status: 200, details: { target_user_id: id } });
  res.json({ profile });
});

accountRouter.post('/vip-optin', requireLogin, (req, res) => {
  const framed = Boolean(req.body?.framed);
  db.prepare('UPDATE users SET vip_optin = 1 WHERE id = ?').run(req.user.id);
  logEvent(req, {
    action: 'VIP_OPTIN', result: 'success', status: 200,
    securityEvent: framed ? 'CLICKJACK_FRAMED_ACTION' : 'VIP_OPTIN_DIRECT',
    details: { framed, sec_fetch_site: req.headers['sec-fetch-site'] ?? 'absent', parent: req.body?.parent ? String(req.body.parent).slice(0, 80) : 'unknown' },
  });
  res.json({ ok: true });
});

accountRouter.post('/vip-optout', requireLogin, (req, res) => {
  db.prepare('UPDATE users SET vip_optin = 0 WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (req.user.role === 'admin') return next();
  if (isSecure()) {
    logEvent(req, { action: 'ADMIN_ACCESS', result: 'blocked', securityEvent: 'ACCESS_DENIED', status: 403, details: { reason: 'Admin role required' } });
    return res.status(403).json({ error: 'Administrator access is required.' });
  }
  // VULNERABLE: the storefront hides the admin link, but the API never checks the role.
  logEvent(req, { action: 'ADMIN_ACCESS', result: 'success', securityEvent: 'ADMIN_ROUTE_EXPOSED', status: 200, details: { role: req.user.role } });
  next();
}

accountRouter.get('/admin/stats', requireAdmin, (req, res) => {
  const revenue = db.prepare('SELECT COALESCE(SUM(total), 0) AS v FROM orders').get().v;
  const orders = db.prepare('SELECT COUNT(*) AS v FROM orders').get().v;
  const customers = db.prepare("SELECT COUNT(*) AS v FROM users WHERE role = 'customer'").get().v;
  const products = db.prepare('SELECT COUNT(*) AS v FROM products WHERE published = 1').get().v;
  const lowStock = db.prepare('SELECT slug, name, stock FROM products WHERE published = 1 AND stock <= 2 ORDER BY stock, name LIMIT 8').all();
  const byCategory = db.prepare(`SELECT p.category, SUM(oi.unit_price * oi.quantity) AS revenue FROM order_items oi JOIN products p ON p.id = oi.product_id GROUP BY p.category ORDER BY revenue DESC`).all();
  res.json({ revenue, orders, customers, products, lowStock, byCategory });
});

accountRouter.get('/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare(`SELECT u.id, u.email, u.display_name, u.role, u.city, u.country, u.vip_optin, u.created_at,
    (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count FROM users u ORDER BY u.id`).all();
  res.json({ users });
});

accountRouter.get('/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare(`SELECT o.id, o.status, o.total, o.created_at, o.ship_city, o.ship_country, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`).all();
  res.json({ orders });
});

accountRouter.patch('/admin/orders/:id', requireAdmin, (req, res) => {
  const status = String(req.body?.status ?? '');
  if (!['Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) return res.status(400).json({ error: 'Unknown status.' });
  const { changes } = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, Number(req.params.id));
  if (!changes) return res.status(404).json({ error: 'We could not find that order.' });
  logEvent(req, { action: 'ORDER_STATUS', result: 'success', securityEvent: 'ORDER_STATUS_CHANGED', details: { order_id: Number(req.params.id), status } });
  res.json({ ok: true });
});

accountRouter.get('/admin/products', requireAdmin, (req, res) => {
  res.json({ products: db.prepare('SELECT id, slug, name, category, price, stock, published FROM products ORDER BY category, name').all() });
});

accountRouter.patch('/admin/products/:id', requireAdmin, (req, res) => {
  const price = Number(req.body?.price);
  const stock = Number(req.body?.stock);
  if (!(price > 0) || !Number.isInteger(stock) || stock < 0) return res.status(400).json({ error: 'Please enter a valid price and stock level.' });
  const { changes } = db.prepare('UPDATE products SET price = ?, stock = ? WHERE id = ?').run(price, stock, Number(req.params.id));
  if (!changes) return res.status(404).json({ error: 'We could not find that product.' });
  logEvent(req, { action: 'PRODUCT_UPDATE', result: 'success', securityEvent: 'PRODUCT_CHANGED', details: { product_id: Number(req.params.id), price, stock } });
  res.json({ ok: true });
});
