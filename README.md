# Loutris

Loutris is a browser-based word game with offline solo play and an optional Supabase account/cloud layer.

## Current trust model

- Solo practice, bot matches, UI settings, and local cosmetic previews run offline in the browser.
- The browser is untrusted. It must not author ranked results, ELO, currency, inventory, daily completion, or reward claims.
- Ranked play is intentionally disabled in the client until the deployed Supabase match-session RPCs are connected end to end. Do not re-enable it by passing a client-supplied match ID.
- Same-browser `BroadcastChannel` play is casual/demo transport only. It is not an authenticated competitive protocol.

## Local development

Serve the repository over HTTP; do not use `file://` for authentication or cloud testing.

```powershell
python -m http.server 8080
```

Open `http://127.0.0.1:8080/`.

## Checks

Node.js 20+ is recommended.

```powershell
npm run check
```

The checks cover JavaScript syntax, security-sensitive source patterns, production DOM wiring, game rules, local-store validation, and cloud-snapshot merging.

The Supabase CLI is not bundled. Database migrations and RLS/concurrency tests must be run against a disposable or local Supabase project when the CLI is available:

```powershell
supabase db reset
supabase test db
```

If those commands are unavailable, report the database checks as unrun rather than treating the browser tests as proof of server security.

## Supabase deployment

1. Apply `supabase/schema.sql` to a disposable project first.
2. Seed `public.game_words` from the normalized word data before enabling ranked matchmaking.
3. Verify anonymous and authenticated direct writes to authoritative tables are rejected.
4. Verify `start_ranked_match`, `get_match_state`, `submit_match_guess`, and `forfeit_match` under concurrent requests.
5. Configure hosting security headers: CSP, HSTS, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, and frame protection.
6. Pin and integrity-check the Supabase browser dependency before production deployment.

The publishable Supabase key may be exposed in browser code, but only with RLS and server-owned RPCs configured correctly. Never place a service-role key or private credential in this repository.
