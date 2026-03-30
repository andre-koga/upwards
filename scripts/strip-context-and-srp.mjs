#!/usr/bin/env node
/**
 * Deletes all CONTEXT.md / context.md files under the repo root and strips
 * a leading block comment from source files when that block contains "SRP:".
 *
 * Usage (from repo root):
 *   node scripts/strip-context-and-srp.mjs
 *   node scripts/strip-context-and-srp.mjs /path/to/okhabit
 *
 * Skips: node_modules, .git, dist, build, coverage, .next
 * Strips from: .ts, .tsx, .mts, .cts, .js, .jsx, .mjs, .cjs, .css
 *
 * After running: update AGENTS.md if it still mentions CONTEXT.md; run
 * `cd app && pnpm run lint && pnpm run ts && pnpm run format`.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || ".");

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
]);

const STRIP_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
]);

/**
 * @param {string} content
 * @returns {string}
 */
function stripLeadingSrpBlock(content) {
  const withoutBom = content.replace(/^\uFEFF/, "");
  if (!withoutBom.startsWith("/**")) {
    return content;
  }
  const close = withoutBom.indexOf("*/");
  if (close === -1) {
    return content;
  }
  const block = withoutBom.slice(0, close + 2);
  if (!/\bSRP\s*:/.test(block)) {
    return content;
  }
  const rest = withoutBom.slice(close + 2).replace(/^(?:\r?\n)+/, "");
  const prefix = content.startsWith("\uFEFF") ? "\uFEFF" : "";
  return prefix + rest;
}

/**
 * @param {string} dir
 * @param {(filePath: string) => void} onFile
 */
function walkFiles(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(ent.name)) {
        walkFiles(full, onFile);
      }
    } else if (ent.isFile()) {
      onFile(full);
    }
  }
}

let deleted = 0;
let stripped = 0;

walkFiles(ROOT, (filePath) => {
  const base = path.basename(filePath);
  if (base === "CONTEXT.md" || base === "context.md") {
    fs.unlinkSync(filePath);
    deleted += 1;
    console.log("deleted", path.relative(ROOT, filePath));
    return;
  }

  const ext = path.extname(filePath);
  if (!STRIP_EXTENSIONS.has(ext)) {
    return;
  }

  const text = fs.readFileSync(filePath, "utf8");
  const next = stripLeadingSrpBlock(text);
  if (next !== text) {
    fs.writeFileSync(filePath, next, "utf8");
    stripped += 1;
    console.log("stripped SRP header", path.relative(ROOT, filePath));
  }
});

console.log(`Done. Removed ${deleted} CONTEXT file(s); stripped ${stripped} file(s).`);
