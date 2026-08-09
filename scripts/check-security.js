"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const files = [
  path.join(root, "js", "supabase.js"),
  path.join(root, "js", "screens", "match.js"),
  path.join(root, "supabase", "schema.sql"),
  path.join(root, "supabase", "production_hardening_final.sql"),
  path.join(root, "supabase", "post_merge_hotfix.sql")
];
const text = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const forbidden = [
  { pattern: /\.from\(["']matches["']\)\s*\n?\s*\.insert/, message: "Client match inserts are forbidden" },
  { pattern: /upsert\(row,\s*\{\s*onConflict:\s*["']id/, message: "Whole-profile upserts are forbidden" },
  { pattern: /create policy [^\n]+matches[^\n]*\n[\s\S]{0,100}with check \(true\)/i, message: "Permissive match policy is forbidden" },
  { pattern: /service_role|SUPABASE_SERVICE_ROLE|private_key/i, message: "Server secret marker found in audited files" }
];
for (const check of forbidden) {
  if (check.pattern.test(text)) {
    console.error(check.message);
    process.exit(1);
  }
}

const migration = fs.readFileSync(path.join(root, "supabase", "production_hardening_final.sql"), "utf8");
const hotfix = fs.readFileSync(path.join(root, "supabase", "post_merge_hotfix.sql"), "utf8");
const required = [
  "create unique index one_active_ranked_match_per_player",
  "create or replace function public.settle_ranked_match",
  "perform 1 from public.profiles where id in(least(v_a,v_b),greatest(v_a,v_b)) order by id for update",
  "create or replace function public.submit_match_guess",
  "create or replace function public.forfeit_match",
  "create or replace function public.get_match_state",
  "create or replace function public.purchase_cosmetic"
];
const missing = required.filter((name) => !migration.includes(name));
if (missing.length) {
  console.error(`Missing final hardening contract: ${missing.join(", ")}`);
  process.exit(1);
}
if (/where\s+match_id\s+in\s*\(\s*select\s+id\s+from\s+public\.match_sessions/i.test(migration)) {
  console.error("Hardening migration contains a non-immutable partial-index predicate");
  process.exit(1);
}
const lock = hotfix.indexOf("order by id\n   for update");
const settlementCheck = hotfix.indexOf("exists(select 1 from public.match_settlements", lock);
if (lock < 0 || settlementCheck < lock) {
  console.error("Settlement idempotency check must occur after the deterministic profile lock");
  process.exit(1);
}
if (!/perform 1 from public\.profiles where id=v_user for update/.test(hotfix)) {
  console.error("Cosmetic purchase must lock the profile before reading ownership/balance");
  process.exit(1);
}
if (!/create or replace function public\.start_ranked_match\(p_opponent uuid,p_length smallint default 5\)/.test(hotfix)) {
  console.error("Post-merge hotfix must override ranked creation to settle stale matches");
  process.exit(1);
}
if (!/perform public\.settle_ranked_match\(v_expired_id,null,'draw'\)/.test(hotfix)) {
  console.error("Stale ranked matches must use the canonical settlement path");
  process.exit(1);
}
if (!/grant execute on function public\.start_ranked_match\(uuid,smallint\) to authenticated/.test(hotfix)) {
  console.error("Ranked creation RPC must remain authenticated-only after the hotfix override");
  process.exit(1);
}
console.log("Security source checks OK");
