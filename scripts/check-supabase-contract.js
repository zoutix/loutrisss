"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const schema = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const battlePass = fs.readFileSync(path.join(root, "js", "battlepass.js"), "utf8");
const required = [
  "battle_pass_seasons",
  "battle_pass_rewards",
  "battle_pass_progress",
  "battle_pass_claims",
  "battle_pass_xp_events",
  "claim_battle_pass_reward",
  "award_battle_pass_xp_internal(p_user_id uuid, p_source text, p_action_id uuid)"
];
const missing = required.filter((name) => !schema.includes(name));
if (missing.length) {
  console.error(`Missing Supabase contract objects: ${missing.join(", ")}`);
  process.exit(1);
}
if (/Supabase\.client\s*\(|Supabase\.client\s*\./.test(battlePass)) {
  console.error("Battle Pass uses the removed Supabase.client API");
  process.exit(1);
}
console.log("Supabase contract checks OK");
