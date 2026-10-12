import { describe, expect, it } from "vitest";
import {
  TABS,
  activeTabForPath,
  isTabRootPath,
  routeHidesNavigation,
  tabForShortcutKey,
} from "./destinations";

describe("tab destinations", () => {
  it("has exactly the four canonical tabs, in order", () => {
    expect(TABS.map((tab) => tab.id)).toEqual([
      "home",
      "today",
      "journal",
      "you",
    ]);
  });

  it("gives every tab a distinct route and shortcut digit", () => {
    expect(new Set(TABS.map((tab) => tab.to)).size).toBe(TABS.length);
    expect(new Set(TABS.map((tab) => tab.shortcut)).size).toBe(TABS.length);
  });
});

describe("activeTabForPath", () => {
  it.each([
    ["/", "today"],
    ["/home", "home"],
    ["/journal", "journal"],
    ["/memories", "journal"],
    ["/settings", "you"],
    ["/settings/sync-issues", "you"],
    ["/whats-new", "you"],
    ["/logs", "you"],
    ["/journal/", "journal"],
  ])("%s belongs to %s", (path, tab) => {
    expect(activeTabForPath(path)).toBe(tab);
  });

  it("does not claim unrelated routes", () => {
    expect(activeTabForPath("/clip-spike")).toBeNull();
    expect(activeTabForPath("/homework")).toBeNull();
  });
});

describe("isTabRootPath", () => {
  it("is true only for routes that open a tab directly", () => {
    expect(isTabRootPath("/")).toBe(true);
    expect(isTabRootPath("/settings")).toBe(true);
    expect(isTabRootPath("/settings/sync-issues")).toBe(false);
    expect(isTabRootPath("/memories")).toBe(false);
  });
});

describe("tabForShortcutKey", () => {
  it("maps 1-4 to tabs and ignores the rest", () => {
    expect(tabForShortcutKey("1")?.id).toBe("home");
    expect(tabForShortcutKey("4")?.id).toBe("you");
    expect(tabForShortcutKey("5")).toBeNull();
    expect(tabForShortcutKey("k")).toBeNull();
  });
});

describe("routeHidesNavigation", () => {
  it("hides navigation on the password recovery pages", () => {
    expect(routeHidesNavigation("/settings/forgot-password")).toBe(true);
    expect(routeHidesNavigation("/settings/reset-password")).toBe(true);
    expect(routeHidesNavigation("/settings")).toBe(false);
  });
});
