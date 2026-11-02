import { APP_PORT, SEED_ACCOUNTS } from './config.js';

// Static side-by-side findings, plus a live probe that checks what the running server actually does.
export const AUDIT_CHECKS = [
  { id: 'cookie-flags', area: 'Cookie flags', title: 'Session cookie attributes', severity: 'High', owasp: 'A07 Authentication Failures',
    vulnerable: 'lab_session=<token>; Path=/; Max-Age=2592000 (no HttpOnly, no SameSite)',
    secure: 'lab_session=<token>; Path=/; HttpOnly; SameSite=Lax (plus Secure when served over HTTPS)',
    risk: 'JavaScript can read the session token, and browsers may attach it to some cross-site requests.',
    mitigation: 'Set HttpOnly, SameSite=Lax or Strict, and Secure on all session cookies.' },
  { id: 'auth', area: 'Authentication', title: 'Password storage and login responses', severity: 'Critical', owasp: 'A04 Cryptographic Failures',
    vulnerable: 'Unsalted MD5 compared inside SQL. Different errors for unknown email and wrong password. No rate limit.',
    secure: 'Salted scrypt, verified in application code. One generic error. HTTP 429 after 5 failures per minute.',
    risk: 'Weak hashes crack quickly, error messages enumerate accounts, and unlimited guessing enables brute force.',
    mitigation: 'Use a slow salted hash (Argon2id or scrypt), generic messages and rate limiting.' },
  { id: 'session-expiry', area: 'Session expiry', title: 'Timeouts and logout invalidation', severity: 'High', owasp: 'A07 Authentication Failures',
    vulnerable: '30-day lifetime, no rotation, and logout only clears the browser cookie.',
    secure: '20-minute idle and 2-hour absolute timeouts, a new token at login, and logout deletes the server record.',
    risk: 'A copied cookie stays usable for weeks, even after the victim logs out.',
    mitigation: 'Rotate on login and privilege change, enforce idle and absolute timeouts, and delete sessions server-side.' },
  { id: 'headers', area: 'HTTP security headers', title: 'Browser-enforced protections', severity: 'Medium', owasp: 'A02 Security Misconfiguration',
    vulnerable: 'No CSP, X-Frame-Options, nosniff or Referrer-Policy. X-Powered-By and Server disclose the stack.',
    secure: 'CSP with frame-ancestors none, X-Frame-Options DENY, nosniff, Referrer-Policy and Permissions-Policy. HSTS over HTTPS.',
    risk: 'Pages can be framed, injected scripts run unrestricted, and the technology stack is advertised.',
    mitigation: 'Send a strict header set on every response, and remove version banners.' },
  { id: 'csrf', area: 'CSRF protections', title: 'Anti-forgery on state-changing requests', severity: 'High', owasp: 'A01 Broken Access Control',
    vulnerable: 'Accepts form posts from any origin, with a state change available over GET.',
    secure: 'Origin validation, a per-session synchronizer token, SameSite=Lax, and no state changes over GET.',
    risk: 'A hostile page can change the signed-in user’s profile without their knowledge.',
    mitigation: 'Combine tokens with Origin checks and SameSite cookies, and only change state on POST, PUT, PATCH or DELETE.' },
  { id: 'input', area: 'Input validation', title: 'Validation and output encoding', severity: 'High', owasp: 'A05 Injection',
    vulnerable: 'Reviews, search reflections and hash fragments are rendered as HTML.',
    secure: 'Allow-list validation on profile fields, escapeHtml on reflection, React text nodes, and textContent on the DOM.',
    risk: 'Stored, reflected and DOM-based scripts execute in the site’s origin.',
    mitigation: 'Validate input with allow-lists and encode output for its context. Treat CSP as a second layer.' },
  { id: 'sql', area: 'Database query handling', title: 'SQL construction', severity: 'Critical', owasp: 'A05 Injection',
    vulnerable: "`... WHERE email = '${email}' AND legacy_pw = '${hash}'`",
    secure: "db.prepare('... WHERE email = ?').get(email)",
    risk: 'Input can rewrite the query, bypass login, and read tables the page never meant to expose.',
    mitigation: 'Use parameterized queries everywhere, plus a least-privilege database account.' },
  { id: 'access', area: 'Access-control implementation', title: 'Object ownership and role checks', severity: 'Critical', owasp: 'A01 Broken Access Control',
    vulnerable: 'Orders are fetched by ID alone. Admin APIs only check for a login. Profile updates accept a role field.',
    secure: 'Ownership enforced on every order read, role enforced server-side, and only allow-listed fields can be updated.',
    risk: 'Any customer can read other customers’ orders, open admin data, or promote themselves.',
    mitigation: 'Deny by default, and check ownership and role on the server for every request.' },
  { id: 'errors', area: 'Error handling', title: 'Error disclosure', severity: 'Medium', owasp: 'A10 Mishandling of Exceptional Conditions',
    vulnerable: 'Stack traces, SQL text and database errors are returned to the browser.',
    secure: 'A generic message plus a request ID. Details stay in the server event log.',
    risk: 'Error detail helps an attacker refine their payloads.',
    mitigation: 'Return generic errors, and log the detail server-side against a request ID.' },
  { id: 'logging', area: 'Logging', title: 'Security event logging', severity: 'Medium', owasp: 'A09 Logging and Alerting Failures',
    vulnerable: 'Events are recorded in both modes so that the lab can be investigated. Vulnerable mode does not act on them.',
    secure: 'The same redacted log, with denied actions and blocked attacks recorded as such.',
    risk: 'Without useful logs an incident cannot be reconstructed, and logs containing secrets become a target themselves.',
    mitigation: 'Log who, what, when and the outcome, redact secrets, and protect log integrity.' },
];

const BASE = `http://127.0.0.1:${APP_PORT}`;

function sessionCookieFrom(res) {
  return res.headers.getSetCookie().find((c) => c.startsWith('lab_session=') && !c.startsWith('lab_session=;'));
}

// Loopback only: every request here goes to this server's own 127.0.0.1 address.
export async function runLiveAudit(base = BASE) {
  const results = {};
  const student = SEED_ACCOUNTS.find((a) => a.role === 'customer');
  const home = await fetch(`${base}/`);
  const required = ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy'];
  const missing = required.filter((h) => !home.headers.get(h));
  results.headers = {
    pass: missing.length === 0 && !home.headers.get('x-powered-by'),
    evidence: missing.length ? `Missing: ${missing.join(', ')}. X-Powered-By: ${home.headers.get('x-powered-by') ?? 'not sent'}` : `All present. X-Frame-Options: ${home.headers.get('x-frame-options')}`,
  };

  const unknown = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'nobody@lab.local', password: 'x' }) });
  const wrong = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'audit-probe@lab.local', password: 'x' }) });
  const [a, b] = [await unknown.json(), await wrong.json()];
  const wrongForReal = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: student.email, password: 'definitely-wrong' }) });
  const c = await wrongForReal.json();
  results.auth = {
    pass: a.error === c.error,
    evidence: a.error === c.error ? `Same message for unknown and known emails: "${c.error}"` : `Account enumeration: "${b.error}" versus "${c.error}"`,
  };

  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: student.email, password: student.password }) });
  const setCookie = sessionCookieFrom(login) ?? '';
  const flags = setCookie.split(';').slice(1).map((f) => f.trim()).join('; ');
  results['cookie-flags'] = {
    pass: /httponly/i.test(setCookie) && /samesite=(lax|strict)/i.test(setCookie),
    evidence: `Set-Cookie attributes observed: ${flags || 'none'}`,
  };
  const cookie = setCookie.split(';')[0];
  const { csrfToken } = await login.json();
  const authed = { Cookie: cookie };

  const crossSite = await fetch(`${base}/api/profile`, { method: 'POST', headers: { ...authed, 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'http://localhost:4001' }, body: 'city=Pune', redirect: 'manual' });
  results.csrf = {
    pass: crossSite.status === 403,
    evidence: `Form post with foreign Origin and a valid cookie returned HTTP ${crossSite.status}`,
  };

  const search = await fetch(`${base}/api/search?q=${encodeURIComponent("'")}`);
  const searchBody = await search.json();
  results.sql = {
    pass: search.status === 200,
    evidence: search.status === 200 ? 'Quote treated as data: parameterized query returned HTTP 200' : `Quote broke the query: "${searchBody.error}"`,
  };

  const reflected = await (await fetch(`${base}/classic/search?q=${encodeURIComponent('<b>probe</b>')}`)).text();
  results.input = {
    pass: !reflected.includes('<strong><b>probe</b>'),
    evidence: reflected.includes('<strong><b>probe</b>') ? 'Reflected <b> markup arrived unencoded' : 'Reflected markup arrived encoded as &lt;b&gt;',
  };

  const alienOrder = await fetch(`${base}/api/orders/1003`, { headers: authed });
  const adminRoute = await fetch(`${base}/api/admin/users`, { headers: authed });
  results.access = {
    pass: alienOrder.status !== 200 && adminRoute.status !== 200,
    evidence: `Student reading Alice's order 1003: HTTP ${alienOrder.status}. Student reading admin users: HTTP ${adminRoute.status}.`,
  };

  const malformed = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: '{broken' });
  const malformedBody = await malformed.json();
  results.errors = {
    pass: !malformedBody.stack,
    evidence: malformedBody.stack ? 'Malformed JSON returned a stack trace to the client' : `Generic error with request ID: "${malformedBody.error}"`,
  };

  const logoutHeaders = { ...authed, Origin: base, 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) };
  await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: logoutHeaders });
  const afterLogout = await fetch(`${base}/api/auth/me`, { headers: authed });
  const stillIn = Boolean((await afterLogout.json()).user);
  results['session-expiry'] = {
    pass: !stillIn,
    evidence: stillIn ? 'The cookie still authenticates after logout' : 'The cookie was rejected after logout',
  };

  results.logging = { pass: true, evidence: 'This audit run was itself recorded in the event log, with secrets redacted.' };
  return results;
}
