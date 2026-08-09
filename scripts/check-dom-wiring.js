"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
const selectors = [...app.matchAll(/on\(["']#([^"']+)["']/g)].map((match) => match[1]);
const missing = [...new Set(selectors)].filter((id) => !ids.has(id));
if (missing.length) {
  console.error(`Missing production DOM IDs: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`DOM wiring OK: ${new Set(selectors).size} selectors`);
