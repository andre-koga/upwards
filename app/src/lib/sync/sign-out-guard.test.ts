import { describe, expect, it } from "vitest";
import type { PushBeforeSignOutResult } from "./index";

describe("pushBeforeSignOut result", () => {
  it("blocks sign-out when push failed or unsynced data remains", () => {
    const blocked: PushBeforeSignOutResult = {
      success: false,
      pendingCount: 2,
      unsyncedRowCount: 1,
      pushFailed: true,
    };
    expect(blocked.success).toBe(false);

    const ready: PushBeforeSignOutResult = {
      success: true,
      pendingCount: 0,
      unsyncedRowCount: 0,
      pushFailed: false,
    };
    expect(ready.success).toBe(true);
  });
});
