import { Router } from 'express';
import { db, trainingDb, md5, hashPassword, verifyPassword } from '../db.js';
import { PUBLIC_DEMO } from '../config.js';
import { isSecure, getMode } from '../mode.js';
import { logEvent } from '../events.js';
import { recordQuery } from '../queries.js';
import {
  createSession, destroySession, rotateSession, clearSessionCookie, requireLogin, loginRateLimited,
  recordLoginFailure, clearLoginFailures, SUSPICIOUS_SQL, parseCookies,
} from '../security.js';

export const authRouter = Router();

const userById = (id) => db.prepare('SELECT id, email, display_name, role, vip_optin FROM users WHERE id = ?').get(id);

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, displayName: user.display_name, role: user.role, vipOptin: Boolean(user.vip_optin) };
}

function vulnerableLogin(req, email, password) {
  // VULNERABLE: user input concatenated straight into SQL (Lab 4).
  const hash = md5(password);
  const sql = `SELECT id, email, display_name, role, legacy_pw FROM users WHERE email = '${email}' AND legacy_pw = '${hash}' LIMIT 1`;
  const shown = sql.replace(hash, '<md5(password)>');
  try {
    const row = trainingDb.prepare(sql).get();
    recordQuery({ source: 'login', mode: 'vulnerable', sql: shown, params: null, rows: row ? 1 : 0 });
    return { row, hash, sql: shown };
  } catch (error) {
    recordQuery({ source: 'login', mode: 'vulnerable', sql: shown, params: null, error: error.message });
    logEvent(req, { action: 'LOGIN', result: 'failure', securityEvent: 'SQL_ERROR_EXPOSED', details: { source: 'login', message: error.message } });
    return { error, sql: shown };
  }
}

function secureLogin(email, password) {
  const sql = 'SELECT id, email, display_name, role, password_hash FROM users WHERE email = ? LIMIT 1';
  const row = db.prepare(sql).get(String(email));
  recordQuery({ source: 'login', mode: 'secure', sql, params: [String(email), '<not sent to SQL: verified with scrypt>'], rows: row ? 1 : 0 });
  return row && verifyPassword(password, row.password_hash) ? row : null;
}

authRouter.post('/login', (req, res) => {
  const email = String(req.body?.email ?? '');
  const password = String(req.body?.password ?? '');
  const suspicious = SUSPICIOUS_SQL.test(email);

  if (isSecure()) {
    if (loginRateLimited(email)) {
      logEvent(req, { action: 'LOGIN', result: 'blocked', securityEvent: 'LOGIN_RATE_LIMITED', status: 429, details: { email } });
      return res.status(429).json({ error: 'Too many failed attempts. Please wait a minute and try again.' });
    }
    if (suspicious) logEvent(req, { action: 'LOGIN', result: 'blocked', securityEvent: 'SQLI_NEUTRALIZED', details: { source: 'login', input: email } });

    const user = secureLogin(email, password);
    if (!user) {
      recordLoginFailure(email);
      logEvent(req, { action: 'LOGIN', result: 'failure', securityEvent: 'LOGIN_FAILED', status: 401, details: { email } });
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    clearLoginFailures(email);
    // Session rotation: anything presented before login is discarded.
    if (req.session) destroySession(req.session.id);
    const session = createSession(req, res, user.id);
    req.user = user;
    logEvent(req, { action: 'LOGIN', result: 'success', securityEvent: 'LOGIN_SUCCESS', status: 200, details: { email: user.email, rotated: true } });
    return res.json({ user: publicUser(user), csrfToken: session.csrf_token });
  }

  const { row, hash, error, sql } = vulnerableLogin(req, email, password);
  if (error) {
    // VULNERABLE: database error and query text returned to the client.
    return res.status(500).json({ error: `SQLITE_ERROR: ${error.message}`, sql });
  }
  const user = row?.id ? userById(row.id) : null;
  if (!user) {
    // VULNERABLE: different messages reveal which emails are registered.
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    logEvent(req, { action: 'LOGIN', result: 'failure', securityEvent: 'LOGIN_FAILED', status: 401, details: { email } });
    return res.status(401).json({ error: exists ? 'Incorrect password for this account.' : 'No account exists with that email.' });
  }

  const bypassed = row.legacy_pw !== hash;
  if (bypassed) {
    logEvent(req, { action: 'LOGIN', result: 'success', securityEvent: 'SQLI_LOGIN_BYPASS', userId: user.id, details: { input: email, logged_in_as: user.email } });
  } else if (suspicious) {
    logEvent(req, { action: 'LOGIN', result: 'success', securityEvent: 'SQLI_SUSPECTED', userId: user.id, details: { input: email } });
  }

  // VULNERABLE: no rotation. An existing valid cookie keeps its value after login (session fixation).
  let session = req.session;
  if (session) {
    db.prepare('UPDATE sessions SET user_id = ?, logged_out_at = NULL WHERE id = ?').run(user.id, session.id);
  } else {
    session = createSession(req, res, user.id);
  }
  req.user = user;
  logEvent(req, { action: 'LOGIN', result: 'success', securityEvent: 'LOGIN_SUCCESS', status: 200, details: { email: user.email, rotated: false } });
  res.json({ user: publicUser(user), csrfToken: null });
});

authRouter.post('/register', (req, res) => {
  if (PUBLIC_DEMO) return res.status(403).json({ error: 'Registration is disabled in this public preview. Use a demo account instead.' });
  const email = String(req.body?.email ?? '').trim();
  const password = String(req.body?.password ?? '');
  const displayName = String(req.body?.displayName ?? '').trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !displayName || !password) {
    return res.status(400).json({ error: 'Please enter your name, a valid email and a password.' });
  }
  if (isSecure() && (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))) {
    return res.status(400).json({ error: 'Passwords need at least 10 characters with upper case, lower case and a number.' });
  }
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account already exists with that email.' });
  }
  const { lastInsertRowid } = db.prepare(`INSERT INTO users (email, display_name, full_name, legacy_pw, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(email, displayName.slice(0, 60), displayName.slice(0, 60), md5(password), hashPassword(password), new Date().toISOString());
  const user = userById(Number(lastInsertRowid));
  const session = createSession(req, res, user.id);
  req.user = user;
  logEvent(req, { action: 'REGISTER', result: 'success', securityEvent: 'ACCOUNT_CREATED', status: 201, details: { email } });
  res.status(201).json({ user: publicUser(user), csrfToken: isSecure() ? session.csrf_token : null });
});

authRouter.get('/me', (req, res) => {
  res.json({
    user: publicUser(req.user),
    csrfToken: req.session && isSecure() ? req.session.csrf_token : null,
    mode: getMode(),
    publicDemo: PUBLIC_DEMO,
  });
});

authRouter.post('/logout', (req, res) => {
  if (req.session) {
    if (isSecure()) {
      destroySession(req.session.id);
      logEvent(req, { action: 'LOGOUT', result: 'success', securityEvent: 'LOGOUT', details: { server_side_invalidation: true } });
    } else {
      // VULNERABLE: the browser cookie is cleared, but the server still honours the token.
      db.prepare('UPDATE sessions SET logged_out_at = ? WHERE id = ?').run(Date.now(), req.session.id);
      logEvent(req, { action: 'LOGOUT', result: 'success', securityEvent: 'LOGOUT', details: { server_side_invalidation: false } });
    }
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post('/logout-all', requireLogin, (req, res) => {
  const { changes } = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
  logEvent(req, { action: 'LOGOUT_ALL', result: 'success', securityEvent: 'LOGOUT', details: { sessions_revoked: Number(changes) } });
  clearSessionCookie(res);
  res.json({ ok: true, revoked: Number(changes) });
});

authRouter.post('/rotate', requireLogin, (req, res) => {
  if (!isSecure()) return res.status(409).json({ error: 'Vulnerable mode does not support session rotation. Switch to secure mode to try this.' });
  const had = Boolean(parseCookies(req).lab_session);
  const session = rotateSession(req, res);
  logEvent(req, { action: 'SESSION_ROTATE', result: 'success', securityEvent: 'SESSION_ROTATED', details: { old_token_invalidated: had, rotations: session.rotations } });
  res.json({ ok: true, csrfToken: session.csrf_token, rotations: session.rotations });
});
