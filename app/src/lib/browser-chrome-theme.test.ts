import { describe, expect, it } from "vitest";
import { hslChannelsToHex } from "@/lib/browser-chrome-theme";

describe("hslChannelsToHex", () => {
  it("converts classic light background to white", () => {
    expect(hslChannelsToHex("0 0% 100%")).toBe("#ffffff");
  });

  it("converts classic dark background near black", () => {
    expect(hslChannelsToHex("0 0% 3.9%")).toBe("#0a0a0a");
  });

  it("handles values without percent signs", () => {
    expect(hslChannelsToHex("0 0 100")).toBe("#ffffff");
  });

  it("returns null for invalid input", () => {
    expect(hslChannelsToHex("")).toBeNull();
    expect(hslChannelsToHex("nope")).toBeNull();
  });
});
