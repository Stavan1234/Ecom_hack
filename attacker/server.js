import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const here = path.dirname(fileURLToPath(import.meta.url));

// A separate origin for the CSRF and clickjacking demonstrations. It serves static
// pages only: it has no database, stores nothing, and only ever targets the local app.
export function createAttackerApp(appPort) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const hostname = String(req.headers.host || '').split(':')[0];
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') return res.status(403).type('text').send('Loopback only.');
    next();
  });
  app.get('/config.js', (req, res) => {
    res.type('js').send(`window.TARGET = 'http://127.0.0.1:${appPort}';`);
  });
  app.use(express.static(path.join(here, 'public'), { extensions: ['html'] }));
  return app;
}
