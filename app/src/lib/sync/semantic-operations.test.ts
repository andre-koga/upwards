import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  newId: () => "op-1",
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-1",
}));
vi.mock("@/lib/supabase", () => ({
  getCachedUserId: () => "user-1",
}));

const enqueuePendingOperation = vi.fn(async () => ({}) as never);
vi.mock("@/lib/sync/pending-operations", () => ({
  enqueuePendingOperation: (...args: unknown[]) =>
    enqueuePendingOperation(...args),
}));

import { enqueueActivityCountDelta } from "./semantic-operations";

describe("enqueueActivityCountDelta", () => {
  beforeEach(() => {
    enqueuePendingOperation.mockClear();
  });

  it("drops a true no-op call (no count change, no completion time)", async () => {
    await enqueueActivityCountDelta({
      activityId: "act-1",
      date: "2026-09-04",
      previousCount: 1,
      nextCount: 1,
    });

    expect(enqueuePendingOperation).not.toHaveBeenCalled();
  });

  it("still enqueues a delta-0 call that only edits the completion instant", async () => {
    // This is the path Session Details uses to edit an untimed completion's
    // clock time without changing whether the activity is done for the day.
    await enqueueActivityCountDelta({
      activityId: "act-1",
      date: "2026-09-04",
      previousCount: 1,
      nextCount: 1,
      completionAt: "2026-09-04T12:00:00.000Z",
    });

    expect(enqueuePendingOperation).toHaveBeenCalledTimes(1);
    const payload = enqueuePendingOperation.mock.calls[0][0].payload;
    expect(payload.delta).toBe(0);
    expect(payload.completion_at).toBe("2026-09-04T12:00:00.000Z");
  });

  it("still enqueues a real count change", async () => {
    await enqueueActivityCountDelta({
      activityId: "act-1",
      date: "2026-09-04",
      previousCount: 0,
      nextCount: 1,
    });

    expect(enqueuePendingOperation).toHaveBeenCalledTimes(1);
  });
});
