"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : full.endsWith(".js") ? [full] : [];
  });
}

const files = walk(path.join(__dirname, "..", "js"));
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Syntax error: ${file}\n`);
    process.exit(result.status || 1);
  }
}
console.log(`Syntax OK: ${files.length} JavaScript files`);
