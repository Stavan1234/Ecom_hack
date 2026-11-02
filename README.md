# Halden &amp; Voss — Luxury Storefront &amp; Web Security Training Laboratory

A realistic, fictional luxury e-commerce website (fine watches and collector automobiles) with a fully integrated, intentionally vulnerable **web security training laboratory**. Built for the **Advanced Security Laboratory (CELBC711)** Practicals 3 and 4.

The same storefront runs in two configurations you switch between from a local control panel:

- **Vulnerable mode** — deliberately insecure implementations, for controlled demonstrations.
- **Secure mode** — the corrected implementations, for comparison.

> ⚠️ **This application is intentionally vulnerable.** Run it only on your own machine. It binds to `127.0.0.1` only and must never be exposed to the internet or deployed publicly in vulnerable mode. A public deployment is force-locked to secure mode (see [Deploying to Vercel](#deploying-to-vercel-secure-mode-only)).

---

## Contents

- [What you get](#what-you-get)
- [Requirements](#requirements)
- [Install &amp; run](#install--run)
- [Shutdown](#shutdown)
- [Test accounts](#test-accounts)
- [Two-browser setup](#two-browser-setup)
- [Cookie-Editor setup](#cookie-editor-setup)
- [The laboratories](#the-laboratories)
- [Switching modes](#switching-modes)
- [Resetting the lab](#resetting-the-lab)
- [Inspecting logs &amp; evidence](#inspecting-logs--evidence)
- [Architecture](#architecture)
- [Deploying to Vercel](#deploying-to-vercel-secure-mode-only)
- [Companion documents](#companion-documents)
- [Troubleshooting](#troubleshooting)

---

## What you get

A polished storefront — homepage, categories, search, product cards and detail pages, procedurally-rendered product imagery, cart, simulated checkout, registration, login, profile, order history, wishlist, account settings and an admin dashboard — and a **Security Lab** with eight guided laboratories, a vulnerable/secure switch, a reset button, a live configuration audit, a forensic event log and a redacted evidence export.

Everything is fabricated. No real brand, person, product, order or payment is involved, and nothing can be bought.

## Requirements

- **Node.js 24** (the app uses the built-in `node:sqlite`, which is stable in Node 24). Node 22.5+ works if started with `--experimental-sqlite`.
- npm 11+
- Windows 11, macOS or Linux. No Docker, no build tools, no native modules, no API keys, no cloud database.
- Two different browsers for the session labs (for example Chrome and Firefox).

Verify your versions:

```bash
node -v
npm -v
```

## Install &amp; run

From the project folder:

```bash
npm install
```

```bash
npm start
```

The first `npm start` builds the front end automatically (a few seconds), then launches both servers:

- **Storefront** — http://127.0.0.1:4000
- **Security Lab** — http://127.0.0.1:4000/lab
- **Attacker demo site** — http://127.0.0.1:4001 (same-site) and http://localhost:4001 (cross-site)

Open http://127.0.0.1:4000 in your browser. The database (`data/lab.db`) is created and seeded on first run.

> Use `127.0.0.1`, not `localhost`, for the main app in the session labs, so the attacker origin on `localhost:4001` is treated as cross-site.

## Shutdown

Press **Ctrl+C** in the terminal running `npm start`. To free the ports manually on Windows, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Test accounts

| Email | Password | Role |
| --- | --- | --- |
| `admin@lab.local` | `LabAdmin123!` | Administrator |
| `student@lab.local` | `LabStudent123!` | Customer (orders 1001, 1002) |
| `alice@lab.local` | `LabAlice123!` | Customer (orders 1003, 1004) |

Fabricated, disposable, local-only. Registering new accounts works too (in vulnerable mode the password rules are relaxed, on purpose). `npm run reset` restores all three.

## Two-browser setup

Labs 1–3 use two browsers so one is the victim and one is the attacker:

1. **Browser A** (e.g. Chrome) — open http://127.0.0.1:4000 and sign in. This is the victim.
2. **Browser B** (e.g. Firefox) — open http://127.0.0.1:4000 and stay signed out. This is the attacker.

Both talk to the same local backend, so a session created in A is a real server-side session you can try to reuse in B.

## Cookie-Editor setup

For Lab 1 (session replay):

1. Install the **Cookie-Editor** extension in both browsers (Chrome Web Store / Firefox Add-ons).
2. In Browser A, signed in, open Cookie-Editor on `127.0.0.1` and use **Export → JSON**.
3. In Browser B, open Cookie-Editor on `127.0.0.1` and **Import** the JSON (or add a single cookie named `lab_session` by hand with the value copied from A, path `/`).
4. Refresh Browser B and observe the result. Full steps are in [LAB_GUIDE.md](LAB_GUIDE.md) and in the in-app Lab 1 page.

Browser DevTools (F12 → Application/Storage → Cookies) can do the same job if you prefer not to install the extension.

## The laboratories

| # | Laboratory | Practical | Priority |
| --- | --- | --- | --- |
| 1 | Session Hijacking &amp; Cookie Replay | P3 · Lab 1 | ★ highest |
| 2 | Cross-Site Request Forgery (CSRF) | P3 · Lab 2 | ★ |
| 3 | Clickjacking | P3 · Lab 3 | ★ |
| 4 | SQL Injection | P3 · Lab 4 | bonus |
| 5 | Cross-Site Scripting (stored / reflected / DOM) | additional | |
| 6 | Broken Access Control &amp; IDOR | P4 · audit | |
| 7 | Security Configuration Audit | P4 · phases 1,2,4 | ★ |
| 8 | Forensic Investigation | P3 · Lab 5 / P4 | ★ |

Each in-app lab page carries: objective, concepts, prerequisites, step-by-step instructions, expected result, what to capture, why the vulnerability exists, how to fix it, how secure mode differs, and viva questions. The same content is in [LAB_GUIDE.md](LAB_GUIDE.md) and [VIVA_QUESTIONS.md](VIVA_QUESTIONS.md).

## Switching modes

**Security Lab → Control centre → Mode.** Switching clears all sessions and signs everyone out (cookie attributes are fixed when a cookie is issued, so a fresh login is needed to see the new behaviour). Both modes share one storefront, so you can run the same action in each and compare.

## Resetting the lab

- **Security Lab → Reset lab** restores the fabricated data and clears all sessions, events and evidence. Mode returns to vulnerable.
- From a terminal: `npm run reset`.
- **Clear sessions** and **Clear events** are also available for a lighter cleanup.

## Inspecting logs &amp; evidence

**Security Lab → Evidence &amp; logs** shows the forensic event timeline (timestamp, request ID, user, method, endpoint, action, result, origin, security event). Click a row to expand its details. **Export evidence (JSON)** downloads the full log, captured requests and notes with every secret redacted and a SHA-256 integrity digest for chain of custody. Each lab page also surfaces the tools relevant to it (session inspector, request captures, SQL query inspector, live audit).

## Architecture

```
Browser (React SPA, Vite build)  ──►  Express app on 127.0.0.1:4000
                                        ├─ /api/*      JSON API (auth, store, account, admin, lab)
                                        ├─ /img/*      procedural SVG product images
                                        ├─ /classic/*  server-rendered page (reflected-XSS target)
                                        └─ dist/       the built SPA
Attacker site (static) ───────────►  Express app on 127.0.0.1:4001  (CSRF + clickjacking pages)
Storage: node:sqlite file at data/lab.db (fabricated data)
```

- **Backend:** Node.js + Express 5, `node:sqlite` (no native modules). One read-only connection serves the deliberately injectable queries, so injected SQL can read fabricated data but cannot modify it or run stacked statements.
- **Frontend:** React 18 + React Router, built with Vite.
- **Mode, sessions, events, evidence** all live in the SQLite database. Secrets are never logged.
- **Loopback only:** both servers bind to `127.0.0.1`, with a second guard that rejects non-loopback peers and Host headers.

See [ASL_PRACTICAL_MAPPING.md](ASL_PRACTICAL_MAPPING.md) for how each lab maps to the practical requirements.

## Deploying to Vercel (secure mode only)

The brief forbids deploying the vulnerable app publicly, so a Vercel deployment is **force-locked to secure mode**: `server/config.js` sets `PUBLIC_DEMO` whenever `VERCEL` is present, which disables the lab controls, registration and every vulnerable code path, and serves the storefront in secure mode with a tmp database.

1. Push this repository to GitHub.
2. Import it into Vercel. `vercel.json` and `api/index.js` are already configured (Vite build → `dist`, API routed to the serverless function).
3. In the Vercel project settings, set the **Node.js version to 24.x** (required for `node:sqlite`).
4. Deploy. The public site is a secure-mode showcase of the storefront; the vulnerable laboratories remain available only on your local machine.

> The fully tested, examination-ready target is the local install. Treat the Vercel deployment as a public portfolio preview of the storefront.

## Companion documents

- [ASL_PRACTICAL_MAPPING.md](ASL_PRACTICAL_MAPPING.md) — exercises mapped to Practical 3 and Practical 4.
- [LAB_GUIDE.md](LAB_GUIDE.md) — full step-by-step guide (generated from the app).
- [VIVA_QUESTIONS.md](VIVA_QUESTIONS.md) — oral-exam answers (generated from the app).
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — common problems and fixes.

Regenerate the two generated guides after editing the curriculum with `npm run docs`.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md). Most common: a port is in use (stop the other process), or `node:sqlite` is missing (use Node 24, or start with `--experimental-sqlite` on Node 22).
