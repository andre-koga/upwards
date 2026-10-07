import { beforeAll, describe, expect, it } from "vitest";
import { createIsolatedUser, type IsolatedUser } from "./helpers";

describe("user_profiles account settings", () => {
  let user: IsolatedUser;
  let other: IsolatedUser;

  beforeAll(async () => {
    [user, other] = await Promise.all([
      createIsolatedUser(),
      createIsolatedUser(),
    ]);
  });

  it("stores the opt-in settings on the user's own row", async () => {
    const { error } = await user.deviceA.from("user_profiles").upsert(
      {
        user_id: user.userId,
        auto_location: true,
        daily_clip: false,
        holiday_calendars: ["US", "GLOBAL"],
        hemisphere: "south",
      },
      { onConflict: "user_id" }
    );
    expect(error).toBeNull();

    const { data } = await user.deviceB
      .from("user_profiles")
      .select("auto_location,daily_clip,holiday_calendars,hemisphere")
      .eq("user_id", user.userId)
      .single();
    expect(data).toEqual({
      auto_location: true,
      daily_clip: false,
      holiday_calendars: ["US", "GLOBAL"],
      hemisphere: "south",
    });
  });

  it("leaves a setting null until it is chosen", async () => {
    await user.deviceA
      .from("user_profiles")
      .upsert({ user_id: user.userId, locale: "en" }, { onConflict: "user_id" });
    const fresh = await createIsolatedUser();
    await fresh.deviceA
      .from("user_profiles")
      .upsert({ user_id: fresh.userId, locale: "en" }, { onConflict: "user_id" });
    const { data } = await fresh.deviceA
      .from("user_profiles")
      .select("auto_location,daily_clip,holiday_calendars,hemisphere")
      .eq("user_id", fresh.userId)
      .single();
    expect(data).toEqual({
      auto_location: null,
      daily_clip: null,
      holiday_calendars: null,
      hemisphere: null,
    });
  });

  it("rejects an unknown hemisphere", async () => {
    const { error } = await user.deviceA
      .from("user_profiles")
      .update({ hemisphere: "east" })
      .eq("user_id", user.userId);
    expect(error).not.toBeNull();
  });

  it("does not let one user read another user's profile", async () => {
    await other.deviceA
      .from("user_profiles")
      .upsert(
        { user_id: other.userId, auto_location: true },
        { onConflict: "user_id" }
      );

    const { data } = await user.deviceA
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", other.userId);
    expect(data ?? []).toHaveLength(0);

    const all = await user.deviceA.from("user_profiles").select("user_id");
    expect((all.data ?? []).every((row) => row.user_id === user.userId)).toBe(
      true
    );
  });

  it("does not let one user change another user's profile", async () => {
    const { data } = await user.deviceA
      .from("user_profiles")
      .update({ auto_location: false })
      .eq("user_id", other.userId)
      .select();
    expect(data ?? []).toHaveLength(0);

    const { data: theirs } = await other.deviceA
      .from("user_profiles")
      .select("auto_location")
      .eq("user_id", other.userId)
      .single();
    expect(theirs?.auto_location).toBe(true);
  });

  it("does not let a user hand their row to someone else", async () => {
    const { error } = await user.deviceA
      .from("user_profiles")
      .update({ user_id: other.userId })
      .eq("user_id", user.userId);
    expect(error).not.toBeNull();
  });

  it("stores a birthday as a plain date and leaves it null until entered", async () => {
    const fresh = await createIsolatedUser();
    await fresh.deviceA
      .from("user_profiles")
      .upsert({ user_id: fresh.userId, locale: "en" }, { onConflict: "user_id" });
    const before = await fresh.deviceA
      .from("user_profiles")
      .select("birthday")
      .eq("user_id", fresh.userId)
      .single();
    expect(before.data?.birthday).toBeNull();

    const { error } = await fresh.deviceA
      .from("user_profiles")
      .update({ birthday: "1994-02-29" })
      .eq("user_id", fresh.userId);
    // 1994 is not a leap year, so Postgres refuses the date outright.
    expect(error).not.toBeNull();

    await fresh.deviceA
      .from("user_profiles")
      .update({ birthday: "1996-02-29" })
      .eq("user_id", fresh.userId);
    const after = await fresh.deviceB
      .from("user_profiles")
      .select("birthday")
      .eq("user_id", fresh.userId)
      .single();
    expect(after.data?.birthday).toBe("1996-02-29");
  });

  it("rejects a birthday in the future or before 1900", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    for (const bad of [future.toISOString().slice(0, 10), "1899-12-31"]) {
      const { error } = await user.deviceA
        .from("user_profiles")
        .update({ birthday: bad })
        .eq("user_id", user.userId);
      expect(error, bad).not.toBeNull();
    }
  });

  it("keeps a birthday private to its owner", async () => {
    await other.deviceA
      .from("user_profiles")
      .update({ birthday: "1990-05-17" })
      .eq("user_id", other.userId);
    const { data } = await user.deviceA
      .from("user_profiles")
      .select("birthday")
      .eq("user_id", other.userId);
    expect(data ?? []).toHaveLength(0);
  });
});
