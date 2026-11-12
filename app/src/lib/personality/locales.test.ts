import { describe, expect, it } from "vitest";
import en from "@/locales/en/personality.json";
import pt from "@/locales/pt/personality.json";
import { ITEM_IDS, TRAITS } from "./items";

/** Every leaf path, with plural suffixes folded so en/pt may differ in forms. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix.replace(/_(one|many|other)$/, "")];
}

describe("personality copy", () => {
  it("has the same keys in English and Portuguese", () => {
    expect(new Set(leafPaths(pt))).toEqual(new Set(leafPaths(en)));
  });

  it("words every item and every trait in both languages", () => {
    for (const copy of [en, pt]) {
      for (const id of ITEM_IDS) {
        expect(
          (copy.items as Record<string, string>)[id]?.length
        ).toBeGreaterThan(0);
      }
      for (const trait of TRAITS) {
        expect(copy.traits[trait].name.length).toBeGreaterThan(0);
        expect(copy.result.bands[trait].mid.length).toBeGreaterThan(0);
      }
    }
  });

  it("has no items beyond the instrument", () => {
    expect(Object.keys(en.items).sort()).toEqual([...ITEM_IDS].sort());
    expect(Object.keys(pt.items).sort()).toEqual([...ITEM_IDS].sort());
  });
});
