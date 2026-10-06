import { describe, expect, it } from "vitest";
import { datesForRule, easterSunday, isoDate } from "./rules";
import {
  DIWALI_MM_DD,
  HINDU_FIRST_YEAR,
  HINDU_LAST_YEAR,
  HOLI_MM_DD,
} from "./hindu-table";

// Dates written down independently of how the table was produced.
const PUBLISHED_DIWALI: Record<number, string> = {
  2000: "10-26",
  2001: "11-14",
  2002: "11-04",
  2003: "10-25",
  2004: "11-12",
  2005: "11-01",
  2006: "10-21",
  2007: "11-09",
  2008: "10-28",
  2009: "10-17",
  2010: "11-05",
  2011: "10-26",
  2012: "11-13",
  2013: "11-03",
  2014: "10-23",
  2015: "11-11",
  2016: "10-30",
  2017: "10-19",
  2018: "11-07",
  2019: "10-27",
  2020: "11-14",
  2021: "11-04",
  2022: "10-24",
  2023: "11-12",
  2024: "10-31",
  2025: "10-20",
  2026: "11-08",
  2027: "10-29",
  2028: "10-17",
  2029: "11-05",
  2030: "10-26",
};
const PUBLISHED_HOLI: Record<number, string> = {
  2000: "03-20",
  2001: "03-10",
  2002: "03-29",
  2003: "03-18",
  2004: "03-07",
  2005: "03-26",
  2006: "03-15",
  2007: "03-04",
  2008: "03-22",
  2009: "03-11",
  2010: "03-01",
  2011: "03-20",
  2012: "03-08",
  2013: "03-27",
  2014: "03-17",
  2015: "03-06",
  2016: "03-24",
  2017: "03-13",
  2018: "03-02",
  2019: "03-21",
  2020: "03-10",
  2021: "03-29",
  2022: "03-18",
  2023: "03-08",
  2024: "03-25",
  2025: "03-14",
  2026: "03-04",
  2027: "03-22",
  2028: "03-11",
  2029: "03-01",
  2030: "03-20",
};

describe("easterSunday", () => {
  it("matches known Easter dates", () => {
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2038)).toEqual({ month: 4, day: 25 });
  });
});

describe("fixed and weekday rules", () => {
  it("handles fixed dates", () => {
    expect(datesForRule({ type: "fixed", month: 12, day: 25 }, 2026)).toEqual([
      "2026-12-25",
    ]);
  });

  it("finds the nth weekday of a month", () => {
    // Thanksgiving: 4th Thursday of November.
    const thanksgiving = {
      type: "nthWeekday",
      month: 11,
      weekday: 4,
      n: 4,
    } as const;
    expect(datesForRule(thanksgiving, 2026)).toEqual(["2026-11-26"]);
    expect(datesForRule(thanksgiving, 2027)).toEqual(["2027-11-25"]);
  });

  it("finds the last weekday of a month", () => {
    // Memorial Day: last Monday of May.
    const memorial = {
      type: "nthWeekday",
      month: 5,
      weekday: 1,
      n: -1,
    } as const;
    expect(datesForRule(memorial, 2026)).toEqual(["2026-05-25"]);
    expect(datesForRule(memorial, 2027)).toEqual(["2027-05-31"]);
  });

  it("offsets from Easter, across a month boundary", () => {
    expect(datesForRule({ type: "easter", offset: 0 }, 2026)).toEqual([
      "2026-04-05",
    ]);
    expect(datesForRule({ type: "easter", offset: -2 }, 2026)).toEqual([
      "2026-04-03",
    ]);
    // Carnival Tuesday, 47 days before Easter, lands in February or March.
    expect(datesForRule({ type: "easter", offset: -47 }, 2026)).toEqual([
      "2026-02-17",
    ]);
    expect(datesForRule({ type: "easter", offset: -47 }, 2024)).toEqual([
      "2024-02-13",
    ]);
  });

  it("rolls dates that overflow a month", () => {
    expect(isoDate(2026, 3, 32)).toBe("2026-04-01");
  });
});

describe("lunar calendars through Intl", () => {
  it("finds Lunar New Year", () => {
    const lny = { type: "chinese", month: 1, day: 1 } as const;
    expect(datesForRule(lny, 2025)).toEqual(["2025-01-29"]);
    expect(datesForRule(lny, 2026)).toEqual(["2026-02-17"]);
  });

  it("corrects the years where Intl is a day off the official date", () => {
    const lny = { type: "chinese", month: 1, day: 1 } as const;
    // The 2027 new moon is at 23:56 China time on Feb 6, and 2030's is on
    // Feb 3; ICU rounds both the other way. Official dates win.
    expect(datesForRule(lny, 2027)).toEqual(["2027-02-06"]);
    expect(datesForRule(lny, 2030)).toEqual(["2030-02-03"]);
  });

  it("finds the start of Ramadan and Eid al-Fitr", () => {
    expect(datesForRule({ type: "islamic", month: 9, day: 1 }, 2026)).toEqual([
      "2026-02-18",
    ]);
    expect(datesForRule({ type: "islamic", month: 10, day: 1 }, 2026)).toEqual([
      "2026-03-20",
    ]);
  });

  it("returns both when an Islamic date falls twice in a Gregorian year", () => {
    // The Islamic year is ~11 days shorter, so a date can occur in January and
    // again in December. Eid al-Adha (12 Dhu al-Hijjah... 10th) does in 2008.
    const dates = datesForRule({ type: "islamic", month: 1, day: 1 }, 2008);
    expect(dates.length).toBe(2);
    expect(dates.every((d) => d.startsWith("2008-"))).toBe(true);
  });

  it("finds Hanukkah from the Hebrew calendar", () => {
    const hanukkah = { type: "hebrew", month: "Kislev", day: 25 } as const;
    expect(datesForRule(hanukkah, 2024)).toEqual(["2024-12-26"]);
    expect(datesForRule(hanukkah, 2025)).toEqual(["2025-12-15"]);
  });

  it("does not leak a date into the next year in a non-leap year", () => {
    const all = datesForRule({ type: "islamic", month: 1, day: 1 }, 2025);
    expect(all.every((d) => d.startsWith("2025-"))).toBe(true);
  });
});

describe("Hindu table", () => {
  const holi = { type: "hindu", festival: "holi" } as const;
  const diwali = { type: "hindu", festival: "diwali" } as const;

  it("covers exactly 2000 to 2050", () => {
    const years = HINDU_LAST_YEAR - HINDU_FIRST_YEAR + 1;
    expect(years).toBe(51);
    expect(HOLI_MM_DD).toHaveLength(years);
    expect(DIWALI_MM_DD).toHaveLength(years);
  });

  it("gives no date outside the table instead of guessing", () => {
    expect(datesForRule(holi, 1999)).toEqual([]);
    expect(datesForRule(diwali, 2051)).toEqual([]);
  });

  it("matches every published Diwali date from 2000 to 2030", () => {
    for (const [year, md] of Object.entries(PUBLISHED_DIWALI)) {
      expect(datesForRule(diwali, Number(year))).toEqual([`${year}-${md}`]);
    }
  });

  it("matches every published Holi date from 2000 to 2030", () => {
    for (const [year, md] of Object.entries(PUBLISHED_HOLI)) {
      expect(datesForRule(holi, Number(year))).toEqual([`${year}-${md}`]);
    }
  });

  it("only holds real dates in the right season", () => {
    HOLI_MM_DD.forEach((md, i) => {
      const year = HINDU_FIRST_YEAR + i;
      const [m, d] = md.split("-").map(Number);
      expect(new Date(year, m - 1, d).getMonth()).toBe(m - 1);
      // Holi falls between late February and late March.
      expect(["02-25", "03-31"].some(Boolean)).toBe(true);
      expect(md >= "02-20" && md <= "03-31").toBe(true);
    });
    DIWALI_MM_DD.forEach((md, i) => {
      const year = HINDU_FIRST_YEAR + i;
      const [m, d] = md.split("-").map(Number);
      expect(new Date(year, m - 1, d).getMonth()).toBe(m - 1);
      expect(md >= "10-12" && md <= "11-16").toBe(true);
    });
  });
});
