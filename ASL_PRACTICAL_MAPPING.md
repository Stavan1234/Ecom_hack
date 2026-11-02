# ASL Practical Mapping

How this application covers **Advanced Security Laboratory (CELBC711)** Practical 3 and Practical 4. Priority order follows the brief: session hijacking, CSRF, clickjacking, forensic investigation and web-application auditing first; SQL injection, XSS and IDOR as additional exercises.

## Practical 3 — Web Attacks, Session Hijacking, CSRF, Clickjacking &amp; Forensics

| Practical 3 requirement | Where in this app | Mode behaviour |
| --- | --- | --- |
| Session hijacking &amp; credential replay via two browsers / DevTools | **Lab 1** + Session inspector. Real server-side `lab_session`; replay from Browser A into Browser B. | Vulnerable: readable cookie, 30-day life, no rotation, logout leaves server session valid. Secure: HttpOnly, SameSite=Lax, rotation, idle/absolute timeout, server-side logout. |
| Cookie inspection &amp; the role of cookie flags | **Lab 1**, F12 → Application → Cookies, and the live audit's cookie-flags check. | Side-by-side `Set-Cookie` in each mode. |
| CSRF demonstration &amp; SameSite analysis | **Lab 2** + the separate attacker origin (`:4001`), with same-site vs cross-site variants. | Vulnerable: cross-origin form post changes the profile. Secure: Origin check + per-session token + SameSite + no state on GET → 403/405. |
| Clickjacking PoC (victim + decoy pages) | **Lab 3** + `/clickjack` attacker page framing the real `/vip-invitation`. | Vulnerable: transparent frame, hidden action fires. Secure: `X-Frame-Options: DENY` + `frame-ancestors 'none'` block framing. |
| SQL injection login bypass | **Lab 4**, `' OR 1=1--` on the login form, with a query inspector. | Vulnerable: concatenated SQL, bypass works. Secure: parameterized, bypass fails. |
| Forensic investigation &amp; evidence reconstruction | **Lab 8** event timeline + redacted JSON export with SHA-256 digest; request-ID correlation with DevTools. | Identical logging in both modes; attacks appear as success vs blocked. |
| DevTools (F12) network/storage evidence | Every lab's "What to watch in DevTools" section; `X-Request-Id` on every response. | — |
| Mitigation documentation | Each lab's "How to fix it" + **Lab 7** audit with OWASP mapping. | — |

## Practical 4 — Web Application Security Audit, OWASP Top 10 &amp; Forensic Readiness

| Practical 4 requirement | Where in this app | Notes |
| --- | --- | --- |
| Architecture profiling &amp; attack-surface mapping | README architecture + **Lab 7** audit areas. | Auth, session, access control, input, configuration. |
| Manual interactive audit via DevTools | **Lab 7** steps; response headers, cookies, login error comparison, rate limiting. | — |
| Automated DAST (OWASP ZAP) | **Lab 7** optional ZAP procedure, scoped to `127.0.0.1:4000` only. | The built-in live audit is a lightweight DAST pass. |
| Source-code audit: insecure vs secure patterns | **Lab 7** side-by-side cards; actual vulnerable and secure code paths in `server/`. | Password storage, SQL, output handling. |
| Authentication failures (hashing, enumeration, brute force) | **Lab 7** auth check; `auth.js`. | Vulnerable: unsalted MD5 in SQL, enumerating errors, no limit. Secure: salted scrypt, generic error, HTTP 429. |
| Session management &amp; cookie security | **Lab 1** + audit session-expiry and cookie-flags checks. | Rotation, idle/absolute timeout, server-side invalidation. |
| Broken Access Control &amp; IDOR (OWASP #1) | **Lab 6**: horizontal (other customers' orders/profiles), vertical (admin routes), mass assignment. | Secure: ownership + role enforced server-side; role field ignored. |
| Injection — SQLi &amp; XSS (OWASP #3/#5) | **Lab 4** &amp; **Lab 5** (stored, reflected, DOM). | Secure: parameterized SQL, context-aware encoding, CSP. |
| Security misconfiguration &amp; headers (OWASP #2) | **Lab 7** headers check. | Secure: CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS over HTTPS. |
| Cryptographic failures (OWASP #4) | **Lab 7** auth check; password storage. | MD5 → salted scrypt. |
| Error handling &amp; logging/alerting (OWASP #9/#10) | **Lab 7** errors + logging checks; **Lab 8**. | Secure: generic error + request ID; detail stays server-side. |
| Forensic readiness plan | **Lab 8** + redacted export with integrity digest and chain-of-custody notes. | No passwords/tokens/cookies ever logged. |
| Mitigation plan | Each finding's mitigation + OWASP category in **Lab 7**. | — |

## Priority summary

- **Highest priority (fully built, tested, with evidence tools):** Lab 1 session hijacking, Lab 2 CSRF, Lab 3 clickjacking, Lab 7 audit, Lab 8 forensics.
- **Additional exercises (also fully built):** Lab 4 SQL injection, Lab 5 XSS, Lab 6 IDOR / access control.

Every item above is demonstrable live in both modes on the local install.
