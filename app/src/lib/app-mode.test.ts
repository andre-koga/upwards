import { describe, expect, it } from "vitest";
import { appModeFor } from "./app-mode";

describe("appModeFor", () => {
  it("is the portrait site on the you. host", () => {
    expect(appModeFor("you.upwards.live")).toBe("you");
    expect(appModeFor("YOU.upwards.live")).toBe("you");
  });

  it("is the whole app everywhere else", () => {
    expect(appModeFor("app.upwards.live")).toBe("full");
    expect(appModeFor("localhost")).toBe("full");
    expect(appModeFor("young.example.com")).toBe("full");
    expect(appModeFor(undefined)).toBe("full");
  });

  it("lets VITE_APP_MODE win, so either site can run on localhost", () => {
    expect(appModeFor("localhost", "you")).toBe("you");
    expect(appModeFor("you.upwards.live", "full")).toBe("full");
    expect(appModeFor("localhost", "nonsense")).toBe("full");
  });
});
