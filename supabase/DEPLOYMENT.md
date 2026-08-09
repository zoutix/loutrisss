# Loutris Supabase deployment

## Order

1. Run `schema.sql` once on the project.
2. Run `production_hardening_final.sql` once.
3. Do **not** run `production_hardening.sql` or `production_hardening_v2.sql`; those are superseded drafts.
4. Populate `game_words` with the canonical 4/5/6-letter answer and guess pools before enabling Ranked.
5. Populate `shop_catalog` from the exact canonical shop data before enabling server-side cosmetic purchases.
6. Keep only the Supabase publishable/anon key in the browser. Never put a service-role key in the repository or frontend.

## Ranked launch gate

Ranked must remain disabled until these checks pass against the deployed database:

- Two simultaneous guesses on the same match cannot both advance the turn.
- Two simultaneous settlements cannot award ELO twice.
- A player cannot have two active ranked matches.
- A busy opponent cannot be placed into another ranked match.
- Casual matches do not consume the ranked active-match slot.
- The answer is never returned by `get_match_state`.
- Invalid words are rejected by the server.
- Replaying the same `action_id` is idempotent.
- A stale match cannot remain active forever.

## Optional stale-match scheduler

If Supabase Cron (`pg_cron`) is enabled, schedule periodic cleanup as defense-in-depth. The application/database functions already expire stale ranked matches when a player starts or reads a match.

## Security model

The browser is untrusted. Ranked ELO, match answers, match results, battle-pass XP, and inventory mutations are server-owned. RLS and grants are defense in depth; SECURITY DEFINER functions use an explicit `search_path`, and browser roles receive explicit EXECUTE grants only for approved RPCs.
