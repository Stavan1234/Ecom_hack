import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH, SEED_ACCOUNTS, PUBLIC_DEMO } from './config.js';
import { PRODUCTS, REVIEWS, SEED_ORDERS, INTERNAL_NOTES } from './seed-data.js';

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer',
  legacy_pw TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  vip_optin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  collection TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  price REAL NOT NULL,
  stock INTEGER NOT NULL,
  short TEXT NOT NULL,
  description TEXT NOT NULL,
  specs TEXT NOT NULL,
  image TEXT NOT NULL,
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wishlist (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  subtotal REAL NOT NULL,
  shipping REAL NOT NULL,
  total REAL NOT NULL,
  ship_name TEXT NOT NULL,
  ship_address TEXT NOT NULL,
  ship_city TEXT NOT NULL,
  ship_country TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  idle_expires_at INTEGER NOT NULL,
  absolute_expires_at INTEGER NOT NULL,
  ua_hash TEXT NOT NULL,
  ua_label TEXT NOT NULL,
  logged_out_at INTEGER,
  rotations INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  request_id TEXT NOT NULL,
  user_id INTEGER,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  origin TEXT NOT NULL,
  security_event TEXT,
  category TEXT NOT NULL,
  mode TEXT NOT NULL,
  status INTEGER,
  details TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS http_captures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  request_id TEXT NOT NULL,
  lab TEXT NOT NULL,
  mode TEXT NOT NULL,
  request TEXT NOT NULL,
  response TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT
);
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lab_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL,
  mode TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  challenge_id TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS internal_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  note TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS newsletter (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

const TABLES = ['contact_messages', 'newsletter', 'internal_notes', 'settings', 'progress', 'evidence', 'http_captures',
  'events', 'sessions', 'order_items', 'orders', 'wishlist', 'reviews', 'products', 'users'];

export function md5(value) {
  return crypto.createHash('md5').update(String(value)).digest('hex');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password, stored) {
  const [, salt, key] = String(stored).split('$');
  if (!salt || !key) return false;
  const candidate = crypto.scryptSync(String(password), salt, 32);
  return crypto.timingSafeEqual(candidate, Buffer.from(key, 'hex'));
}

function seed() {
  const now = new Date().toISOString();
  const addUser = db.prepare(`INSERT INTO users (email, display_name, full_name, phone, address, city, country, role, legacy_pw, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const contact = {
    'admin@lab.local': ['+1 555 0100', '1 Atelier Row', 'Geneva', 'Switzerland'],
    'student@lab.local': ['+1 555 0142', '42 Practice Lane', 'Pune', 'India'],
    'alice@lab.local': ['+1 555 0177', '7 Rue Fictive', 'Lyon', 'France'],
  };
  for (const a of SEED_ACCOUNTS) {
    addUser.run(a.email, a.display_name, a.full_name, ...contact[a.email], a.role, md5(a.password), hashPassword(a.password), now);
  }

  const addProduct = db.prepare(`INSERT INTO products (slug, name, collection, category, subcategory, price, stock, short, description, specs, image, featured, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const p of PRODUCTS) {
    addProduct.run(p.slug, p.name, p.collection, p.category, p.subcategory, p.price, p.stock, p.short, p.description,
      JSON.stringify(p.specs), JSON.stringify(p.image), p.featured ? 1 : 0, p.published === false ? 0 : 1);
  }

  const addReview = db.prepare('INSERT INTO reviews (product_id, user_id, author, rating, body, created_at) VALUES ((SELECT id FROM products WHERE slug = ?), (SELECT id FROM users WHERE email = ?), ?, ?, ?, ?)');
  for (const r of REVIEWS) addReview.run(r.slug, r.email ?? null, r.author, r.rating, r.body, r.date);

  // Order numbers are sequential on purpose: Lab 6 needs guessable object IDs.
  db.exec("INSERT INTO sqlite_sequence (name, seq) SELECT 'orders', 1000 WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'orders');");
  db.exec("UPDATE sqlite_sequence SET seq = 1000 WHERE name = 'orders';");
  const addOrder = db.prepare(`INSERT INTO orders (user_id, status, subtotal, shipping, total, ship_name, ship_address, ship_city, ship_country, note, created_at)
    VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const addItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)');
  const productBySlug = db.prepare('SELECT id, name, price FROM products WHERE slug = ?');
  for (const o of SEED_ORDERS) {
    const items = o.items.map((i) => ({ ...productBySlug.get(i.slug), quantity: i.quantity }));
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const owner = contact[o.email];
    const name = SEED_ACCOUNTS.find((a) => a.email === o.email).full_name;
    const { lastInsertRowid } = addOrder.run(o.email, o.status, subtotal, 0, subtotal, name, owner[1], owner[2], owner[3], o.note, o.date);
    for (const i of items) addItem.run(Number(lastInsertRowid), i.id, i.name, i.price, i.quantity);
  }

  const addNote = db.prepare('INSERT INTO internal_notes (label, note) VALUES (?, ?)');
  for (const n of INTERNAL_NOTES) addNote.run(n.label, n.note);

  const setSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  setSetting.run('mode', PUBLIC_DEMO ? 'secure' : 'vulnerable');
  setSetting.run('short_expiry', '0');
}

export function initDatabase() {
  db.exec(SCHEMA);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n === 0) seed();
}

// Restores the fabricated data and removes every session, event and piece of evidence.
export function resetDatabase() {
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of TABLES) db.exec(`DROP TABLE IF EXISTS ${t};`);
  db.exec("DELETE FROM sqlite_sequence;");
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  seed();
}

initDatabase();

// The deliberately injectable queries run ONLY on this read-only connection: injected
// SQL can read the fabricated data, but cannot modify it, and node:sqlite compiles a
// single statement, so stacked queries and ATTACH are not reachable.
export const trainingDb = new DatabaseSync(DB_PATH, { readOnly: true });
