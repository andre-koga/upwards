const LAST_SERVER_SYNC_KEY = "okhabit_last_server_sync_at";
const LAST_APPLIED_SEQUENCE_KEY = "okhabit_last_applied_sync_sequence";
const LAST_USER_KEY = "okhabit_last_signed_in_user_id";
const OPS_RPC_AVAILABLE_KEY = "okhabit_ops_rpc_available";
/**
 * Do not bump this key to force a re-bootstrap. It was briefly renamed to
 * `okhabit_sync_protocol_v3_snapshot_repair` to heal local journal tombstones,
 * on the assumption that re-running the bootstrap was idempotent. It is not:
 * the bootstrap ends in applySyncSnapshot, which used to hard-delete every
 * local row absent from the server snapshot. Renaming the key made every
 * already-migrated device replay that deletion.
 *
 * Heal local state from the server instead of re-running the cutover.
 */
const PROTOCOL_V2_KEY = "okhabit_sync_protocol_v2";

/**
 * The server-side `now()` timestamp captured at the start of the last
 * successful pull. Using server time (not client time) as the delta-pull
 * cutoff eliminates device clock skew entirely.
 */
export function loadLastServerSyncAt(): string | null {
  return localStorage.getItem(LAST_SERVER_SYNC_KEY) ?? null;
}

export function saveLastServerSyncAt(ts: string): void {
  localStorage.setItem(LAST_SERVER_SYNC_KEY, ts);
}

export function clearLastServerSyncAt(): void {
  localStorage.removeItem(LAST_SERVER_SYNC_KEY);
  clearLastAppliedSequence();
}

/** Last server_sequence applied from pull_sync_operations (default 0). */
export function loadLastAppliedSequence(): number {
  const raw = localStorage.getItem(LAST_APPLIED_SEQUENCE_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function saveLastAppliedSequence(sequence: number): void {
  if (!Number.isFinite(sequence) || sequence < 0) return;
  localStorage.setItem(LAST_APPLIED_SEQUENCE_KEY, String(Math.floor(sequence)));
}

/** Never skip unpulled ops: the cursor may only move forward from a pull. */
export function advanceLastAppliedSequence(sequence: number): void {
  const current = loadLastAppliedSequence();
  if (sequence > current) saveLastAppliedSequence(sequence);
}

export function clearLastAppliedSequence(): void {
  localStorage.removeItem(LAST_APPLIED_SEQUENCE_KEY);
}

/** Whether temporal ops RPCs are known to exist on this project. */
export function loadOpsRpcAvailable(): boolean {
  return localStorage.getItem(OPS_RPC_AVAILABLE_KEY) === "1";
}

export function saveOpsRpcAvailable(available: boolean): void {
  localStorage.setItem(OPS_RPC_AVAILABLE_KEY, available ? "1" : "0");
}

export function clearOpsRpcAvailable(): void {
  localStorage.removeItem(OPS_RPC_AVAILABLE_KEY);
}

export function loadSyncProtocolV2(): boolean {
  return localStorage.getItem(PROTOCOL_V2_KEY) === "1";
}

export function saveSyncProtocolV2(): void {
  localStorage.setItem(PROTOCOL_V2_KEY, "1");
}

export function clearSyncProtocolV2(): void {
  localStorage.removeItem(PROTOCOL_V2_KEY);
}

export function loadLastSignedInUserId(): string | null {
  return localStorage.getItem(LAST_USER_KEY) ?? null;
}

export function saveLastSignedInUserId(userId: string): void {
  localStorage.setItem(LAST_USER_KEY, userId);
}

export function clearLastSignedInUserId(): void {
  localStorage.removeItem(LAST_USER_KEY);
}
