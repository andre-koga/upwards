import { beforeAll, describe, expect, it } from "vitest";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  countDeltaOp,
  createIsolatedUser,
  loadSupabaseEnv,
  newId,
  submitOps,
  type IsolatedUser,
} from "./helpers";

const DEVICE_A = "realtime-device-a";

describe("sync_operations Realtime", () => {
  let user: IsolatedUser;

  beforeAll(async () => {
    loadSupabaseEnv();
    user = await createIsolatedUser();
  });

  it("delivers an INSERT event when another device submits an operation", async () => {
    const activityId = newId();
    const op = countDeltaOp({
      deviceId: DEVICE_A,
      activityId,
      date: "2026-08-25",
      delta: 1,
      previousCount: 0,
      nextCount: 1,
    });

    let channel: RealtimeChannel | null = null;
    const receivedRows: Record<string, unknown>[] = [];

    const subscribed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Realtime subscribe did not reach SUBSCRIBED"));
      }, 10_000);

      channel = user.deviceB
        .channel(`integ-sync-ops:${user.userId}:${op.operation_id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "sync_operations",
          },
          (payload) => {
            receivedRows.push((payload.new ?? {}) as Record<string, unknown>);
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(timeout);
            resolve();
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            clearTimeout(timeout);
            reject(new Error(`Realtime channel failed: ${status}`));
          }
        });
    });

    try {
      await subscribed;
      const submitted = await submitOps(user.deviceA, [op]);
      expect(submitted[0]?.status).toBe("accepted");

      const deadline = Date.now() + 12_000;
      while (Date.now() < deadline) {
        const match = receivedRows.find((row) => {
          const operationId = row.operation_id;
          const deviceId = row.device_id;
          const userId = row.user_id;
          if (operationId && operationId !== op.operation_id) return false;
          if (deviceId && deviceId !== DEVICE_A) return false;
          if (userId && userId !== user.userId) return false;
          return true;
        });
        if (match) {
          expect(match).toBeTruthy();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      throw new Error(
        "Timed out waiting for sync_operations INSERT. Confirm the table is in supabase_realtime and local Realtime is running."
      );
    } finally {
      if (channel) await user.deviceB.removeChannel(channel);
    }
  });
});
