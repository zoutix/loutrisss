# Loutris Supabase deployment

## Order

1. Run `schema.sql` once on the project.
2. Run `production_hardening_v2.sql` once.
3. Do **not** run the draft `production_hardening.sql`; it is superseded by v2.
4. Populate `game_words` with the canonical 4/5/6-letter answer and guess pools before enabling Ranked.
5. Populate `shop_catalog` from the exact canonical shop data before enabling server-side cosmetic purchases.
6. Keep the publishable/anon key in the browser. Never put a Supabase service-role key in this repository or frontend.

## Ranked launch gate

Ranked must remain disabled until these checks pass against the deployed database:

- Two simultaneous guesses on the same match cannot both advance the turn.
- Two simultaneous settlements cannot award ELO twice.
- A player cannot have two active ranked matches.
- A busy opponent cannot be placed into another ranked match.
- The answer is never returned by `get_match_state`.
- Invalid words are rejected by the server.
- Replaying the same `action_id` is idempotent.
- A stale match cannot remain active forever.

## Optional stale-match scheduler

If Supabase Cron (`pg_cron`) is enabled, schedule a periodic cleanup function after adding one to the database. Cron is supported by Supabase and is appropriate for recurring database maintenance. The application also expires stale matches when state is read, so the scheduler is defense-in-depth.

## Security model

The browser is untrusted. Ranked ELO, match answers, match results, battle-pass XP, and inventory mutations are server-owned. RLS and grants are defense in depth; SECURITY DEFINER functions have an explicit `search_path` and explicit EXECUTE grants.
