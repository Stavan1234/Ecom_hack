import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { db } from './db.js';
import { DIST_DIR, PUBLIC_DEMO } from './config.js';
import { isSecure, getMode } from './mode.js';
import { requestContext, accessLog, logEvent } from './events.js';
import { loopbackGuard, securityHeaders, sessionMiddleware, csrfGuard } from './security.js';
import { renderProductImage, placeholderImage } from './images.js';
import { authRouter } from './routes/auth.js';
import { storeRouter } from './routes/store.js';
import { accountRouter } from './routes/account.js';
import { classicRouter } from './routes/classic.js';
import { labRouter } from './routes/lab.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);

  app.use(loopbackGuard);
  app.use(requestContext);
  app.use(securityHeaders);
  app.use((req, res, next) => {
    // A second, non-authentication cookie, so that the Cookie-Editor exercise has to identify the right one.
    if (!req.headers.cookie?.includes('lab_prefs=')) {
      res.append('Set-Cookie', 'lab_prefs=currency%3AUSD; Path=/; Max-Age=31536000; SameSite=Lax');
    }
    next();
  });

  app.get('/img/product/:file', (req, res) => {
    const [slug, view = 'front'] = req.params.file.replace(/\.svg$/, '').split('--');
    const row = db.prepare('SELECT image FROM products WHERE slug = ?').get(slug);
    res.type('image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(row ? renderProductImage(JSON.parse(row.image), view) : placeholderImage());
  });

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(sessionMiddleware);
  app.use(accessLog);
  app.use(csrfGuard);

  app.use('/api/auth', authRouter);
  app.use('/api/lab', labRouter);
  app.use('/api', storeRouter);
  app.use('/api', accountRouter);
  app.use(classicRouter);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  const assets = express.static(DIST_DIR, { index: false, etag: false, maxAge: 0 });
  app.use(assets);

  const indexFile = path.join(DIST_DIR, 'index.html');
  app.get('/{*splat}', (req, res) => {
    // Evidence for Lab 3: the browser tells us when a page is being loaded inside a frame.
    if (req.headers['sec-fetch-dest'] === 'iframe' && req.headers['sec-fetch-site'] !== 'same-origin') {
      const secure = isSecure();
      logEvent(req, {
        action: 'FRAME_LOAD', result: secure ? 'blocked' : 'success',
        securityEvent: secure ? 'FRAME_BLOCKED' : 'FRAME_ALLOWED',
        details: { embedded_by: req.headers.referer ?? 'unknown', sec_fetch_site: req.headers['sec-fetch-site'] ?? 'absent', defence: secure ? 'X-Frame-Options: DENY and frame-ancestors none' : 'none' },
      });
    }
    if (!fs.existsSync(indexFile)) return res.status(503).type('text').send('Front end has not been built yet. Run "npm start".');
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(indexFile);
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    logEvent(req, { action: 'SERVER_ERROR', result: 'failure', securityEvent: 'ERROR_RAISED', status, details: { name: err.name, message: err.message } });
    if (getMode() === 'secure') {
      return res.status(status).json({ error: status < 500 ? 'The request could not be processed.' : 'Something went wrong on our side.', requestId: req.requestId });
    }
    // VULNERABLE: internals disclosed in the error response.
    return res.status(status).json({ error: err.message, type: err.name, stack: err.stack, framework: 'express', database: 'sqlite', publicDemo: PUBLIC_DEMO });
  });

  return app;
}
