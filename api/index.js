// Vercel serverless entry. A public deployment is locked to SECURE mode by
// server/config.js (PUBLIC_DEMO is true whenever VERCEL is set), so the
// intentionally vulnerable behaviour and the lab controls are never exposed.
import { createApp } from '../server/app.js';

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
