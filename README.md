# SpeedDex Admin Console

React + TypeScript (Vite) web console for moderators and admins. It uses the SpeedDex API's
`/v1/admin/*` endpoints; there is no separate backend.

| Page | Who | What |
|---|---|---|
| Dashboard | moderators, admins | Players, cards, scans per day, scan outcomes, why scans weren't identified, cards by rarity, which AI model answered |
| Review queue | moderators, admins | Low-confidence, unmatched and reported scans: approve, choose another vehicle from the catalogue, or reject |
| Captures | moderators, admins | Every scan with filters; scan details; reject a scan or clear its flags |
| Reports | moderators, admins | Community reports: hide a post or comment, mark handled, dismiss |
| Users | moderators (read-only, no emails), admins | Search, profile, recent scans, coin ledger; admins suspend / ban / reinstate, change roles, adjust coins |
| Catalogue | moderators (read-only), admins | Brands, models, variants and the other names recognition may use; add, edit, deactivate; reference photos (front, left side, right side, rear) per variant |
| Add a car with AI | admins | Name a car; the AI researches brand, model and every generation with sources; you edit, then approve (added to the catalogue) or reject |
| Store | admins | Coin bundles and garage-slot offers; purchases (read-only) |
| Audit log | admins | Every admin change with who, why, and before/after values |

Every change asks for a reason, which goes to the audit log. The server checks roles on
every request; the console only hides what a role can't use.

## Run locally

```bash
# API on http://localhost:8080 (see ../Backend/README.md), then:
npm install
npm run dev                 # http://localhost:5173/admin/  (forwards /v1 to localhost:8080)
npm run dev:live            # same, but against the deployed API on Vercel
```

Open `http://localhost:5173/admin/`; the root `/` is empty. To use another API, set the
`API_PROXY` environment variable before `npm run dev`. It is not an argument to `npm run dev`:

```powershell
$env:API_PROXY = "http://localhost:8081"; npm run dev    # PowerShell
```
```bash
API_PROXY=http://localhost:8081 npm run dev              # Git Bash
```

Sign in with an account that has the `moderator` or `admin` role. Make the first admin with
`cd ../Backend && npm run set-role -- you@example.com admin`.

## Build and deploy

```bash
npm test && npm run build   # writes ../Backend/public/admin
```

Commit `Backend/public/admin` with the backend. The API's Vercel deployment serves it at
`https://<api-domain>/admin` with a strict Content-Security-Policy (see `Backend/vercel.json`).

## Security

- Same origin as the API: no CORS, and tokens are never sent to another host.
- The access token (15 min) stays in memory. The refresh token is in `sessionStorage`, so a
  reload keeps you signed in and closing the tab signs you out. Refreshes are serialised,
  because refresh tokens rotate and reusing one ends the session.
- Fonts are bundled (no third-party requests). Photos are loaded through signed, expiring
  `/v1/media` URLs on the same origin.
- Not built yet: multi-factor sign-in for staff.
