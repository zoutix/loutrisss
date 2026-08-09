"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const context = { window: {} };
context.window.window = context.window;
vm.runInNewContext(fs.readFileSync(path.join(root, "js", "data.js"), "utf8"), context);
const answers = context.window.Data.ANSWERS;
const rows = [];
for (const length of [4, 5, 6]) {
  for (const word of answers[length]) rows.push(`(${length}, '${word.replace(/'/g, "''")}', true)`);
}
const sql = [
  "-- Generated from js/data.js by scripts/generate-word-seed.js.",
  "insert into public.game_words(length, word, is_answer) values",
  rows.join(",\n"),
  "on conflict (length, word) do update set is_answer = excluded.is_answer;",
  ""
].join("\n");
fs.writeFileSync(path.join(root, "supabase", "seed.sql"), sql, "utf8");
console.log(`Generated ${rows.length} answer words in supabase/seed.sql`);
