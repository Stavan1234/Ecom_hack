import crypto from 'node:crypto';
import { db } from './db.js';
import { getMode } from './mode.js';

const SECRET_KEY = /pass|pwd|cookie|token|session|secret|authorization|csrf|legacy_pw/i;

export function redact(value, key = '') {
  if (key && SECRET_KEY.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  }
  if (typeof value === 'string') {
    return value.replace(/lab_session=[^;\s]+/gi, 'lab_session=[REDACTED]').replace(/\b[a-f0-9]{32,}\b/gi, '[REDACTED]').slice(0, 800);
  }
  return value;
}

export function requestContext(req, res, next) {
  req.requestId = crypto.randomUUID().slice(0, 13);
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function logEvent(req, { action, result = 'info', securityEvent = null, details = {}, category = 'security', status = null, userId }) {
  db.prepare(`INSERT INTO events (ts, request_id, user_id, method, endpoint, action, result, origin, security_event, category, mode, status, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    new Date().toISOString(),
    req.requestId ?? '-',
    userId ?? req.user?.id ?? null,
    req.method,
    (req.originalUrl || req.url).split('?')[0].slice(0, 200),
    action,
    result,
    req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || 'none',
    securityEvent,
    category,
    getMode(),
    status,
    JSON.stringify(redact(details)),
  );
}

// Application log: every API write and account page, excluding the lab panel's own polling.
export function accessLog(req, res, next) {
  res.on('finish', () => {
    const url = req.originalUrl.split('?')[0];
    const quiet = url.startsWith('/api/lab') || url === '/api/auth/me';
    const relevant = url.startsWith('/api') || url.startsWith('/classic');
    if (relevant && !quiet) {
      try {
        logEvent(req, { action: 'HTTP_REQUEST', result: res.statusCode < 400 ? 'success' : 'failure', category: 'app', status: res.statusCode });
      } catch {
        // A lab reset can race with an in-flight request; losing one access-log row is fine.
      }
    }
  });
  next();
}

export function hasEvent(securityEvent, mode) {
  const row = mode
    ? db.prepare('SELECT 1 FROM events WHERE security_event = ? AND mode = ? LIMIT 1').get(securityEvent, mode)
    : db.prepare('SELECT 1 FROM events WHERE security_event = ? LIMIT 1').get(securityEvent);
  return Boolean(row);
}

export function captureHttp(req, lab, response, before, after) {
  const cookieNames = String(req.headers.cookie || '').split(';').map((c) => c.split('=')[0].trim()).filter(Boolean);
  const request = {
    method: req.method,
    url: req.originalUrl.split('?')[0],
    query: redact(req.query ?? {}),
    headers: {
      host: req.headers.host,
      origin: req.headers.origin ?? '(absent)',
      referer: req.headers.referer ?? '(absent)',
      'content-type': req.headers['content-type'] ?? '(absent)',
      'sec-fetch-site': req.headers['sec-fetch-site'] ?? '(absent)',
      'sec-fetch-mode': req.headers['sec-fetch-mode'] ?? '(absent)',
      'x-csrf-token': req.headers['x-csrf-token'] ? '[PRESENT, REDACTED]' : '(absent)',
      cookie: cookieNames.length ? `names only: ${cookieNames.join(', ')}` : '(no cookies sent)',
    },
    body: redact(req.body ?? {}),
  };
  db.prepare('INSERT INTO http_captures (ts, request_id, lab, mode, request, response, before_value, after_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    new Date().toISOString(), req.requestId, lab, getMode(), JSON.stringify(request), JSON.stringify(response), before ?? null, after ?? null,
  );
}
