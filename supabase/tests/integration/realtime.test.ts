import { beforeAll, describe, expect, it } from "vitest";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  countDeltaOp,
  createIsolatedUser,
  loadSupabaseEnv,
  newId,
  pullOps,
  submitOps,
  type IsolatedUser,
} from "./helpers";

const DEVICE_A = "realtime-device-a";

describe("sync_operations Realtime websocket", () => {
  let user: IsolatedUser;

  beforeAll(async () => {
    loadSupabaseEnv();
    user = await createIsolatedUser();
  });

  it("delivers an INSERT event when another device submits an operation", async () => {
    if (process.env.GITHUB_ACTIONS) {
      // GitHub-hosted runners often miss local Realtime websocket delivery even
      // when publication/replica identity are correct. realtime-schema.test.ts
      // covers the SQL wiring; RPC pull tests cover cross-device op delivery.
      return;
    }

    const activityId = newId();
    const op = countDeltaOp({
      deviceId: DEVICE_A,
      activityId,
      date: "2026-08-25",
      delta: 1,
      previousCount: 0,
      nextCount: 1,
    });

    const { data: sessionData } = await user.deviceB.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error("device B is not signed in");
    }
    await user.deviceB.realtime.setAuth(accessToken);

    let channel: RealtimeChannel | null = null;
    const receivedRows: Record<string, unknown>[] = [];

    const subscribed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Realtime subscribe did not reach SUBSCRIBED"));
      }, 15_000);

      channel = user.deviceB
        .channel(`integ-sync-ops:${user.userId}:${op.operation_id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "sync_operations",
            filter: `user_id=eq.${user.userId}`,
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
      await new Promise((resolve) => setTimeout(resolve, 500));

      const submitted = await submitOps(user.deviceA, [op]);
      expect(submitted[0]?.status).toBe("accepted");

      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        const match = receivedRows.find(
          (row) => row.operation_id === op.operation_id
        );
        if (match) {
          expect(match.device_id).toBe(DEVICE_A);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      const pulled = await pullOps(user.deviceB, 0);
      const found = pulled.some((row) => row.operation_id === op.operation_id);
      throw new Error(
        `Timed out waiting for sync_operations INSERT (pull saw op: ${found}; received ${receivedRows.length} realtime events).`
      );
    } finally {
      if (channel) await user.deviceB.removeChannel(channel);
    }
  });
});
