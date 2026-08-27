import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const ALLOWED_SYNCED_WRITERS = new Set([
  "lib/sync/mutate-synced.ts",
  "lib/sync/projection-sync.ts",
  "lib/sync/sync-operations.ts",
  "lib/sync/identity-repair.ts",
  "lib/sync/snapshot-sync.ts",
  "lib/sync/clear-local-sync-data.ts",
  "lib/sync/journal-conflict-resolution.ts",
  "lib/sync/daily-entry-reconciliation.ts",
  "lib/db/daily-entry.ts",
  "lib/db/index.ts",
  "lib/journal/dedupe-by-date.ts",
  "lib/streak-utils.ts",
  "lib/activity/untimed-period.ts",
]);

const WRITE_RE =
  /\bdb\.(journalEntries|dailyEntries|activities|activityGroups|activityPeriods|oneTimeTasks|recurringMemos|activityStatusEvents|groupStatusEvents)\.(add|put|update|delete|bulkPut|bulkAdd|bulkDelete)\b/;

const FORBIDDEN_LWW_RE =
  /\b(runPushInternal|runPull|opsSyncActive)\b|from ["']\.\/sync-push["']|from ["']\.\/sync-pull["']/;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkTsFiles(full, out);
      continue;
    }
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
    out.push(full);
  }
  return out;
}

describe("sync protocol guardrails", () => {
  const files = walkTsFiles(srcRoot);

  it("only allowlisted modules write synced Dexie tables", () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(srcRoot, file).replaceAll("\\", "/");
      if (ALLOWED_SYNCED_WRITERS.has(rel)) continue;
      const source = readFileSync(file, "utf8");
      if (WRITE_RE.test(source)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not reintroduce LWW push/pull or opsSyncActive", () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(srcRoot, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      if (FORBIDDEN_LWW_RE.test(source)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not reintroduce untimed-period creation", () => {
    // The builders are gone: untimed completions live in
    // `daily_entries.task_counts`, not as zero-length `activity_periods`.
    // 19 fossil rows still exist in Postgres, so `isUntimedPeriod` stays for
    // reads -- but nothing may write a new one.
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(srcRoot, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      for (const banned of [
        "ensureUntimedCompletionPeriod",
        "buildUntimedPeriod",
        "adoptUntimedPeriodForSession",
        "naturalUntimedPeriodId",
      ]) {
        if (source.includes(`${banned}(`)) {
          violations.push(`${rel}: ${banned}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
