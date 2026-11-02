import { Router } from 'express';
import { db } from '../db.js';
import { isSecure } from '../mode.js';
import { logEvent } from '../events.js';
import { escapeHtml, SUSPICIOUS_HTML } from '../security.js';

export const classicRouter = Router();

// A server-rendered "classic catalogue search": the reflected XSS target for Lab 5.
classicRouter.get('/classic/search', (req, res) => {
  const q = String(req.query.q ?? '');
  const secure = isSecure();
  const like = `%${q}%`;
  const rows = q ? db.prepare('SELECT slug, name, collection, price FROM products WHERE published = 1 AND (name LIKE ? OR collection LIKE ?) LIMIT 12').all(like, like) : [];

  if (q && SUSPICIOUS_HTML.test(q)) {
    logEvent(req, {
      action: 'CLASSIC_SEARCH', result: secure ? 'blocked' : 'success',
      securityEvent: secure ? 'XSS_NEUTRALIZED' : 'XSS_REFLECTED_PROBE', details: { context: 'reflected', input: q },
    });
  }

  // VULNERABLE when not secure: the raw query string is written straight into the HTML.
  const shown = secure ? escapeHtml(q) : q;
  const resultRows = rows.map((p) => `<li><a href="/product/${escapeHtml(p.slug)}">${escapeHtml(p.name)}</a><span>${escapeHtml(p.collection)}</span><b>$${Number(p.price).toLocaleString('en-US')}</b></li>`).join('');

  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Classic catalogue search | Halden &amp; Voss</title>
<link rel="stylesheet" href="/classic.css">
<script src="/lab-proof.js"></script>
</head><body>
<header><a href="/">Halden &amp; Voss</a><span>Classic catalogue</span></header>
<main>
<h1>Classic catalogue search</h1>
<form action="/classic/search" method="get"><input name="q" value="${escapeHtml(q)}" placeholder="Search by name or collection" aria-label="Search"><button>Search</button></form>
${q ? `<p class="summary">${rows.length} result${rows.length === 1 ? '' : 's'} for: <strong>${shown}</strong></p>` : '<p class="summary">Enter a search term to browse the archive.</p>'}
<ul>${resultRows}</ul>
</main></body></html>`);
});
