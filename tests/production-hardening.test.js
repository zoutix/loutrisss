"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase", "production_hardening_final.sql"), "utf8");
const hotfix = fs.readFileSync(path.join(root, "supabase", "post_merge_hotfix.sql"), "utf8");
const settingsHardening = fs.readFileSync(path.join(root, "supabase", "profile_settings_hardening.sql"), "utf8");
const supabase = fs.readFileSync(path.join(root, "js", "supabase.js"), "utf8");
const match = fs.readFileSync(path.join(root, "js", "screens", "match.js"), "utf8");

function assertContains(text, pattern, message) {
  assert.match(text, pattern, message);
}

test("ranked settlement rechecks idempotency after locks", () => {
  const lock = hotfix.indexOf("order by id\n   for update");
  const check = hotfix.indexOf("exists(select 1 from public.match_settlements", lock);
  assert.ok(lock >= 0, "deterministic profile lock must exist");
  assert.ok(check > lock, "settlement check must happen after the profile lock");
});

test("stale ranked matches are settled through the canonical draw path", () => {
  assertContains(hotfix, /create or replace function public\.start_ranked_match\(p_opponent uuid,p_length smallint default 5\)/);
  const expiry = hotfix.indexOf("for v_expired_id in");
  const settle = hotfix.indexOf("perform public.settle_ranked_match(v_expired_id,null,'draw')", expiry);
  assert.ok(expiry >= 0, "ranked creation must scan stale matches");
  assert.ok(settle > expiry, "every stale match must pass through canonical settlement");
  assertContains(hotfix, /for update\s*\n  loop/);
  assertContains(hotfix, /m\.last_action_at<now\(\)-interval '5 minutes'/);
});

test("ranked active-match constraint is immutable and server-owned", () => {
  assertContains(migration, /create unique index one_active_ranked_match_per_player/);
  assertContains(migration, /where active=true and ranked=true/);
  assert.doesNotMatch(migration, /where\s+match_id\s+in\s*\(\s*select\s+id\s+from\s+public\.match_sessions/i);
});

test("authoritative match RPCs are exposed only through authenticated RPC calls", () => {
  assertContains(supabase, /startRankedMatch:\s*function/);
  assertContains(supabase, /getMatchState:\s*function/);
  assertContains(supabase, /submitMatchGuess:\s*function/);
  assertContains(supabase, /forfeitMatch:\s*function/);
  assertContains(migration, /grant execute on function public\.start_ranked_match\(uuid,smallint\) to authenticated/);
  assertContains(migration, /grant execute on function public\.submit_match_guess\(uuid,uuid,text\) to authenticated/);
  assertContains(migration, /grant execute on function public\.forfeit_match\(uuid,uuid\) to authenticated/);
});

test("ranked gameplay remains disabled until a real cloud match is wired", () => {
  assertContains(match, /if \(cfg\.ranked\) \{/);
  assertContains(match, /verified cloud match is ready/);
});

test("cosmetic purchases use a server-owned catalog and authenticated RPC", () => {
  assertContains(hotfix, /create or replace function public\.purchase_cosmetic\(p_item_id text\)/);
  assertContains(hotfix, /grant execute on function public\.purchase_cosmetic\(text\) to authenticated/);
  assertContains(migration, /create table if not exists public\.shop_catalog/);
  assertContains(migration, /currency text not null check\(currency in\('coins','gems'\)\)/);
});

test("profile settings are bounded and object-only", () => {
  assertContains(settingsHardening, /char_length\(v_display_name\) > 64/);
  assertContains(settingsHardening, /char_length\(v_avatar\) > 512/);
  assertContains(settingsHardening, /jsonb_typeof\(v_settings\) <> 'object'/);
  assertContains(settingsHardening, /octet_length\(v_settings::text\) > 16384/);
  assertContains(settingsHardening, /grant execute on function public\.save_profile_settings\(text, text, text, text, jsonb\) to authenticated/);
  assertContains(settingsHardening, /revoke execute on function public\.save_profile_settings\(text, text, text, text, jsonb\) from public/);
});
