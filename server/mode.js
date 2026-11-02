import { db } from './db.js';
import { PUBLIC_DEMO } from './config.js';

export function getMode() {
  if (PUBLIC_DEMO) return 'secure';
  return db.prepare("SELECT value FROM settings WHERE key = 'mode'").get()?.value ?? 'vulnerable';
}

export const isSecure = () => getMode() === 'secure';

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

export function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}
