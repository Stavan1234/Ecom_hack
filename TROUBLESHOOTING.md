# Troubleshooting

## `node:sqlite` is not available / `Cannot find module 'node:sqlite'`

The app uses Node's built-in SQLite, which is stable in **Node 24**.

- Check your version: `node -v`. Install Node 24 if you are below it.
- On Node 22.5–23 you can run it with the flag, e.g. `node --experimental-sqlite scripts/start.js`.
- On Vercel, set the project's Node.js version to **24.x** in Settings → General.

## A port is already in use (`EADDRINUSE`)

The app uses `4000` (storefront) and `4001` (attacker site).

Windows (PowerShell) — find and stop whatever holds the port:

```powershell
Get-NetTCPConnection -LocalPort 4000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

macOS / Linux:

```bash
lsof -ti tcp:4000 | xargs kill
```

Or run on different ports:

```bash
LAB_PORT=5000 LAB_ATTACKER_PORT=5001 npm start
```

(Windows PowerShell: `$env:LAB_PORT=5000; $env:LAB_ATTACKER_PORT=5001; npm start`.)

## The page says "Front end has not been built yet"

Run `npm start` (it builds automatically), or build once with `npm run build`. The server serves the built SPA from `dist/`.

## Cookie replay (Lab 1) doesn't work in the second browser

- Use **`127.0.0.1:4000`** in both browsers, not `localhost`. A cookie set for `127.0.0.1` is not sent to `localhost`.
- Make sure you are in **vulnerable** mode for the first run-through.
- Import the **`lab_session`** cookie specifically (the `lab_prefs` cookie is a decoy that authenticates nothing).
- After importing, **refresh** Browser B.
- If Cookie-Editor's full import is refused, add a single cookie by hand: name `lab_session`, value from Browser A, path `/`.

## CSRF (Lab 2): the cross-site variant doesn't send the cookie

That is the expected modern-browser behaviour, and a finding to record. From `localhost:4001` (cross-site), `SameSite=Lax` withholds the cookie on cross-site POSTs. Use `127.0.0.1:4001` (same-site) to show the attack succeeding in vulnerable mode, and compare. Chrome also applies a brief "Lax+POST" window just after a cookie is set — note what you actually observe.

## Clickjacking (Lab 3): the frame is empty

- In **secure** mode this is correct — framing is blocked. Check the Console for the refusal and the response headers for `X-Frame-Options` / `frame-ancestors`.
- In **vulnerable** mode, make sure you opened the attacker page at `127.0.0.1:4001/clickjack` and are signed in on the shop in the same browser.

## SQL injection (Lab 4): the payload is treated as text

You are likely in **secure** mode. Switch to vulnerable mode in the Security Lab and sign out before retrying the login bypass.

## I'm signed out / my cookie stopped working

Switching modes, resetting the lab, clearing sessions, logout (secure mode), rotation, and expiry all invalidate sessions by design. Sign in again.

## Reset everything

- **Security Lab → Reset lab**, or
- `npm run reset` from a terminal (stops nothing; run it while the server is stopped or restart afterwards).

To wipe the database entirely, stop the server and delete `data/lab.db`; it is recreated and seeded on next start.

## Styling looks unstyled / fonts missing

Rebuild the front end: `npm run build`, then restart. Fonts are bundled locally (no external requests), so being offline is fine.

## Vercel deployment shows the vulnerable features

It should not — any Vercel deployment is force-locked to secure mode, with the lab controls and registration disabled. If you need the vulnerable laboratories, run the project locally. That is the intended, examination-ready environment.
