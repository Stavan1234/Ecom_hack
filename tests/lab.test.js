import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { setSetting } from '../server/mode.js';
import { resetDatabase } from '../server/db.js';

let base;
let server;

before(async () => {
  resetDatabase();
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

const json = (path, opts = {}) => fetch(base + path, { headers: { 'Content-Type': 'application/json', Origin: base, ...(opts.headers || {}) }, ...opts });
const setMode = (mode) => json('/api/lab/mode', { method: 'POST', body: JSON.stringify({ mode }) });
async function login(email, password) {
  const res = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('lab_session=') && !c.startsWith('lab_session=;'));
  return { res, cookie: setCookie?.split(';')[0], body: await res.json() };
}

test('storefront lists products and hides unpublished ones', async () => {
  const { products } = await (await json('/api/products?limit=48')).json();
  assert.ok(products.length >= 20);
  assert.ok(!products.some((p) => p.slug === 'prototype-x-unreleased'));
});

test('vulnerable mode: SQL injection bypasses login as admin', async () => {
  await setMode('vulnerable');
  const { body } = await login("' OR 1=1--", 'anything');
  assert.equal(body.user.role, 'admin');
});

test('vulnerable mode: search injection reveals the hidden product', async () => {
  await setMode('vulnerable');
  const { products } = await (await json(`/api/search?q=${encodeURIComponent("zzz') OR 1=1--")}`)).json();
  assert.ok(products.some((p) => p.slug === 'prototype-x-unreleased'));
});

test('secure mode: SQL injection login fails', async () => {
  await setMode('secure');
  const { res } = await login("' OR 1=1--", 'anything');
  assert.equal(res.status, 401);
});

test('secure mode: real login issues an HttpOnly SameSite cookie', async () => {
  await setMode('secure');
  const { res, cookie } = await login('student@lab.local', 'LabStudent123!');
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('lab_session='));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.ok(cookie);
});

test('secure mode: cross-origin profile POST is blocked (CSRF)', async () => {
  await setMode('secure');
  const { cookie } = await login('student@lab.local', 'LabStudent123!');
  const res = await fetch(base + '/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'http://localhost:4001', Cookie: cookie },
    body: 'display_name=hacked',
    redirect: 'manual',
  });
  assert.equal(res.status, 403);
});

test('vulnerable mode: IDOR reads another customer order', async () => {
  await setMode('vulnerable');
  const { cookie } = await login('student@lab.local', 'LabStudent123!');
  const res = await fetch(base + '/api/orders/1003', { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  const { order } = await res.json();
  assert.equal(order.id, 1003);
});

test('secure mode: IDOR is denied with 404', async () => {
  await setMode('secure');
  const { cookie } = await login('student@lab.local', 'LabStudent123!');
  const res = await fetch(base + '/api/orders/1003', { headers: { Cookie: cookie } });
  assert.equal(res.status, 404);
});

test('secure mode: security headers are present', async () => {
  await setMode('secure');
  const res = await fetch(base + '/');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('secure mode: admin API denies a customer', async () => {
  await setMode('secure');
  const { cookie } = await login('student@lab.local', 'LabStudent123!');
  const res = await fetch(base + '/api/admin/users', { headers: { Cookie: cookie } });
  assert.equal(res.status, 403);
});

test('events are logged without secrets', async () => {
  const { events } = await (await json('/api/lab/events?limit=250')).json();
  const dump = JSON.stringify(events);
  assert.ok(!dump.includes('LabStudent123!'));
  assert.ok(events.length > 0);
});

test('live audit passes in secure mode', async () => {
  await setMode('secure');
  const { results } = await (await json('/api/lab/audit/run', { method: 'POST' })).json();
  const failing = Object.entries(results).filter(([, r]) => r.pass === false).map(([k]) => k);
  assert.deepEqual(failing, [], `these checks failed: ${failing.join(', ')}`);
  await setMode('vulnerable');
});
