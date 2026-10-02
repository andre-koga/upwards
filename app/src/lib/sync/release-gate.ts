import { db, now } from "@/lib/db";

export const CLIENT_OUTDATED = "client_outdated";

/**
 * The server turned this build away. Thrown before any pending op is touched:
 * marking ops failed here would burn their retry attempts on a rejection that
 * says nothing about the ops themselves.
 */
export class ClientOutdatedError extends Error {
  constructor(detail?: string) {
    super(detail ? `${CLIENT_OUTDATED}: ${detail}` : CLIENT_OUTDATED);
    this.name = "ClientOutdatedError";
  }
}

/** Matches the thrown error, a raw RPC error, or a stored `last_error` string. */
export function isClientOutdatedError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof ClientOutdatedError) return true;
  if (typeof error === "string") return error.includes(CLIENT_OUTDATED);
  if (typeof error !== "object") return false;
  const { message, details } = error as { message?: unknown; details?: unknown };
  return [message, details].some(
    (part) => typeof part === "string" && part.includes(CLIENT_OUTDATED)
  );
}

export function throwIfClientOutdated(
  error: { message?: string; details?: string } | null
): void {
  if (error && isClientOutdatedError(error)) {
    throw new ClientOutdatedError(error.details);
  }
}

export function readDataEpoch(value: unknown): number | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = (value as { data_epoch?: unknown }).data_epoch;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : undefined;
}

let observedDataEpoch: number | undefined;

/** Highest data epoch any sync RPC has reported since this page loaded. */
export function getObservedDataEpoch(): number | undefined {
  return observedDataEpoch;
}

export function recordObservedDataEpoch(epoch: number | undefined): void {
  if (epoch == null) return;
  if (observedDataEpoch == null || epoch > observedDataEpoch) {
    observedDataEpoch = epoch;
  }
}

export function resetObservedDataEpochForTests(): void {
  observedDataEpoch = undefined;
}

/**
 * Moves ops an older build marked failed with `client_outdated` back to pending.
 *
 * Builds before the gate cannot tell this rejection apart from a bad op, so they
 * mark every op failed and count the attempt; enough sync ticks past the minimum
 * would strand them beyond the retry ceiling. The rejection was about the build,
 * so the attempts are reset too.
 */
export async function requeueClientOutdatedOperations(): Promise<number> {
  const failed = await db.syncPendingOperations
    .where("status")
    .equals("failed")
    .toArray();
  const stranded = failed.filter((row) => isClientOutdatedError(row.last_error));
  if (stranded.length === 0) return 0;
  const ts = now();
  await Promise.all(
    stranded.map((row) =>
      db.syncPendingOperations.update(row.id, {
        status: "pending",
        attempt_count: 0,
        last_error: null,
        updated_at: ts,
      })
    )
  );
  return stranded.length;
}
