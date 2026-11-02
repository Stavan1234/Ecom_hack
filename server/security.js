import crypto from 'node:crypto';
import { db } from './db.js';
import { APP_PORT, PUBLIC_DEMO, SESSION } from './config.js';
import { getMode, getSetting, isSecure } from './mode.js';
import { logEvent } from './events.js';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

// Second safety net behind the 127.0.0.1 bind: refuse non-loopback peers and
// DNS-rebinding style Host headers.
export function loopbackGuard(req, res, next) {
  if (PUBLIC_DEMO) return next();
  const hostname = String(req.headers.host || '').split(':')[0];
  if (!LOOPBACK_ADDRESSES.has(req.socket.remoteAddress) || !LOOPBACK_HOSTS.has(hostname)) {
    return res.status(403).type('text').send('This laboratory only accepts loopback connections.');
  }
  next();
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

function uaLabel(ua = '') {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return ua ? ua.split('/')[0].slice(0, 24) : 'Unknown client';
}

const isHttps = (req) => req.headers['x-forwarded-proto'] === 'https' || req.secure;

export function cookieAttributes(req, mode = getMode()) {
  if (mode === 'secure') {
    return ['Path=/', 'HttpOnly', 'SameSite=Lax', ...(isHttps(req) ? ['Secure'] : [])];
  }
  // Deliberately weak: readable from JavaScript, no SameSite, long-lived.
  return ['Path=/', `Max-Age=${SESSION.vulnerableMaxAgeSeconds}`];
}

function appendSetCookie(res, value) {
  const existing = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(existing ? [].concat(existing) : []), value]);
}

function setSessionCookie(req, res, token) {
  appendSetCookie(res, `lab_session=${token}; ${cookieAttributes(req).join('; ')}`);
}

export function clearSessionCookie(res) {
  appendSetCookie(res, 'lab_session=; Path=/; Max-Age=0');
}

function idleSeconds() {
  return getSetting('short_expiry') === '1' ? SESSION.shortDemoIdleSeconds : SESSION.secureIdleSeconds;
}

export function createSession(req, res, userId, { rotations = 0 } = {}) {
  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  const secure = isSecure();
  const idle = secure ? idleSeconds() : SESSION.vulnerableMaxAgeSeconds;
  const absolute = secure ? SESSION.secureAbsoluteSeconds : SESSION.vulnerableMaxAgeSeconds;
  const ua = req.headers['user-agent'] || '';
  db.prepare(`INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, last_seen, idle_expires_at, absolute_expires_at, ua_hash, ua_label, rotations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    sha256(token), userId, crypto.randomBytes(24).toString('hex'), now, now, now + idle * 1000, now + absolute * 1000, sha256(ua), uaLabel(ua), rotations,
  );
  setSessionCookie(req, res, token);
  return db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token));
}

export function destroySession(id) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

const reportedReplays = new Set();
export const clearReplayCache = () => reportedReplays.clear();

export function sessionMiddleware(req, res, next) {
  req.user = null;
  req.session = null;
  const token = parseCookies(req).lab_session;
  if (!token) return next();

  const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token));
  const now = Date.now();
  const secure = isSecure();

  if (!row) {
    logEvent(req, { action: 'SESSION_CHECK', result: 'blocked', securityEvent: 'SESSION_REJECTED', details: { reason: 'Cookie does not match a server-side session' } });
    if (secure) clearSessionCookie(res);
    return next();
  }

  if (secure && (now > row.idle_expires_at || now > row.absolute_expires_at)) {
    destroySession(row.id);
    logEvent(req, { action: 'SESSION_CHECK', result: 'blocked', securityEvent: 'SESSION_EXPIRED', userId: row.user_id, details: { reason: now > row.absolute_expires_at ? 'absolute timeout' : 'idle timeout' } });
    clearSessionCookie(res);
    return next();
  }

  req.session = row;
  req.user = db.prepare('SELECT id, email, display_name, full_name, phone, address, city, country, role, vip_optin, created_at FROM users WHERE id = ?').get(row.user_id) ?? null;

  if (row.logged_out_at) {
    logEvent(req, { action: 'SESSION_CHECK', result: 'success', securityEvent: 'SESSION_USED_AFTER_LOGOUT', details: { ua: uaLabel(req.headers['user-agent']) } });
  }

  const uaHash = sha256(req.headers['user-agent'] || '');
  if (uaHash !== row.ua_hash) {
    const key = `${row.id}:${uaHash}`;
    if (!reportedReplays.has(key)) {
      reportedReplays.add(key);
      logEvent(req, {
        action: 'SESSION_CHECK', result: 'success', securityEvent: 'SESSION_REPLAY_SUSPECTED',
        details: { issued_to: row.ua_label, now_used_by: uaLabel(req.headers['user-agent']), note: 'Same session, different browser' },
      });
    }
  }

  const idle = secure ? idleSeconds() : SESSION.vulnerableMaxAgeSeconds;
  db.prepare('UPDATE sessions SET last_seen = ?, idle_expires_at = ? WHERE id = ?').run(now, now + idle * 1000, row.id);
  next();
}

// Replaces the current token. The old cookie value stops working immediately.
export function rotateSession(req, res) {
  const previous = req.session;
  destroySession(previous.id);
  req.session = createSession(req, res, previous.user_id, { rotations: previous.rotations + 1 });
  return req.session;
}

export function ownOrigins(req) {
  if (PUBLIC_DEMO) return [`https://${req.headers.host}`];
  // Derive the app's own port from the request host, so this is correct on any
  // port (custom LAB_PORT, or an ephemeral test port), not just the default.
  const port = String(req.headers.host || '').split(':')[1] || String(APP_PORT);
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
}

export function isForeignOrigin(req) {
  const origin = req.headers.origin;
  if (origin && origin !== 'null') return !ownOrigins(req).includes(origin);
  if (origin === 'null') return true;
  const referer = req.headers.referer;
  if (referer) return !ownOrigins(req).some((o) => referer === o || referer.startsWith(`${o}/`));
  return false;
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CREDENTIAL_ENTRY = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfGuard(req, res, next) {
  if (!UNSAFE.has(req.method)) return next();
  const path = req.path;
  const foreign = isForeignOrigin(req);

  // The lab's own controls are never cross-origin writable, in either mode.
  if (path.startsWith('/api/lab')) {
    if (foreign) return res.status(403).json({ error: 'Lab controls only accept same-origin requests.' });
    return next();
  }
  if (!isSecure()) return next();

  const block = (reason) => {
    logEvent(req, {
      action: 'CSRF_CHECK', result: 'blocked', securityEvent: 'CSRF_BLOCKED', status: 403,
      details: { reason, cookie_present: Boolean(req.session), sec_fetch_site: req.headers['sec-fetch-site'] ?? 'absent' },
    });
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      return res.status(403).type('text').send(`Request blocked by CSRF protection: ${reason}.`);
    }
    return res.status(403).json({ error: `Request blocked by CSRF protection: ${reason}.`, requestId: req.requestId });
  };

  if (foreign) return block('Origin is not allowed');
  if (CREDENTIAL_ENTRY.has(path) || !req.session) return next();

  const supplied = String(req.headers['x-csrf-token'] || req.body?._csrf || '');
  const expected = req.session.csrf_token;
  const matches = supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!matches) return block('CSRF token is missing or invalid');
  next();
}

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
  "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join('; ');

export function securityHeaders(req, res, next) {
  if (isSecure()) {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  } else {
    res.setHeader('X-Powered-By', 'Express');
    res.setHeader('Server', 'HaldenVoss-Legacy/1.0');
  }
  next();
}

const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_FAILURES = 5;
const failures = new Map();

export function loginRateLimited(email) {
  const entry = failures.get(String(email).toLowerCase());
  return Boolean(entry && Date.now() - entry.first < LOGIN_WINDOW_MS && entry.count >= LOGIN_MAX_FAILURES);
}

export function recordLoginFailure(email) {
  const key = String(email).toLowerCase();
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first >= LOGIN_WINDOW_MS) failures.set(key, { first: Date.now(), count: 1 });
  else entry.count += 1;
}

export function clearLoginFailures(email) {
  if (email) failures.delete(String(email).toLowerCase());
  else failures.clear();
}

export function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

export function requireLabAccess(req, res, next) {
  if (PUBLIC_DEMO && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Lab data is not available in the public preview.' });
  }
  next();
}

export const SUSPICIOUS_SQL = /('|--|\/\*|\bunion\b|\bor\b\s+\d|\bor\b\s+'|;)/i;
export const SUSPICIOUS_HTML = /<\s*(script|img|svg|iframe|body|details|video|audio)\b|on\w+\s*=|javascript:/i;

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
