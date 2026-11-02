# Viva Questions — Halden & Voss Security Laboratory

Spoken-ready answers for the oral examination, grouped by laboratory. Generated from the application content.

## Lab 1: Session Hijacking and Cookie Replay

**Q1. What is session hijacking?**

Taking over an active authenticated session by stealing or replaying its session identifier, so the attacker never needs the password.

**Q2. Why does the server accept the cookie in Browser B?**

The session ID is a bearer credential. The server checks that the token maps to a valid session, and nothing in that check ties it to one specific browser.

**Q3. Does HttpOnly stop this attack?**

It stops JavaScript, and so XSS, from reading the cookie. It does not stop browser extensions with cookie permission, malware, or someone with access to the machine.

**Q4. Why is logout on the client alone not enough?**

Clearing the browser’s cookie leaves the server’s session valid, so any copy still works. Logout must delete the server-side record.

**Q5. What is session rotation, and what does it prevent?**

Issuing a new session ID at login or privilege change and destroying the old one. It defeats session fixation and shortens the useful life of a stolen token.

**Q6. Idle timeout versus absolute timeout?**

Idle ends a session after a period of inactivity. Absolute ends it a fixed time after login no matter what, which limits how long a hijacked session can be kept alive.

**Q7. Server-side sessions versus JWTs?**

A server-side session is an opaque ID looked up on each request, so it can be revoked instantly. A JWT carries signed claims and is verified without a lookup, which makes immediate revocation harder.

**Q8. What does the Secure flag do, and why is it absent here?**

It restricts the cookie to HTTPS. This lab runs over plain HTTP on loopback, so it is added automatically only when the app is served over HTTPS.

## Lab 2: Cross-Site Request Forgery

**Q1. What is CSRF?**

Tricking a signed-in user’s browser into sending an unwanted state-changing request to a site that trusts it. The browser adds the cookies automatically.

**Q2. What is the difference between origin and site?**

Origin is scheme, host and port. Site is the scheme plus registrable domain, ignoring port. So 127.0.0.1:4000 and 127.0.0.1:4001 are different origins but the same site.

**Q3. Why does SameSite not stop the attack from 127.0.0.1:4001?**

SameSite only looks at the site. That page and the shop are same-site because ports do not count, so cookies are still sent. Origin and token checks are needed too.

**Q4. How does a CSRF token work?**

The server generates a random value tied to the session and requires it on writes. The same-origin policy stops an attacker’s page from reading it, so a forged request cannot include it.

**Q5. Lax versus Strict?**

Strict never sends the cookie on cross-site requests. Lax also sends it on top-level GET navigations, which keeps inbound links working but means GET must never change state.

**Q6. Why can CSRF change data but not read it?**

The browser sends the request, but the same-origin policy prevents the attacking page from reading the response.

**Q7. Does CORS stop CSRF?**

No. CORS controls who may read a response. A simple form post is sent regardless. Misconfigured CORS with credentials can make things worse.

**Q8. Does XSS defeat CSRF protection?**

Yes. Script running in the site’s origin can read the token and send same-origin requests, so XSS must be fixed separately.

## Lab 3: Clickjacking

**Q1. What is clickjacking?**

Tricking a user into clicking something hidden, by overlaying a transparent frame of a real page on top of a decoy.

**Q2. What does X-Frame-Options do?**

It tells the browser whether a page may be framed: DENY or SAMEORIGIN. ALLOW-FROM is obsolete.

**Q3. Why is frame-ancestors preferred?**

It is the modern standard, supports multiple trusted origins, and takes priority over X-Frame-Options in current browsers.

**Q4. Why does the attack work with the user’s session?**

The framed page is a normal request to the shop, so cookies are sent if the rules allow. Here the attacker is same-site, so SameSite does not withhold them.

**Q5. Why does a CSRF token not help?**

The click happens on the genuine page, which already holds a valid token, so the request is legitimate as far as the server can tell.

**Q6. Are JavaScript frame busters a good defence?**

No. They can be defeated, for example with the iframe sandbox attribute. HTTP headers are the reliable control.

## Lab 4: SQL Injection

**Q1. What is SQL injection?**

Injecting SQL syntax through input so that it changes the meaning of a database query.

**Q2. Explain ' OR 1=1--**

The quote closes the email string, OR 1=1 makes the condition always true, and -- comments out the password check. The first row is returned, often an admin.

**Q3. Why do parameterized queries work?**

The SQL is compiled first with placeholders. Values are bound afterwards and are never parsed as SQL, so they cannot change the query’s structure.

**Q4. Why does a UNION need the same number of columns?**

UNION combines result sets, and SQL requires them to have matching column counts. Attackers use this to probe the shape of the query.

**Q5. Is escaping or filtering enough?**

No. Block-lists are bypassed easily and escaping is easy to get wrong. Parameters are the primary defence, with validation as a second layer.

**Q6. Why are verbose errors dangerous?**

They reveal table names, query structure and the database type, which makes exploitation much faster.

**Q7. What is blind SQL injection?**

Injection where no data is returned directly, so information is inferred from true or false behaviour or from timing.

## Lab 5: Cross-Site Scripting

**Q1. What are the three types of XSS?**

Stored is saved on the server and served to others. Reflected is echoed back from the request. DOM-based is created by client code, with no server involvement required.

**Q2. Why does the DOM payload use an img tag instead of script?**

Script tags inserted with innerHTML do not execute, but event handlers such as onerror do.

**Q3. What is output encoding?**

Converting special characters to safe forms for the context, such as < to &lt; in HTML, so the browser treats them as text.

**Q4. How does CSP help?**

It restricts where scripts may come from. script-src 'self' blocks inline handlers and injected scripts even if encoding is missed somewhere.

**Q5. Why does React usually prevent XSS, and when does it not?**

It escapes values rendered as text. It does not protect dangerouslySetInnerHTML or direct DOM writes, which is exactly how this lab is vulnerable.

**Q6. What can real XSS do?**

Act as the user in that origin: read page data, call APIs, read tokens and non-HttpOnly cookies, and alter the page.

**Q7. Input validation or output encoding?**

Both, but output encoding is the primary XSS defence, since it is applied where the data meets the context.

## Lab 6: Broken Access Control and IDOR

**Q1. Authentication versus authorization?**

Authentication proves who you are. Authorization decides what you are allowed to do.

**Q2. What is an IDOR?**

Changing an identifier in a request to reach another user’s object, because the server does not check ownership.

**Q3. Horizontal versus vertical privilege escalation?**

Horizontal reaches other users at the same level, such as another customer’s order. Vertical gains higher privileges, such as admin functions.

**Q4. Do random IDs fix IDOR?**

No. They make guessing harder, but leaked IDs still work. The server must check authorization.

**Q5. Why return 404 rather than 403 for orders?**

It avoids confirming that an order exists, which prevents enumeration.

**Q6. What is mass assignment?**

Binding request fields directly to a record, which lets a client set fields it should not control, such as role.

**Q7. Why is hiding the admin link not enough?**

The interface is under the client’s control. Anyone can call the API directly, so the check must be on the server.

## Lab 7: Security Configuration Audit

**Q1. What is a security audit?**

A structured review of an application’s security controls that produces evidence-based findings and recommended mitigations.

**Q2. SAST versus DAST?**

SAST analyses source code without running it. DAST tests the running application from the outside.

**Q3. What is the OWASP Top 10?**

A regularly updated awareness list of the most critical web application security risks, with Broken Access Control at number one.

**Q4. What is account enumeration, and how is it prevented?**

Using different responses to learn which accounts exist. Prevent it with identical messages and similar timing.

**Q5. How do you mitigate brute force?**

Rate limits, lockouts with backoff, MFA, and slow password hashes.

**Q6. Allow-listing versus block-listing?**

An allow-list accepts only known-good input. A block-list tries to reject known-bad input and is easier to bypass, so allow-lists are preferred.

**Q7. Why should Argon2id or scrypt be used over MD5?**

They are slow and salted, and they use memory, which makes large-scale cracking far more expensive. MD5 is fast and unsuitable for passwords.

## Lab 8: Forensic Investigation

**Q1. What is forensic readiness?**

Preparing systems in advance to collect reliable evidence, so that an incident can be investigated quickly and at low cost.

**Q2. What should be logged?**

Logins, logouts, failures, permission denials, sensitive changes and admin actions, each with time, actor, source, action and result.

**Q3. Should passwords or session tokens be logged?**

Never. Logs are widely accessible, and a logged token is a working credential.

**Q4. What is a cryptographic hash used for in forensics?**

To prove evidence has not changed: if the hash matches the one recorded at collection, the file is unchanged.

**Q5. What is chain of custody?**

A documented record of who collected, handled and stored evidence, and when.

**Q6. What is a HAR file?**

An HTTP Archive: a JSON record of browser network traffic. It can contain live cookies, so it must be protected.

**Q7. What is a browser artifact?**

Residual evidence of activity in the browser, such as cookies, local storage, cache and history.

## Glossary quick reference

**HTTP.** The request and response protocol of the web. It is stateless, so each request stands alone unless something like a cookie links them.

**HTTPS.** HTTP over TLS, which encrypts traffic and authenticates the server, protecting cookies and data from eavesdropping on the network.

**Cookie.** A small value stored by the browser for a site and sent automatically on matching requests.

**Session.** Server-side state representing a logged-in user, referenced by an identifier in a cookie.

**Session ID.** A random token that identifies a session. Whoever holds it is treated as that user, which makes it a bearer credential.

**JWT.** JSON Web Token: signed, self-contained claims (header, payload, signature). It is signed rather than encrypted, and hard to revoke before it expires.

**Origin.** Scheme + host + port, for example http://127.0.0.1:4000. Most browser isolation is based on it.

**Site.** Scheme + registrable domain, ignoring port. SameSite cookies use this, not origin.

**Same-Origin Policy.** The browser rule that stops one origin from reading another origin’s data.

**CORS.** Cross-Origin Resource Sharing: headers that let a server relax the same-origin policy for reads. It is not a CSRF defence.

**SameSite.** A cookie attribute that controls sending on cross-site requests: Strict, Lax or None. Chrome treats unset as Lax.

**HttpOnly.** A cookie attribute that hides the cookie from page JavaScript. Browser extensions and malware can still read it.

**Secure flag.** A cookie attribute that limits sending to HTTPS.

**Session fixation.** Forcing a known session ID on a victim before they log in. Prevented by rotating the ID at login.

**Session rotation.** Replacing the session ID at login or privilege change, and invalidating the old one.

**CSRF.** Cross-Site Request Forgery: another site causes your browser to send an authenticated request you did not intend.

**CSRF token.** A secret per-session value required on writes. A foreign page cannot read it, so it cannot forge the request.

**Clickjacking.** Hiding a real page in a transparent frame so that clicks land somewhere other than where the user thinks. Also called UI redressing.

**X-Frame-Options.** A response header that controls framing (DENY or SAMEORIGIN).

**CSP.** Content Security Policy: a response header that limits where scripts and other resources can load from, and who may frame the page.

**frame-ancestors.** The CSP directive naming which parents may embed a page.

**XSS.** Cross-Site Scripting: attacker-controlled script running inside a site’s origin. Comes in stored, reflected and DOM-based forms.

**Output encoding.** Converting characters so that the browser treats them as text in a given context.

**SQL Injection.** User input changing the structure of a SQL query.

**Parameterized query.** A query compiled with placeholders, with values bound separately, so input can never become SQL.

**IDOR.** Insecure Direct Object Reference: changing an identifier reaches someone else’s data because ownership is not checked.

**Mass assignment.** A server binding every request field to a record, letting clients set fields like role.

**Authentication.** Proving who you are.

**Authorization.** Deciding what you are allowed to do.

**Hashing and salting.** A one-way transform of a password, with a unique random salt per user to defeat rainbow tables.

**Account enumeration.** Learning which accounts exist from differences in application responses.

**DevTools.** Browser developer tools (F12), used here for network traffic, cookies, the DOM and the console.

**Cookie-Editor.** A browser extension that can read and write cookies, including HttpOnly ones, through a privileged browser API.

**HAR file.** HTTP Archive: a saved browser network trace in JSON. It can contain live cookies.

**SAST / DAST.** Static testing analyses source code. Dynamic testing probes the running application.

**OWASP Top 10.** A widely used awareness list of the most critical web application risks.

**Chain of custody.** The documented record of who handled evidence, and when.

**Forensic readiness.** Preparing logging and procedures in advance so that incidents can be investigated.
