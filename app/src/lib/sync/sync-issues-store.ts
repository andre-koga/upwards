import { db, now, newId } from "@/lib/db";
import type { SyncIssue, SyncIssueKind, SyncIssueStatus } from "@/lib/db/types";

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export interface RecordSyncIssueInput {
  kind: SyncIssueKind;
  status?: SyncIssueStatus;
  account_id?: string | null;
  title: string;
  detail?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  operation_id?: string | null;
  payload?: unknown;
}

export async function recordSyncIssue(
  input: RecordSyncIssueInput
): Promise<SyncIssue> {
  const ts = now();
  const detail = input.detail ?? null;

  if (input.kind === "error") {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    const recentOpen = await db.syncIssues
      .where("status")
      .equals("open")
      .filter(
        (issue) =>
          issue.kind === "error" &&
          issue.title === input.title &&
          issue.detail === detail &&
          new Date(issue.created_at).getTime() >= cutoff
      )
      .first();

    if (recentOpen) {
      await db.syncIssues.update(recentOpen.id, { updated_at: ts });
      return { ...recentOpen, updated_at: ts };
    }
  }

  const row: SyncIssue = {
    id: newId(),
    kind: input.kind,
    status: input.status ?? "open",
    account_id: input.account_id ?? null,
    title: input.title,
    detail,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    operation_id: input.operation_id ?? null,
    payload: input.payload ?? null,
    created_at: ts,
    updated_at: ts,
    resolved_at: null,
  };
  await db.syncIssues.add(row);
  return row;
}

export interface ListSyncIssuesOptions {
  kind?: SyncIssueKind;
  status?: SyncIssueStatus;
  limit?: number;
}

export async function listSyncIssues(
  options?: ListSyncIssuesOptions
): Promise<SyncIssue[]> {
  let rows: SyncIssue[];

  if (options?.status) {
    rows = await db.syncIssues.where("status").equals(options.status).toArray();
  } else if (options?.kind) {
    rows = await db.syncIssues.where("kind").equals(options.kind).toArray();
  } else {
    rows = await db.syncIssues.toArray();
  }

  if (options?.kind && options?.status) {
    rows = rows.filter(
      (issue) => issue.kind === options.kind && issue.status === options.status
    );
  }

  rows.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  if (options?.limit != null) {
    return rows.slice(0, options.limit);
  }
  return rows;
}

export async function countOpenSyncIssues(): Promise<number> {
  return db.syncIssues.where("status").equals("open").count();
}

export async function resolveSyncIssue(id: string): Promise<void> {
  const ts = now();
  await db.syncIssues.update(id, {
    status: "resolved",
    resolved_at: ts,
    updated_at: ts,
  });
}

export async function deferSyncIssue(id: string): Promise<void> {
  await db.syncIssues.update(id, {
    status: "deferred",
    updated_at: now(),
  });
}
