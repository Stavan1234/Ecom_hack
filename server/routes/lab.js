import crypto from 'node:crypto';
import { Router } from 'express';
import { db, resetDatabase } from '../db.js';
import { APP_PORT, ATTACKER_PORT, PUBLIC_DEMO, SEED_ACCOUNTS, SESSION } from '../config.js';
import { getMode, getSetting, setSetting } from '../mode.js';
import { hasEvent, logEvent } from '../events.js';
import { clearQueries, recentQueries } from '../queries.js';
import { clearLoginFailures, clearReplayCache, clearSessionCookie, cookieAttributes, requireLabAccess } from '../security.js';
import { LABS, GLOSSARY } from '../content/labs.js';
import { AUDIT_CHECKS, runLiveAudit } from '../audit.js';

export const labRouter = Router();

const FLAG = 'FLAG{union_select_opened_the_vault}';

function challengeState() {
  const manual = new Set(db.prepare('SELECT challenge_id FROM progress').all().map((r) => r.challenge_id));
  return LABS.map((lab) => ({
    id: lab.id,
    title: lab.title,
    challenges: lab.challenges.map((c) => ({
      id: c.id, title: c.title, auto: Boolean(c.event),
      done: manual.has(c.id) || Boolean(c.event && hasEvent(c.event, c.mode)),
    })),
  }));
}

function requireLocalControls(req, res, next) {
  if (PUBLIC_DEMO) return res.status(403).json({ error: 'Lab controls are disabled in the public preview. Run the project locally to use them.' });
  next();
}

labRouter.get('/status', (req, res) => {
  const mode = getMode();
  const state = challengeState();
  const all = state.flatMap((l) => l.challenges);
  res.json({
    mode,
    publicDemo: PUBLIC_DEMO,
    appOrigin: `http://127.0.0.1:${APP_PORT}`,
    attackerOrigin: `http://127.0.0.1:${ATTACKER_PORT}`,
    crossSiteAttackerOrigin: `http://localhost:${ATTACKER_PORT}`,
    accounts: PUBLIC_DEMO ? [] : SEED_ACCOUNTS.map(({ email, password, role }) => ({ email, password, role })),
    cookie: { name: 'lab_session', attributes: cookieAttributes(req, mode) },
    shortExpiry: getSetting('short_expiry') === '1',
    idleSeconds: mode === 'secure' ? (getSetting('short_expiry') === '1' ? SESSION.shortDemoIdleSeconds : SESSION.secureIdleSeconds) : SESSION.vulnerableMaxAgeSeconds,
    progress: { done: all.filter((c) => c.done).length, total: all.length, labs: state },
    counts: {
      events: db.prepare('SELECT COUNT(*) AS n FROM events').get().n,
      sessions: db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,
      evidence: db.prepare('SELECT COUNT(*) AS n FROM evidence').get().n,
    },
  });
});

labRouter.post('/mode', requireLocalControls, (req, res) => {
  const mode = req.body?.mode;
  if (mode !== 'vulnerable' && mode !== 'secure') return res.status(400).json({ error: 'Mode must be vulnerable or secure.' });
  const from = getMode();
  if (mode !== from) {
    // Cookie attributes are fixed when a cookie is issued, so a mode change starts every session afresh.
    db.prepare('DELETE FROM sessions').run();
    clearReplayCache();
    clearLoginFailures();
    setSetting('mode', mode);
    req.user = null;
    logEvent(req, { action: 'MODE_CHANGE', result: 'success', securityEvent: 'LAB_MODE_CHANGED', details: { from, to: mode, sessions_cleared: true } });
    clearSessionCookie(res);
  }
  res.json({ mode });
});

labRouter.post('/reset', requireLocalControls, (req, res) => {
  resetDatabase();
  clearQueries();
  clearReplayCache();
  clearLoginFailures();
  req.user = null;
  logEvent(req, { action: 'LAB_RESET', result: 'success', securityEvent: 'LAB_RESET', details: { note: 'Database, sessions and evidence restored to the original state' } });
  clearSessionCookie(res);
  res.json({ ok: true, mode: getMode() });
});

labRouter.post('/clear-sessions', requireLocalControls, (req, res) => {
  const { changes } = db.prepare('DELETE FROM sessions').run();
  clearReplayCache();
  logEvent(req, { action: 'CLEAR_SESSIONS', result: 'success', securityEvent: 'LAB_SESSIONS_CLEARED', details: { removed: Number(changes) } });
  clearSessionCookie(res);
  res.json({ ok: true, removed: Number(changes) });
});

labRouter.post('/settings', requireLocalControls, (req, res) => {
  setSetting('short_expiry', req.body?.shortExpiry ? '1' : '0');
  logEvent(req, { action: 'LAB_SETTING', result: 'success', details: { short_expiry: Boolean(req.body?.shortExpiry) } });
  res.json({ ok: true, shortExpiry: Boolean(req.body?.shortExpiry) });
});

labRouter.get('/curriculum', (req, res) => {
  res.json({ labs: LABS, glossary: GLOSSARY });
});

labRouter.get('/session-inspect', (req, res) => {
  const mode = getMode();
  const describe = (s) => ({
    id: s.id,
    tokenFingerprint: `sha256:${s.token_hash.slice(0, 10)}…`,
    userEmail: db.prepare('SELECT email FROM users WHERE id = ?').get(s.user_id)?.email ?? 'unknown',
    issuedTo: s.ua_label,
    createdAt: new Date(s.created_at).toISOString(),
    lastSeen: new Date(s.last_seen).toISOString(),
    idleExpiresAt: new Date(s.idle_expires_at).toISOString(),
    absoluteExpiresAt: new Date(s.absolute_expires_at).toISOString(),
    loggedOutAt: s.logged_out_at ? new Date(s.logged_out_at).toISOString() : null,
    rotations: s.rotations,
  });
  const sessions = PUBLIC_DEMO ? [] : db.prepare('SELECT * FROM sessions ORDER BY last_seen DESC LIMIT 20').all().map(describe);
  res.json({
    mode,
    authenticated: Boolean(req.user),
    user: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role, displayName: req.user.display_name } : null,
    current: req.session ? describe(req.session) : null,
    cookieAttributes: cookieAttributes(req, mode),
    cookieHeaderReceived: Boolean(req.headers.cookie?.includes('lab_session=')),
    sessions,
    vipOptin: req.user ? Boolean(req.user.vip_optin) : null,
  });
});

labRouter.get('/events', requireLabAccess, (req, res) => {
  const where = [];
  const params = [];
  if (req.query.category) { where.push('category = ?'); params.push(String(req.query.category)); }
  if (req.query.securityEvent) { where.push('security_event = ?'); params.push(String(req.query.securityEvent)); }
  if (req.query.result) { where.push('result = ?'); params.push(String(req.query.result)); }
  if (req.query.q) { where.push('(endpoint LIKE ? OR action LIKE ? OR security_event LIKE ? OR origin LIKE ?)'); const like = `%${req.query.q}%`; params.push(like, like, like, like); }
  const sql = `SELECT * FROM events ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`;
  const events = db.prepare(sql).all(...params, Math.min(Number(req.query.limit) || 200, 1000));
  res.json({ events: events.map((e) => ({ ...e, details: JSON.parse(e.details) })) });
});

labRouter.post('/events/clear', requireLocalControls, (req, res) => {
  db.prepare('DELETE FROM events').run();
  db.prepare('DELETE FROM http_captures').run();
  res.json({ ok: true });
});

labRouter.get('/export', requireLabAccess, (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY id').all().map((e) => ({ ...e, details: JSON.parse(e.details) }));
  const captures = db.prepare('SELECT * FROM http_captures ORDER BY id').all().map((c) => ({ ...c, request: JSON.parse(c.request), response: JSON.parse(c.response) }));
  const evidence = db.prepare('SELECT * FROM evidence ORDER BY id').all();
  const body = { events, captures, evidence };
  const integrity = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  logEvent(req, { action: 'EVIDENCE_EXPORT', result: 'success', securityEvent: 'EVIDENCE_EXPORTED', details: { events: events.length, captures: captures.length, integrity_prefix: integrity.slice(0, 12) } });
  res.setHeader('Content-Disposition', `attachment; filename="halden-voss-evidence-${new Date().toISOString().replace(/[:.]/g, '-')}.json"`);
  res.json({
    meta: {
      generatedAt: new Date().toISOString(),
      application: 'Halden & Voss security laboratory (fabricated data)',
      mode: getMode(),
      redaction: 'Passwords, cookies, session tokens, CSRF tokens and password hashes are never logged.',
      integrity: { algorithm: 'sha256', scope: 'JSON of {events, captures, evidence} at export time', digest: integrity },
    },
    ...body,
  });
});

labRouter.get('/captures', requireLabAccess, (req, res) => {
  const where = req.query.lab ? 'WHERE lab = ?' : '';
  const rows = db.prepare(`SELECT * FROM http_captures ${where} ORDER BY id DESC LIMIT 20`).all(...(req.query.lab ? [String(req.query.lab)] : []));
  res.json({ captures: rows.map((c) => ({ ...c, request: JSON.parse(c.request), response: JSON.parse(c.response) })) });
});

labRouter.get('/queries', requireLabAccess, (req, res) => {
  res.json({ queries: recentQueries() });
});

labRouter.get('/evidence', requireLabAccess, (req, res) => {
  res.json({ evidence: db.prepare('SELECT * FROM evidence ORDER BY id DESC').all() });
});

labRouter.post('/evidence', requireLocalControls, (req, res) => {
  const { labId, title, notes } = req.body ?? {};
  if (!String(title ?? '').trim()) return res.status(400).json({ error: 'Please give this evidence a title.' });
  const { lastInsertRowid } = db.prepare('INSERT INTO evidence (lab_id, title, notes, mode, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(String(labId ?? 'general'), String(title).slice(0, 160), String(notes ?? '').slice(0, 5000), getMode(), new Date().toISOString());
  logEvent(req, { action: 'EVIDENCE_ADD', result: 'success', category: 'app', details: { lab: String(labId ?? 'general') } });
  res.status(201).json({ evidence: db.prepare('SELECT * FROM evidence WHERE id = ?').get(Number(lastInsertRowid)) });
});

labRouter.delete('/evidence/:id', requireLocalControls, (req, res) => {
  db.prepare('DELETE FROM evidence WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

labRouter.post('/progress', requireLocalControls, (req, res) => {
  const id = String(req.body?.challengeId ?? '');
  const known = LABS.some((l) => l.challenges.some((c) => c.id === id));
  if (!known) return res.status(404).json({ error: 'Unknown challenge.' });
  if (req.body?.done === false) db.prepare('DELETE FROM progress WHERE challenge_id = ?').run(id);
  else db.prepare('INSERT OR REPLACE INTO progress (challenge_id, completed_at) VALUES (?, ?)').run(id, new Date().toISOString());
  res.json({ ok: true });
});

labRouter.post('/flag', requireLocalControls, (req, res) => {
  const correct = String(req.body?.flag ?? '').trim() === FLAG;
  logEvent(req, { action: 'FLAG_SUBMIT', result: correct ? 'success' : 'failure', securityEvent: correct ? 'SQLI_FLAG_CAPTURED' : null });
  res.json({ correct, message: correct ? 'Correct. You extracted a value from a table the search page never meant to expose.' : 'That is not the flag. Check the hints.' });
});

// Fired by /lab-proof.js when an injected script calls alert(), so challenge status reflects real execution.
labRouter.post('/xss-proof', (req, res) => {
  const page = String(req.body?.page ?? '');
  const context = page.startsWith('/classic') ? 'reflected' : page.startsWith('/engraving') ? 'dom' : page.startsWith('/product') ? 'stored' : 'other';
  const name = { reflected: 'XSS_EXECUTED_REFLECTED', dom: 'XSS_EXECUTED_DOM', stored: 'XSS_EXECUTED_STORED' }[context] ?? 'XSS_EXECUTED_OTHER';
  logEvent(req, { action: 'XSS_PROOF', result: 'success', securityEvent: name, details: { context, page: page.slice(0, 120), message: String(req.body?.message ?? '').slice(0, 80) } });
  res.json({ ok: true });
});

labRouter.post('/client-event', (req, res) => {
  if (req.body?.type === 'dom-neutralized') {
    logEvent(req, { action: 'DOM_RENDER', result: 'blocked', securityEvent: 'XSS_NEUTRALIZED', details: { context: 'dom', input: String(req.body?.input ?? '').slice(0, 200) } });
  } else if (req.body?.type === 'httponly-check') {
    logEvent(req, { action: 'COOKIE_READ', result: req.body.visible ? 'success' : 'blocked', securityEvent: req.body.visible ? 'COOKIE_READABLE_BY_JS' : 'COOKIE_HIDDEN_FROM_JS', details: { source: 'document.cookie' } });
  }
  res.json({ ok: true });
});

labRouter.get('/audit', (req, res) => {
  res.json({ mode: getMode(), checks: AUDIT_CHECKS });
});

labRouter.post('/audit/run', requireLocalControls, async (req, res) => {
  // Probe this very server (its own loopback port), not a fixed default port.
  const results = await runLiveAudit(`http://127.0.0.1:${req.socket.localPort}`);
  logEvent(req, { action: 'AUDIT_RUN', result: 'success', securityEvent: 'AUDIT_RUN', details: { failed: Object.values(results).filter((r) => r.pass === false).length, mode: getMode() } });
  res.json({ mode: getMode(), ranAt: new Date().toISOString(), results });
});
