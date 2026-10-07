import { describe, expect, it } from "vitest";
import { birthdayLabel, birthdayOn, parseBirthday } from "./birthday";

const T = {
  withAge: (ordinal: string) => `Your ${ordinal} birthday`,
  plain: "Your birthday",
};
const TPT = {
  withAge: (ordinal: string) => `Seu ${ordinal} aniversário`,
  plain: "Seu aniversário",
};

describe("parseBirthday", () => {
  it("reads a real date", () => {
    expect(parseBirthday("1996-02-29")).toEqual({
      year: 1996,
      month: 2,
      day: 29,
    });
  });

  it("rejects anything that is not a real date", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "1994-02-29",
      "2026-13-01",
      "1990-04-31",
      "90-1-1",
      "tomorrow",
    ]) {
      expect(parseBirthday(bad as string | null)).toBeNull();
    }
  });
});

describe("birthdayOn", () => {
  it("finds the birthday each year, as the age being turned", () => {
    expect(birthdayOn("2026-05-17", "1990-05-17")).toBe(36);
    expect(birthdayOn("2027-05-17", "1990-05-17")).toBe(37);
    expect(birthdayOn("2090-05-17", "1990-05-17")).toBe(100);
  });

  it("is not the birthday on any other day", () => {
    expect(birthdayOn("2026-05-16", "1990-05-17")).toBeNull();
    expect(birthdayOn("2026-05-18", "1990-05-17")).toBeNull();
    expect(birthdayOn("2026-06-17", "1990-05-17")).toBeNull();
  });

  it("does not count the day of birth or any earlier year", () => {
    expect(birthdayOn("1990-05-17", "1990-05-17")).toBeNull();
    expect(birthdayOn("1985-05-17", "1990-05-17")).toBeNull();
  });

  it("shows nothing when no birthday is set", () => {
    expect(birthdayOn("2026-05-17", null)).toBeNull();
    expect(birthdayOn("2026-05-17", "")).toBeNull();
  });

  it("ignores junk dates instead of throwing", () => {
    expect(birthdayOn("not-a-date", "1990-05-17")).toBeNull();
    expect(birthdayOn("2026-05-17", "garbage")).toBeNull();
  });

  describe("a 29 February birthday", () => {
    it("is on 29 February in leap years", () => {
      expect(birthdayOn("2024-02-29", "1996-02-29")).toBe(28);
      expect(birthdayOn("2028-02-29", "1996-02-29")).toBe(32);
    });

    it("moves to 28 February in years without a leap day", () => {
      expect(birthdayOn("2026-02-28", "1996-02-29")).toBe(30);
      expect(birthdayOn("2027-02-28", "1996-02-29")).toBe(31);
    });

    it("is not also on 28 February in a leap year", () => {
      expect(birthdayOn("2024-02-28", "1996-02-29")).toBeNull();
    });

    it("is never on 1 March", () => {
      expect(birthdayOn("2026-03-01", "1996-02-29")).toBeNull();
    });

    it("treats century years correctly (2100 is not a leap year)", () => {
      expect(birthdayOn("2100-02-28", "1996-02-29")).toBe(104);
      expect(birthdayOn("2000-02-29", "1996-02-29")).toBe(4);
    });
  });

  it("does not move other birthdays on 28 February", () => {
    expect(birthdayOn("2026-02-28", "1990-02-28")).toBe(36);
  });
});

describe("birthdayLabel", () => {
  it("writes English ordinals", () => {
    const label = (n: number) => birthdayLabel(n, "en", T);
    expect(label(1)).toBe("Your 1st birthday");
    expect(label(2)).toBe("Your 2nd birthday");
    expect(label(3)).toBe("Your 3rd birthday");
    expect(label(4)).toBe("Your 4th birthday");
    expect(label(11)).toBe("Your 11th birthday");
    expect(label(12)).toBe("Your 12th birthday");
    expect(label(13)).toBe("Your 13th birthday");
    expect(label(21)).toBe("Your 21st birthday");
    expect(label(22)).toBe("Your 22nd birthday");
    expect(label(30)).toBe("Your 30th birthday");
    expect(label(101)).toBe("Your 101st birthday");
  });

  it("writes Portuguese with the masculine ordinal", () => {
    expect(birthdayLabel(30, "pt", TPT)).toBe("Seu 30º aniversário");
  });

  it("falls back to a plain label for an impossible age", () => {
    expect(birthdayLabel(0, "en", T)).toBe("Your birthday");
  });
});
