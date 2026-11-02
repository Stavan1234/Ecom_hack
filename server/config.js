import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Loopback only. Nothing in this project ever listens on another interface.
export const HOST = '127.0.0.1';
export const APP_PORT = Number(process.env.LAB_PORT || 4000);
export const ATTACKER_PORT = Number(process.env.LAB_ATTACKER_PORT || 4001);

// A public deployment (any Vercel environment, or LAB_PUBLIC_DEMO=1) is locked to
// secure mode: the vulnerable code paths and lab controls cannot be reached.
export const PUBLIC_DEMO = process.env.LAB_PUBLIC_DEMO === '1' || Boolean(process.env.VERCEL);

export const DB_PATH = process.env.LAB_DB
  || (PUBLIC_DEMO ? path.join(os.tmpdir(), 'halden-voss.db') : path.join(ROOT, 'data', 'lab.db'));

export const DIST_DIR = path.join(ROOT, 'dist');

export const SEED_ACCOUNTS = [
  { email: 'admin@lab.local', password: 'LabAdmin123!', role: 'admin', display_name: 'Studio Admin', full_name: 'Ada Marlowe' },
  { email: 'student@lab.local', password: 'LabStudent123!', role: 'customer', display_name: 'Student Collector', full_name: 'Sam Rivera' },
  { email: 'alice@lab.local', password: 'LabAlice123!', role: 'customer', display_name: 'Alice Fontaine', full_name: 'Alice Fontaine' },
];

export const SESSION = {
  vulnerableMaxAgeSeconds: 60 * 60 * 24 * 30,
  secureIdleSeconds: 20 * 60,
  secureAbsoluteSeconds: 2 * 60 * 60,
  shortDemoIdleSeconds: 60,
};
