import { Router } from 'express';
import { db, trainingDb } from '../db.js';
import { isSecure, getMode } from '../mode.js';
import { logEvent } from '../events.js';
import { recordQuery } from '../queries.js';
import { requireLogin, SUSPICIOUS_SQL, SUSPICIOUS_HTML } from '../security.js';

export const storeRouter = Router();

const CARD_FIELDS = 'id, slug, name, collection, category, subcategory, price, stock, short, featured';
const SORTS = {
  featured: 'featured DESC, price DESC',
  'price-asc': 'price ASC',
  'price-desc': 'price DESC',
  name: 'name ASC',
};

storeRouter.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT category, subcategory, COUNT(*) AS count FROM products WHERE published = 1 GROUP BY category, subcategory ORDER BY category, subcategory').all();
  res.json({ categories: rows });
});

storeRouter.get('/products', (req, res) => {
  const where = ['published = 1'];
  const params = [];
  if (req.query.category) { where.push('category = ?'); params.push(String(req.query.category)); }
  if (req.query.subcategory) { where.push('subcategory = ?'); params.push(String(req.query.subcategory)); }
  if (req.query.collection) { where.push('collection = ?'); params.push(String(req.query.collection)); }
  if (req.query.min) { where.push('price >= ?'); params.push(Number(req.query.min)); }
  if (req.query.max) { where.push('price <= ?'); params.push(Number(req.query.max)); }
  if (req.query.featured) where.push('featured = 1');
  if (req.query.inStock) where.push('stock > 0');
  const order = SORTS[req.query.sort] ?? SORTS.featured;
  const limit = Math.min(Number(req.query.limit) || 48, 48);
  const products = db.prepare(`SELECT ${CARD_FIELDS} FROM products WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`).all(...params, limit);
  res.json({ products });
});

storeRouter.get('/search', (req, res) => {
  const q = String(req.query.q ?? '');
  const columns = 'id, slug, name, collection, category, price, stock';

  if (isSecure()) {
    const sql = `SELECT ${columns} FROM products WHERE published = 1 AND (name LIKE ? OR collection LIKE ? OR category LIKE ?) ORDER BY featured DESC`;
    const like = `%${q}%`;
    const products = db.prepare(sql).all(like, like, like);
    recordQuery({ source: 'search', mode: 'secure', sql, params: [like, like, like], rows: products.length });
    if (SUSPICIOUS_SQL.test(q)) logEvent(req, { action: 'SEARCH', result: 'blocked', securityEvent: 'SQLI_NEUTRALIZED', details: { source: 'search', input: q } });
    return res.json({ products });
  }

  // VULNERABLE: the search term is concatenated into the statement (Lab 4).
  const sql = `SELECT ${columns} FROM products WHERE published = 1 AND (name LIKE '%${q}%' OR collection LIKE '%${q}%' OR category LIKE '%${q}%') ORDER BY featured DESC`;
  try {
    const products = trainingDb.prepare(sql).all();
    recordQuery({ source: 'search', mode: 'vulnerable', sql, params: null, rows: products.length });
    if (SUSPICIOUS_SQL.test(q)) {
      const union = /\bunion\b/i.test(q);
      logEvent(req, { action: 'SEARCH', result: 'success', securityEvent: union ? 'SQLI_UNION' : 'SQLI_SUSPECTED', details: { input: q, rows: products.length } });
    }
    if (products.some((p) => p.slug === 'prototype-x-unreleased')) {
      logEvent(req, { action: 'SEARCH', result: 'success', securityEvent: 'SQLI_HIDDEN_PRODUCT', details: { input: q } });
    }
    res.json({ products });
  } catch (error) {
    recordQuery({ source: 'search', mode: 'vulnerable', sql, params: null, error: error.message });
    logEvent(req, { action: 'SEARCH', result: 'failure', securityEvent: 'SQL_ERROR_EXPOSED', status: 500, details: { input: q, message: error.message } });
    // VULNERABLE: verbose error discloses the query structure.
    res.status(500).json({ error: `SQLITE_ERROR: ${error.message}`, sql });
  }
});

storeRouter.get('/products/:slug', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'We could not find that piece.' });
  const reviews = db.prepare('SELECT id, author, rating, body, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC').all(product.id);
  const related = db.prepare(`SELECT ${CARD_FIELDS} FROM products WHERE published = 1 AND category = ? AND id != ? ORDER BY (collection = ?) DESC, featured DESC LIMIT 4`).all(product.category, product.id, product.collection);
  const wished = req.user ? Boolean(db.prepare('SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?').get(req.user.id, product.id)) : false;
  res.json({ product: { ...product, specs: JSON.parse(product.specs), image: undefined }, reviews, related, wished, reviewRendering: getMode() === 'secure' ? 'text' : 'html' });
});

storeRouter.post('/products/:slug/reviews', requireLogin, (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'We could not find that piece.' });
  const body = String(req.body?.body ?? '').trim();
  const rating = Number(req.body?.rating);
  if (!body || body.length > 2000) return res.status(400).json({ error: 'Please write a review of up to 2000 characters.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Please choose a rating from 1 to 5.' });

  if (SUSPICIOUS_HTML.test(body)) {
    logEvent(req, {
      action: 'REVIEW_CREATE', result: isSecure() ? 'blocked' : 'success',
      securityEvent: isSecure() ? 'XSS_NEUTRALIZED' : 'XSS_PAYLOAD_STORED',
      details: { context: 'stored', input: body, note: isSecure() ? 'Saved as text and rendered with output encoding' : 'Saved raw, will render as HTML' },
    });
  }
  const { lastInsertRowid } = db.prepare('INSERT INTO reviews (product_id, user_id, author, rating, body, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(product.id, req.user.id, req.user.display_name, rating, body, new Date().toISOString());
  const review = db.prepare('SELECT id, author, rating, body, created_at FROM reviews WHERE id = ?').get(Number(lastInsertRowid));
  res.status(201).json({ review });
});

storeRouter.get('/wishlist', requireLogin, (req, res) => {
  const products = db.prepare(`SELECT p.id, p.slug, p.name, p.collection, p.category, p.subcategory, p.price, p.stock, p.short, p.featured
    FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id = ? ORDER BY w.created_at DESC`).all(req.user.id);
  res.json({ products });
});

storeRouter.post('/wishlist/:slug', requireLogin, (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'We could not find that piece.' });
  db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, ?)').run(req.user.id, product.id, new Date().toISOString());
  res.json({ wished: true });
});

storeRouter.delete('/wishlist/:slug', requireLogin, (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = (SELECT id FROM products WHERE slug = ?)').run(req.user.id, req.params.slug);
  res.json({ wished: false });
});

storeRouter.post('/cart/quote', (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const lines = [];
  for (const item of items.slice(0, 50)) {
    const product = db.prepare(`SELECT ${CARD_FIELDS} FROM products WHERE slug = ? AND published = 1`).get(String(item.slug));
    if (product) lines.push({ product, quantity: Math.max(1, Math.min(Number(item.quantity) || 1, product.stock || 1)) });
  }
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  res.json({ lines, subtotal, shipping: 0, total: subtotal });
});

storeRouter.post('/newsletter', (req, res) => {
  const email = String(req.body?.email ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  db.prepare('INSERT OR IGNORE INTO newsletter (email, created_at) VALUES (?, ?)').run(email, new Date().toISOString());
  res.json({ ok: true });
});

storeRouter.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body ?? {};
  if (![name, email, subject, message].every((v) => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ error: 'Please fill in every field.' });
  }
  db.prepare('INSERT INTO contact_messages (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(name.slice(0, 80), email.slice(0, 120), subject.slice(0, 120), message.slice(0, 2000), new Date().toISOString());
  res.status(201).json({ ok: true });
});
