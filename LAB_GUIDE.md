# Lab Guide — Halden & Voss Security Laboratory

Step-by-step instructions for every laboratory. Generated from the application content, so it matches the in-app Security Lab exactly.

All exercises run locally against `http://127.0.0.1:4000`. Switch modes from **Security Lab → Control centre**.

## Contents

1. [Session Hijacking and Cookie Replay](#lab-1-session-hijacking-and-cookie-replay) — Practical 3 · Lab 1
2. [Cross-Site Request Forgery](#lab-2-cross-site-request-forgery) — Practical 3 · Lab 2
3. [Clickjacking](#lab-3-clickjacking) — Practical 3 · Lab 3
4. [SQL Injection](#lab-4-sql-injection) — Practical 3 · Lab 4 (bonus)
5. [Cross-Site Scripting](#lab-5-cross-site-scripting) — Additional exercise
6. [Broken Access Control and IDOR](#lab-6-broken-access-control-and-idor) — Practical 4 · Audit
7. [Security Configuration Audit](#lab-7-security-configuration-audit) — Practical 4 · Phases 1, 2, 4
8. [Forensic Investigation](#lab-8-forensic-investigation) — Practical 3 · Lab 5 · Practical 4 · Forensic Readiness

---

## Lab 1: Session Hijacking and Cookie Replay

*Practical 3 · Lab 1*

**Objective.** Show that whoever holds a valid session cookie is treated as that user, and that server-side controls decide how long a stolen cookie stays useful.

**What is it?** Session hijacking is taking over someone’s authenticated session by obtaining and reusing their session identifier. Cookie replay is the simplest form: the cookie value is copied into another browser.

**How it works.** After login, the server creates a session record and gives the browser a random token in the lab_session cookie. On each request, the server looks that token up. It has no idea which browser is presenting it, so a copied token works just as well as the original.

**Why it happens.** The server authenticates the token and not the person. The vulnerable configuration makes this worse: JavaScript can read the cookie, it lasts 30 days, it never rotates, and logout only removes it from the browser.

### Prerequisites

- Two different browsers, for example Chrome as Browser A and Firefox as Browser B
- The Cookie-Editor extension installed in both (optional: DevTools can do the same job)
- Both browsers open at http://127.0.0.1:4000, not localhost
- Lab mode set to Vulnerable

### Step by step

1. In Browser A, sign in as student@lab.local / LabStudent123!.
2. Press F12, then Application → Cookies → http://127.0.0.1:4000 (Storage → Cookies in Firefox). Find lab_session. Note the empty HttpOnly and SameSite columns, and the long expiry. Also note lab_prefs, a preferences cookie that does not authenticate anything.
3. Open the Lab 1 console in the Security Lab and press “Read document.cookie”. The session token is visible to JavaScript.
4. In Browser B, open http://127.0.0.1:4000. The header shows “Sign in”, so it is not authenticated.
5. In Browser A, click the Cookie-Editor icon, then Export (JSON). This copies the site’s cookies to your clipboard.
6. In Browser B, click the Cookie-Editor icon, then Import, paste, and confirm. If the import is refused, add just one cookie by hand: name lab_session, value copied from Browser A, path /.
7. Refresh Browser B. It now shows the student’s name. Open /account and /account/orders to confirm the server treats it as the student.
8. Open Security Lab → Lab 1 in Browser B. The “Server’s view” panel reports the same session, issued to Browser A’s browser type. Open Lab 8: a SESSION_REPLAY_SUSPECTED event is recorded.
9. Log out in Browser A. Refresh Browser B: it is STILL signed in. The event log shows SESSION_USED_AFTER_LOGOUT.
10. Switch to Secure mode (this clears all sessions). Repeat steps 1 to 7. Replay with Cookie-Editor still works, which is an important finding (see below). Now log out in Browser A and refresh Browser B: it is signed out and the log shows SESSION_REJECTED.
11. Still in secure mode, sign in again, replay the cookie, then press “Rotate session” in Browser A. Browser B’s copied token dies immediately. Turn on “Short expiry demo” and wait 60 seconds idle to see SESSION_EXPIRED.

### Expected result

- Vulnerable: Browser B becomes the student after importing the cookie, and stays signed in after Browser A logs out.
- Secure: document.cookie does not show lab_session. A manually imported copy can work until logout, rotation or expiry, after which the server rejects it.

### What to watch in DevTools

- Application → Cookies: the Value, Expires, HttpOnly, Secure and SameSite columns
- Network → POST /api/auth/login → Response Headers → Set-Cookie
- Network → any /api request → Request Headers → Cookie
- Console → document.cookie, in each mode

### Evidence to capture

- Screenshot of lab_session in Browser A with its attributes
- Screenshot of Browser B before the import, showing “Sign in”
- Screenshot of Browser B after the import, showing the student account
- The Set-Cookie header in each mode, side by side
- The event timeline showing LOGIN_SUCCESS, then SESSION_REPLAY_SUSPECTED, then SESSION_USED_AFTER_LOGOUT

### How to fix it

- Set HttpOnly so that scripts cannot read the cookie
- Set SameSite=Lax or Strict, and Secure on HTTPS
- Issue a new token at login and on privilege change
- Enforce idle and absolute timeouts
- Delete the session on the server at logout
- Consider re-authentication for sensitive actions, and alert on anomalies such as a browser change

### How secure mode behaves

The cookie gains HttpOnly and SameSite=Lax. Tokens rotate on login. There is a 20-minute idle and 2-hour absolute timeout, and logout deletes the server record, so copies die at once. Note what HttpOnly does NOT do: it blocks page JavaScript only. Cookie-Editor uses the privileged browser cookies API, and malware or a compromised browser can also read the cookie store, so replay remains possible until the server invalidates the session. That is why server-side controls and short lifetimes matter.

---

## Lab 2: Cross-Site Request Forgery

*Practical 3 · Lab 2*

**Objective.** Demonstrate that a browser attaches cookies to requests started by another website, and show how Origin checks, CSRF tokens and SameSite cookies stop it.

**What is it?** CSRF tricks a signed-in user’s browser into sending a state-changing request the user never intended. The request is real and carries the user’s cookies.

**How it works.** The attacker’s page contains a form or link aimed at the target. When it fires, the browser attaches any eligible cookies. If the server relies on the cookie alone, it cannot tell the forged request from a genuine one.

**Why it happens.** Cookies are sent according to where a request is going, not who started it. If the server does not check who initiated a request, then any page can use the victim’s session.

### Prerequisites

- Signed in on the shop at http://127.0.0.1:4000
- Lab mode set to Vulnerable
- The attacker site running (it starts with npm start)

### Step by step

1. Sign in as student@lab.local on the shop. Note your display name in Lab 2’s “Current value” panel.
2. Open http://127.0.0.1:4001/csrf in the same browser. Keep DevTools → Network open with “Preserve log” ticked.
3. Use Variant A (“Claim prize”). You land on the account page and the display name is now “Hacked via CSRF”.
4. Inspect the POST /api/profile request. Origin is http://127.0.0.1:4001, Sec-Fetch-Site is same-site, and the Cookie header is present.
5. Open Lab 2 in the Security Lab. It shows the captured request and the before and after values, and the event log has CSRF_SUCCESS. Restore your name from the panel.
6. Try Variant B (silent iframe) and Variant C (GET link). Note that both also work.
7. SameSite experiment: open the same page as http://localhost:4001/csrf. That origin is cross-site. Try Variant A and compare the Cookie header in Chrome and Firefox. Chrome treats a cookie with no SameSite attribute as Lax, except for a 2-minute “Lax+POST” window just after it is set. Firefox’s default may differ, so record what you actually see. Variant C still works in both, because Lax allows top-level GET navigations.
8. Switch to Secure mode, sign in, and repeat from http://127.0.0.1:4001/csrf. Variant A shows “Request blocked by CSRF protection”. Variant C returns 405. The name does not change, and CSRF_BLOCKED is logged.
9. Repeat from http://localhost:4001/csrf. Check the event’s cookie_present field: it is false, because SameSite=Lax withheld the cookie, and the Origin check blocked the request as well.

### Expected result

- Vulnerable: the display name changes, the capture shows a foreign Origin with a Cookie header, and CSRF_SUCCESS is logged.
- Secure: HTTP 403 for POST and 405 for GET, an unchanged name, and CSRF_BLOCKED in the log.

### What to watch in DevTools

- Network → POST /api/profile → Request Headers → Origin, Referer, Sec-Fetch-Site, Cookie
- Network → Payload → display_name
- Application → Cookies → SameSite column
- Chrome’s Issues tab, which reports cookies blocked by SameSite

### Evidence to capture

- The attacker page and its URL
- The Network entry showing the foreign Origin and the Cookie header
- The original and modified display name, from Lab 2’s capture
- The same request in secure mode, returning 403
- The Lab 8 entries CSRF_SUCCESS and CSRF_BLOCKED

### How to fix it

- A per-session synchronizer token, required on every state-changing request
- Validate the Origin header against an allow-list
- SameSite=Lax or Strict on the session cookie
- Never change state on GET
- Re-authenticate for high-value actions

### How secure mode behaves

POST requests need a matching X-CSRF-Token that a foreign page cannot read. Foreign origins are rejected before the handler runs. SameSite=Lax withholds the cookie from cross-site POSTs. The GET endpoint refuses to change state. These layers are independent: from 127.0.0.1:4001 SameSite does not help because it is same-site, and the Origin and token checks still stop the attack.

---

## Lab 3: Clickjacking

*Practical 3 · Lab 3*

**Objective.** Demonstrate UI redressing against a real authenticated page, reveal how the overlay is positioned, and show that framing headers defeat it.

**What is it?** Clickjacking, or UI redressing, loads a real page in a transparent frame above a decoy, so the click the user thinks they are making lands on the hidden page.

**How it works.** The attacker aligns the framed target’s button with a tempting decoy button. The frame has opacity 0 and a higher z-index, so it is invisible but receives the click. Because the user is signed in, the action runs with their session.

**Why it happens.** By default, browsers allow any page to be framed. The app is responsible for declaring who may embed it.

### Prerequisites

- Signed in on the shop at http://127.0.0.1:4000
- Lab mode set to Vulnerable
- Your VIP preference currently off (see the Lab 3 panel)

### Step by step

1. Sign in as student@lab.local. Check the Lab 3 panel: VIP list is “Off”.
2. Open http://127.0.0.1:4001/clickjack. You see only a prize page and a “CLAIM MY FREE PRIZE” button.
3. Move the slider to 50%. The shop’s real “Join the Private Client list” page appears, with its button exactly over the decoy.
4. Press “Hide again”, then click the decoy button.
5. Return to the Lab 3 panel and refresh it. VIP list is now “On”. You agreed to something you never saw. CLICKJACK_FRAMED_ACTION is logged with framed: true.
6. In DevTools → Elements, select the iframe. Record its opacity, position and z-index, and capture a screenshot.
7. Reset the preference from the Lab 3 panel. Switch to Secure mode, sign in again, and reload the attack page.
8. The frame is now blank even at 100% opacity, the Console reports the refusal, and the click only reaches the decoy. VIP stays “Off”, and FRAME_BLOCKED is logged.
9. Compare the response headers of /vip-invitation in each mode.

### Expected result

- Vulnerable: the hidden page loads in the frame, and the click sets the VIP preference.
- Secure: the browser refuses to render the frame, so the preference is unchanged.

### What to watch in DevTools

- Elements → the iframe and its computed styles
- Network → /vip-invitation → Response Headers → X-Frame-Options, Content-Security-Policy
- Console → the framing refusal message

### Evidence to capture

- The decoy page at 0% opacity
- The same page at 50%, with the button alignment visible
- The iframe’s CSS in the Elements panel
- The VIP preference before and after
- The browser’s refusal in the Console, and the response headers in secure mode

### How to fix it

- Content-Security-Policy: frame-ancestors 'none' (or list trusted parents)
- X-Frame-Options: DENY for older browsers
- SameSite cookies, which reduce the impact in cross-site frames
- Confirmation steps for sensitive actions

### How secure mode behaves

Every response carries X-Frame-Options: DENY and a CSP with frame-ancestors 'none'. The browser refuses to display the page in a frame, on any origin. When both are present, modern browsers follow frame-ancestors.

---

## Lab 4: SQL Injection

*Practical 3 · Lab 4 (bonus)*

**Objective.** Exploit string-built SQL in a login form and a search box, then show how parameterized queries remove the problem.

**What is it?** SQL injection happens when user input changes the structure of a database query instead of being treated purely as a value.

**How it works.** If a query is built by joining strings, a quote in the input closes the string early and the rest of the input is parsed as SQL. Comments remove the rest of the original query.

**Why it happens.** The query text and the data travel together as a single string, so the database cannot tell which part the developer wrote.

### Prerequisites

- Lab mode set to Vulnerable
- Signed out, for the login exercises
- The query inspector open in Lab 4

### Step by step

1. Login bypass: on /login enter email ' OR 1=1-- and any password. You are signed in as the first user in the table, the administrator.
2. Open the Lab 4 query inspector and read the SQL that ran. The password check has been commented out.
3. Targeted bypass: sign out, then use admin@lab.local'-- as the email to choose an account.
4. Error observation: search for a single quote ' on /search. The response shows the database error and the full query text.
5. Hidden product: read the query. It has an opening parenthesis, so search for zzz') OR 1=1-- to list everything, including the unpublished Prototype X.
6. UNION challenge: search for zzz') UNION SELECT 1,2,3,4,5,6,7-- and find where the numbers appear in the results. Fewer or more columns gives an error, which is how the column count is found.
7. List the tables: zzz') UNION SELECT 1,name,name,sql,5,6,7 FROM sqlite_master WHERE type='table'--
8. Capture the flag: extract the note column from internal_notes using the same technique, and submit the flag in Lab 4.
9. Switch to Secure mode. Repeat the login bypass and the search. The login fails, the quote is simply searched for, and the query inspector shows ? placeholders with separate parameters.

### Expected result

- Vulnerable: login bypass succeeds, errors reveal the query, and UNION returns data from other tables.
- Secure: payloads are treated as literal text. Login fails with a generic error, and search returns no results.

### What to watch in DevTools

- Network → POST /api/auth/login → Payload and Response
- Network → GET /api/search → Response, including the SQL error
- Lab 4 query inspector (a teaching aid, not something a real app exposes)

### Evidence to capture

- The login form with the payload and the signed-in admin result
- The query inspector showing the rewritten SQL
- The verbose SQL error
- The UNION results and the captured flag
- The parameterized version of the same query in secure mode

### Safety

Injected SQL runs on a read-only connection to the fabricated database, one statement at a time. It cannot modify data, run operating-system commands, or attach other files.

### Hints

- The search query starts: ... WHERE published = 1 AND (name LIKE '%YOUR_INPUT%' ... so you need to close both the string and the parenthesis.
- The original query returns 7 columns. Your UNION must return 7 too.
- SQLite lists its tables in sqlite_master.
- Try: zzz') UNION SELECT 1,label,note,4,5,6,7 FROM internal_notes--

### How to fix it

- Prepared statements or parameterized queries for all values
- Allow-lists for things that cannot be parameters, such as sort columns
- Generic errors for clients, with detail in server logs
- A least-privilege database account
- Slow, salted password hashes verified in application code

### How secure mode behaves

Queries use ? placeholders on prepared statements, so input is always data. Passwords are verified in code with salted scrypt, not compared inside SQL. Errors are generic, and suspicious input is logged as SQLI_NEUTRALIZED.

---

## Lab 5: Cross-Site Scripting

*Additional exercise*

**Objective.** Execute a harmless proof of concept in all three XSS contexts, then show context-aware output encoding, safe DOM APIs and CSP stopping it.

**What is it?** XSS gets attacker-controlled script running in a victim’s browser, inside the site’s origin, so it runs with all of the site’s privileges.

**How it works.** Stored XSS is saved and served to other users. Reflected XSS comes back from the server in the same response. DOM-based XSS happens entirely in the browser, when client code writes untrusted data into the page.

**Why it happens.** Data is placed into HTML without encoding, so the browser interprets it as markup and code.

### Prerequisites

- Lab mode set to Vulnerable
- Signed in, for the stored exercise
- Use only the harmless alert payload

### Step by step

1. Stored: open any product, for example /product/meridian-39-midnight, and post a review with the text <img src=x onerror="alert('XSS Test')">
2. The alert fires as the review renders, and again for anyone who opens this product. XSS_EXECUTED_STORED is logged.
3. Reflected: open /classic/search?q=<script>alert('XSS Test')</script> (or use Lab 5’s prepared link). View the page source to see the payload written verbatim.
4. DOM-based: open /engraving#text=<img src=x onerror="alert('XSS Test')">. The server never receives the fragment, so you can confirm in the Network tab that the payload is absent from the request. Client code writes it with innerHTML.
5. Check Lab 5: each context shows as completed, because the app’s alert wrapper recorded execution.
6. Switch to Secure mode and repeat all three. The stored review shows as plain text, the reflected page shows the encoded payload, and the engraving preview prints the text literally. No alerts fire.
7. Inspect the response headers for the CSP. Open DevTools → Elements on the review to see the text node.

### Expected result

- Vulnerable: “XSS Test” alerts appear in all three contexts.
- Secure: the payload is displayed as harmless text, and the Console stays clean or reports CSP refusals.

### What to watch in DevTools

- Elements → the rendered review or preview
- View Source (Ctrl+U) → the reflected value
- Network → confirm the fragment after # is never sent
- Console → CSP violations in secure mode

### Evidence to capture

- A screenshot of the alert for each context
- The raw payload in View Source for reflected XSS
- The Network request that shows the DOM payload never reached the server
- The same input safely rendered in secure mode
- The CSP response header

### How to fix it

- Encode output for its context (HTML, attribute, URL, JavaScript)
- Use textContent and framework text bindings, not innerHTML
- If HTML is truly needed, sanitize it with a vetted library
- Add a strict CSP with no unsafe-inline scripts
- Set HttpOnly on session cookies to reduce impact

### How secure mode behaves

Reviews are rendered as React text nodes. The server HTML-encodes the reflected value. The engraving preview uses textContent. A CSP with script-src 'self' blocks inline handlers as a second layer.

---

## Lab 6: Broken Access Control and IDOR

*Practical 4 · Audit*

**Objective.** Show the difference between authentication and authorization by reaching data that belongs to others, then enforcing ownership and role checks on the server.

**What is it?** Broken access control lets users act outside their permissions. An IDOR is a case of this where changing an identifier in a request reaches another user’s object.

**How it works.** The server takes an ID from the request and fetches the record without checking who owns it. Being signed in is treated as being allowed.

**Why it happens.** Developers often check that a user is logged in, assume the interface will only offer valid links, and forget to check each object on the server.

### Prerequisites

- Lab mode set to Vulnerable
- Signed in as student@lab.local (orders 1001 and 1002)
- Alice (alice@lab.local) owns orders 1003 and 1004

### Step by step

1. Sign in as student@lab.local. Open Account → Orders, then open order 1001. Its URL is /account/orders/1001.
2. Change the number to 1003. You can read Alice’s address, order and private note. IDOR_ACCESS is logged.
3. Check the API directly in the Lab 6 tester, or at /api/orders/1003. Try /api/users/3 for her profile too.
4. Vertical: as the student there is no Admin link in the menu, but /admin loads, and /api/admin/users responds. ADMIN_ROUTE_EXPOSED is logged.
5. Mass assignment: in Lab 6, send the prepared profile update with “role”: “admin”. Refresh and you are an administrator. Restore your role with the reset button.
6. Switch to Secure mode, sign in as the student, and repeat. Order 1003 returns 404, /api/users/3 returns 403, /admin shows “access required”, and the role field is ignored. ACCESS_DENIED is logged.
7. Sign in as admin@lab.local to confirm that real administrators still have access.

### Expected result

- Vulnerable: the student reads Alice’s order and the admin data, and can become an admin.
- Secure: 403 or 404 responses, with denials recorded in the log.

### What to watch in DevTools

- Network → GET /api/orders/1003 → status and body
- Network → GET /api/admin/users → status
- Network → POST /api/profile → Payload with the role field

### Evidence to capture

- The student’s session viewing Alice’s order
- The same request returning 404 in secure mode
- The admin API response as a customer
- The ACCESS_DENIED entries in Lab 8

### How to fix it

- Check ownership on the server for every object
- Check roles on the server for every privileged route
- Deny by default
- Allow-list the fields a client may update
- Use random IDs as defence in depth, not as the main control
- Log and alert on denials

### How secure mode behaves

Order reads require ownership or the admin role. Missing and forbidden orders both return 404, so IDs cannot be probed. Admin routes check the role on the server, and profile updates ignore role.

---

## Lab 7: Security Configuration Audit

*Practical 4 · Phases 1, 2, 4*

**Objective.** Assess the application’s configuration against the audit matrix in each mode, record findings with severity and evidence, and map them to mitigations.

**What is it?** A web application security audit is a structured assessment of an application’s controls, producing findings, evidence and mitigations.

**How it works.** The audit inspects observable behaviour: response headers, cookies, responses to crafted requests, and access-control decisions. The live probe here performs a small DAST pass against the running server.

**Why it happens.** Configuration problems are common and easy to miss, and browsers can only enforce protections that the server asks for.

### Prerequisites

- Run the audit once in each mode
- Optional: OWASP ZAP, scoped only to http://127.0.0.1:4000

### Step by step

1. Open Security Lab → Lab 7 and press “Run live audit” in Vulnerable mode. Record the failed checks.
2. For each finding, read the severity, the live evidence and the mitigation.
3. Verify a few by hand: F12 → Network → document response headers; Application → Cookies; submit a wrong password and compare error messages.
4. Switch to Secure mode and run the audit again. Compare results side by side.
5. Optional: point OWASP ZAP at http://127.0.0.1:4000, use the spider and passive scan, and compare its alerts. Only scan this local target.
6. Build your report from the findings table, with evidence and a mitigation plan.

### Expected result

- Vulnerable: most checks fail with concrete evidence.
- Secure: all checks pass, with evidence of each control.

### What to watch in DevTools

- Network → Document → Response Headers
- Application → Cookies
- Network → failed login responses, for enumeration
- Repeated bad logins returning HTTP 429 in secure mode

### Evidence to capture

- Audit results in each mode
- Response headers in each mode
- A findings table with severity, evidence and mitigation

### How to fix it

- Follow each finding’s mitigation
- Prioritize Critical and High issues first
- Re-test after fixing, as the audit does in secure mode

### How secure mode behaves

All live checks pass: headers present, cookie attributes correct, token and Origin enforced, parameterized SQL, encoded output, server-side authorization, generic errors and real logout.

---

## Lab 8: Forensic Investigation

*Practical 3 · Lab 5 · Practical 4 · Forensic Readiness*

**Objective.** Reconstruct what happened from server-side events, correlate them with browser evidence, and export a redacted evidence file with an integrity digest.

**What is it?** Web forensics reconstructs what happened in an incident from logs and browser artifacts, in a way that others can verify.

**How it works.** Each security-relevant event records a timestamp, request ID, user ID, method, endpoint, action, result, origin and event type, without recording secrets.

**Why it happens.** Attacks like cookie replay look like normal requests at the time. Only well-kept logs let you reconstruct the chain afterwards.

### Prerequisites

- Complete at least Labs 1 to 3 so there are events to investigate

### Step by step

1. Reset the lab for a clean timeline. Then perform Lab 1 and Lab 2 in Vulnerable mode.
2. Open Security Lab → Lab 8 and filter by security events. Read upwards from LOGIN_SUCCESS.
3. Identify the takeover: the SESSION_REPLAY_SUSPECTED row’s details show the browser type changing.
4. Identify the CSRF: the CSRF_SUCCESS row shows the foreign origin and the before and after values.
5. Take a request ID from an event, then find the same value in DevTools → Network → Response Headers → X-Request-Id. This correlates client and server evidence.
6. Check the exported data for secrets: no passwords, cookies or tokens should appear.
7. Press “Export evidence (JSON)”. Record the digest in meta.integrity, the file’s SHA-256 (certutil -hashfile file.json SHA256), who collected it, and when. That record is your chain of custody.
8. In DevTools → Network, right-click → “Save all as HAR” as additional client-side evidence. Warning: unlike the export, a HAR contains real cookies, so treat it as sensitive.
9. Write the timeline: initial login → attack → effect → detection → mitigation.

### Expected result

- A timeline that explains each attack step with timestamps and request IDs.
- A JSON export with secrets redacted and an integrity digest.

### What to watch in DevTools

- Network → any response → X-Request-Id
- Network → Export HAR
- Application → Cookies, as a browser artifact

### Evidence to capture

- The filtered timeline
- The JSON export and its digest
- Screenshot correlating a request ID in both places
- Your reconstruction table: evidence type, source, artifact, significance

### How to fix it

- Decide what to log before an incident happens
- Never log credentials or tokens
- Protect logs from tampering, and retain them
- Synchronize clocks, and use correlation IDs

### How secure mode behaves

Logging is identical in both modes so that results can be compared. In secure mode, attacks appear as blocked or denied entries rather than successes.
