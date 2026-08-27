#!/usr/bin/env node
/**
 * Diff a device's exported backup against the server, before the local database
 * is deleted.
 *
 * The online-only rewrite removes IndexedDB. Anything that only ever existed on
 * one device is gone at that point, and the sync layer cannot tell you what that
 * is: an operation the server rejected is marked `failed`, not `pending`, so the
 * pending count reads zero while the row sits unsynced.
 *
 * Read-only. Reports differences and exits; it never writes to either side.
 *
 * Usage:
 *   node scripts/diff-backup-against-server.mjs <backup.json> \
 *     --url https://<ref>.supabase.co --key <service_role_or_user_jwt>
 *
 * Env fallbacks: SUPABASE_URL, SUPABASE_KEY.
 */

import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const backupPath = args.find((a) => !a.startsWith("--") && a !== flag("url") && a !== flag("key"));
const url = (flag("url") ?? process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const key = flag("key") ?? process.env.SUPABASE_KEY;

if (!backupPath || !url || !key) {
  console.error(
    "usage: node scripts/diff-backup-against-server.mjs <backup.json> --url <supabase-url> --key <key>"
  );
  process.exit(2);
}

/** Dexie table -> Postgres table. Only tables the export actually covers. */
const TABLES = {
  activityGroups: "activity_groups",
  activities: "activities",
  dailyEntries: "daily_entries",
  activityPeriods: "activity_periods",
  journalEntries: "journal_entries",
  oneTimeTasks: "one_time_tasks",
  recurringMemos: "recurring_memos",
  activityStatusEvents: "activity_status_events",
  groupStatusEvents: "group_status_events",
};

async function fetchAll(table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    if (!res.ok) {
      throw new Error(`GET ${table} failed: ${res.status} ${await res.text()}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

const backup = JSON.parse(await readFile(backupPath, "utf8"));
if (!backup.version) throw new Error("not a recognised backup file");
if (backup.version < 3) {
  console.warn(
    `note: backup version ${backup.version} predates recurringMemos export; ` +
      "that table cannot be checked from this file.\n"
  );
}

console.log(`backup:  ${backupPath} (exported ${backup.exportedAt})`);
console.log(`server:  ${url}\n`);

let localOnlyTotal = 0;
let contentDiffTotal = 0;

for (const [dexieKey, pgTable] of Object.entries(TABLES)) {
  const local = backup[dexieKey];
  if (!Array.isArray(local)) {
    console.log(`${pgTable.padEnd(24)} not in backup, skipped`);
    continue;
  }

  const remote = await fetchAll(pgTable);
  const remoteById = new Map(remote.map((r) => [r.id, r]));

  // Soft-deleted local rows are not "missing" data worth rescuing.
  const localLive = local.filter((r) => !r.deleted_at);
  const localOnly = localLive.filter((r) => !remoteById.has(r.id));

  localOnlyTotal += localOnly.length;
  console.log(
    `${pgTable.padEnd(24)} local ${String(localLive.length).padStart(5)}  ` +
      `server ${String(remote.length).padStart(5)}  ` +
      `local-only ${String(localOnly.length).padStart(4)}`
  );

  if (localOnly.length > 0) {
    const label = (r) => r.date ?? r.entry_date ?? r.name ?? r.id;
    const shown = localOnly.slice(0, 10).map(label);
    console.log(
      `${" ".repeat(26)}-> ${shown.join(", ")}` +
        (localOnly.length > 10 ? ` … +${localOnly.length - 10} more` : "")
    );
  }
}

// task_counts is the one field where a silent divergence loses real history:
// untimed completions have no row of their own, they ARE the count.
console.log("\ndaily_entries.task_counts divergence (by date):");
const localEntries = (backup.dailyEntries ?? []).filter((r) => !r.deleted_at);
const remoteEntries = await fetchAll("daily_entries");
const remoteByDate = new Map(remoteEntries.map((r) => [r.date, r]));

const countsOf = (row) =>
  Object.entries(row?.task_counts ?? {})
    .filter(([, n]) => Number(n) > 0)
    .sort(([a], [b]) => a.localeCompare(b));

for (const localRow of localEntries.sort((a, b) => a.date.localeCompare(b.date))) {
  const remoteRow = remoteByDate.get(localRow.date);
  const localCounts = countsOf(localRow);
  const remoteCounts = countsOf(remoteRow);
  if (localCounts.length === 0) continue;

  const fmt = (pairs) => pairs.map(([k, v]) => `${k.slice(0, 8)}=${v}`).join(" ");
  if (JSON.stringify(localCounts) !== JSON.stringify(remoteCounts)) {
    contentDiffTotal += 1;
    console.log(
      `  ${localRow.date}  local[ ${fmt(localCounts)} ]  server[ ${fmt(remoteCounts)} ]` +
        (remoteRow ? "" : "  (no server row)")
    );
  }
}
if (contentDiffTotal === 0) console.log("  none");

console.log(
  `\n${localOnlyTotal} local-only row(s), ${contentDiffTotal} date(s) with count divergence.`
);
console.log(
  localOnlyTotal === 0 && contentDiffTotal === 0
    ? "This device holds nothing the server lacks. Safe to drop its local database."
    : "Rescue the rows above before deleting this device's local database."
);
