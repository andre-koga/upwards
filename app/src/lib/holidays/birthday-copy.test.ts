import { describe, expect, it } from "vitest";
import en from "@/locales/en/journal.json";
import pt from "@/locales/pt/journal.json";
import enSettings from "@/locales/en/settings.json";
import ptSettings from "@/locales/pt/settings.json";

// The banner reads its words from these files through i18next. A missing or
// misnamed key renders the raw key on screen, and nothing else would notice.
describe("birthday copy", () => {
  for (const [name, locale] of [
    ["en", en],
    ["pt", pt],
  ] as const) {
    it(`has the banner wording in ${name}`, () => {
      const banner = locale.birthday.banner;
      expect(banner.plain.trim()).not.toBe("");
      // The ordinal is substituted in; the key must not be a plural variant,
      // because the call passes no count and i18next would not find it.
      expect(banner.withAge).toContain("{{ordinal}}");
      expect(Object.keys(banner).sort()).toEqual(["plain", "withAge"]);
    });
  }

  it("has the Settings field text in both languages", () => {
    for (const settings of [enSettings, ptSettings]) {
      const b = settings.holidays.birthday;
      for (const key of ["label", "hint", "placeholder", "clear"] as const) {
        expect(b[key].trim(), key).not.toBe("");
      }
    }
  });
});
