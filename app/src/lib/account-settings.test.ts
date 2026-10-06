import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: "77777777-7777-4777-8777-777777777777" as string | null,
  upserts: [] as Array<Record<string, unknown>>,
}));

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});

vi.mock("@/lib/supabase", () => ({
  getCachedUserId: () => auth.userId,
  supabase: {
    from: () => ({
      upsert: async (row: Record<string, unknown>) => {
        auth.upserts.push(row);
        return { error: null };
      },
    }),
  },
}));
vi.mock("@/lib/db", () => ({ now: () => "2026-10-06T12:00:00.000Z" }));

import {
  adoptRemoteAccountSettings,
  clearAccountSettings,
  EMPTY_ACCOUNT_SETTINGS,
  getAccountSettings,
  isAutoLocationOn,
  isDailyClipOn,
  mergeAccountSettings,
  updateAccountSettings,
} from "./account-settings";

beforeEach(() => {
  storage.clear();
  auth.upserts = [];
  auth.userId = "77777777-7777-4777-8777-777777777777";
  clearAccountSettings();
});

describe("defaults", () => {
  it("starts with every opt-in unset and treated as off", () => {
    expect(getAccountSettings()).toEqual(EMPTY_ACCOUNT_SETTINGS);
    expect(isAutoLocationOn()).toBe(false);
    expect(isDailyClipOn()).toBe(false);
  });
});

describe("mergeAccountSettings", () => {
  const set = (patch: Partial<typeof EMPTY_ACCOUNT_SETTINGS>) => ({
    ...EMPTY_ACCOUNT_SETTINGS,
    ...patch,
  });

  it("lets the account win over this device", () => {
    const { merged, pushUp } = mergeAccountSettings(
      set({ dailyClip: true }),
      set({ dailyClip: false })
    );
    expect(merged.dailyClip).toBe(false);
    expect(pushUp).toEqual({});
  });

  it("pushes up a choice only this device has made", () => {
    const { merged, pushUp } = mergeAccountSettings(
      set({ dailyClip: true, hemisphere: "south" }),
      set({ hemisphere: "north" })
    );
    expect(merged).toMatchObject({ dailyClip: true, hemisphere: "north" });
    expect(pushUp).toEqual({ dailyClip: true });
  });

  it("treats an explicit false on the account as a choice, not as unset", () => {
    const { merged, pushUp } = mergeAccountSettings(
      set({ autoLocation: true }),
      set({ autoLocation: false })
    );
    expect(merged.autoLocation).toBe(false);
    expect(pushUp).toEqual({});
  });
});

describe("updateAccountSettings", () => {
  it("applies immediately and saves to the account", () => {
    updateAccountSettings({ dailyClip: true });
    expect(isDailyClipOn()).toBe(true);
    expect(auth.upserts).toEqual([
      expect.objectContaining({
        user_id: auth.userId,
        daily_clip: true,
      }),
    ]);
  });

  it("only sends the fields that changed", () => {
    updateAccountSettings({ autoLocation: true });
    expect(Object.keys(auth.upserts[0]).sort()).toEqual([
      "auto_location",
      "updated_at",
      "user_id",
    ]);
  });

  it("still works offline or signed out, without touching the server", () => {
    auth.userId = null;
    updateAccountSettings({ dailyClip: true });
    expect(isDailyClipOn()).toBe(true);
    expect(auth.upserts).toEqual([]);
  });

  it("is remembered across a reload", async () => {
    updateAccountSettings({ autoLocation: true });
    vi.resetModules();
    const fresh = await import("./account-settings");
    expect(fresh.isAutoLocationOn()).toBe(true);
  });
});

describe("adoptRemoteAccountSettings", () => {
  it("takes the account's values", async () => {
    await adoptRemoteAccountSettings({
      auto_location: true,
      daily_clip: false,
      holiday_calendars: ["US", "BR"],
      hemisphere: "south",
    });
    expect(getAccountSettings()).toEqual({
      autoLocation: true,
      dailyClip: false,
      holidayCalendars: ["US", "BR"],
      hemisphere: "south",
    });
  });

  it("uploads a setting chosen before sign-in", async () => {
    updateAccountSettings({ dailyClip: true });
    auth.upserts = [];
    await adoptRemoteAccountSettings({
      auto_location: null,
      daily_clip: null,
      holiday_calendars: null,
      hemisphere: null,
    });
    expect(getAccountSettings().dailyClip).toBe(true);
    expect(auth.upserts[0]).toMatchObject({ daily_clip: true });
  });

  it("ignores junk values from the server", async () => {
    await adoptRemoteAccountSettings({
      auto_location: "yes" as unknown as boolean,
      hemisphere: "east" as unknown as "north",
    });
    expect(getAccountSettings().autoLocation).toBeNull();
    expect(getAccountSettings().hemisphere).toBeNull();
  });
});

describe("clearAccountSettings", () => {
  it("forgets the previous account's choices", () => {
    updateAccountSettings({ autoLocation: true, dailyClip: true });
    clearAccountSettings();
    expect(getAccountSettings()).toEqual(EMPTY_ACCOUNT_SETTINGS);
    expect(isAutoLocationOn()).toBe(false);
  });
});
