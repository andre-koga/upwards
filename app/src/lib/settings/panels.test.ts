import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS_PANEL,
  SETTINGS_PANELS,
  availableSettingsPanels,
  parseSettingsPanel,
  settingsPanelPath,
} from "./panels";

describe("availableSettingsPanels", () => {
  it("offers every panel when there is an account service", () => {
    expect(availableSettingsPanels(true)).toEqual([...SETTINGS_PANELS]);
  });

  it("leaves out the panels that need the account service when there is none", () => {
    expect(availableSettingsPanels(false)).toEqual([
      "general",
      "journal",
      "data",
      "about",
    ]);
  });

  it("keeps the same order either way", () => {
    const without = availableSettingsPanels(false);
    const withService = availableSettingsPanels(true);
    expect(withService.filter((p) => without.includes(p))).toEqual(without);
  });
});

describe("parseSettingsPanel", () => {
  it("reads a panel that is on offer", () => {
    expect(parseSettingsPanel("ai", true)).toBe("ai");
    expect(parseSettingsPanel("data", false)).toBe("data");
  });

  it("falls back to the first panel for anything else", () => {
    expect(parseSettingsPanel(null, true)).toBe(DEFAULT_SETTINGS_PANEL);
    expect(parseSettingsPanel("", true)).toBe(DEFAULT_SETTINGS_PANEL);
    expect(parseSettingsPanel("nope", true)).toBe(DEFAULT_SETTINGS_PANEL);
    expect(parseSettingsPanel("AI", true)).toBe(DEFAULT_SETTINGS_PANEL);
  });

  it("does not open a panel this build does not offer", () => {
    expect(parseSettingsPanel("ai", false)).toBe(DEFAULT_SETTINGS_PANEL);
    expect(parseSettingsPanel("account", false)).toBe(DEFAULT_SETTINGS_PANEL);
  });
});

describe("settingsPanelPath", () => {
  it("leaves the first panel at the plain settings address", () => {
    expect(settingsPanelPath("general")).toBe("/settings");
  });

  it("names any other panel in the query", () => {
    expect(settingsPanelPath("ai")).toBe("/settings?panel=ai");
    expect(settingsPanelPath("about")).toBe("/settings?panel=about");
  });

  it("round-trips through parse", () => {
    for (const panel of SETTINGS_PANELS) {
      const query = settingsPanelPath(panel).split("?panel=")[1] ?? null;
      expect(parseSettingsPanel(query, true)).toBe(panel);
    }
  });
});
