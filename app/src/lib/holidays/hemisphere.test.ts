import { describe, expect, it } from "vitest";
import { bannerMonthFor, resolveHemisphere } from "./hemisphere";

describe("bannerMonthFor", () => {
  it("leaves the north alone", () => {
    for (let m = 1; m <= 12; m += 1) expect(bannerMonthFor(m, "north")).toBe(m);
  });

  it("shifts the south by six months, so January shows July's image", () => {
    expect(bannerMonthFor(1, "south")).toBe(7);
    expect(bannerMonthFor(7, "south")).toBe(1);
    expect(bannerMonthFor(12, "south")).toBe(6);
    expect(bannerMonthFor(6, "south")).toBe(12);
  });

  it("always stays within 1-12 and swaps pairs", () => {
    for (let m = 1; m <= 12; m += 1) {
      const shifted = bannerMonthFor(m, "south");
      expect(shifted).toBeGreaterThanOrEqual(1);
      expect(shifted).toBeLessThanOrEqual(12);
      expect(bannerMonthFor(shifted, "south")).toBe(m);
    }
  });

  it("keeps opposite seasons opposite in each hemisphere", () => {
    // December (northern winter, snow = image 12) is summer in the south.
    expect(bannerMonthFor(12, "south")).toBe(6);
  });
});

describe("resolveHemisphere", () => {
  it("respects an explicit choice over everything else", () => {
    expect(resolveHemisphere("north", ["BR"])).toBe("north");
    expect(resolveHemisphere("south", ["US"])).toBe("south");
  });

  it("infers the south from Brazil and the north from the US", () => {
    expect(resolveHemisphere(null, ["BR", "GLOBAL"])).toBe("south");
    expect(resolveHemisphere(null, ["US", "GLOBAL"])).toBe("north");
  });

  it("uses the first calendar that says anything about place", () => {
    expect(resolveHemisphere(null, ["GLOBAL", "BR"])).toBe("south");
    expect(resolveHemisphere(null, ["US", "BR"])).toBe("north");
    expect(resolveHemisphere(null, ["BR", "US"])).toBe("south");
  });

  it("defaults to the north with nothing to go on", () => {
    expect(resolveHemisphere(null, [])).toBe("north");
    expect(resolveHemisphere(null, ["GLOBAL"])).toBe("north");
  });
});
