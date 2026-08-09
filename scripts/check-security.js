"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const files = [
  path.join(root, "js", "supabase.js"),
  path.join(root, "js", "screens", "match.js"),
  path.join(root, "supabase", "schema.sql")
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
console.log("Security source checks OK");
