import { describe, expect, it } from "vitest";
import {
  defaultCalendars,
  getHolidayName,
  getHolidays,
  resolveCalendars,
  toggleCalendar,
} from "./index";
import { CALENDARS } from "./calendars";
import { HOLIDAYS } from "./catalog";

describe("names follow the reader's language, not the calendar", () => {
  it("shows a US holiday in Portuguese for a Portuguese reader", () => {
    expect(getHolidayName("2026-12-25", "pt", ["US"])).toBe("Natal");
    expect(getHolidayName("2026-12-25", "en", ["US"])).toBe("Christmas Day");
  });

  it("shows a Brazilian holiday in English for an English reader", () => {
    expect(getHolidayName("2026-09-07", "en", ["BR"])).toBe(
      "Brazilian Independence Day"
    );
    expect(getHolidayName("2026-09-07", "pt", ["BR"])).toBe(
      "Independência do Brasil"
    );
  });
});

describe("calendars decide what is a holiday", () => {
  it("does not show US holidays to someone who follows only Brazil", () => {
    expect(getHolidayName("2026-07-04", "en", ["BR"])).toBeNull();
    expect(getHolidayName("2026-07-04", "en", ["US"])).toBe("Independence Day");
  });

  it("shows nothing when no calendar is followed", () => {
    expect(getHolidayName("2026-12-25", "en", [])).toBeNull();
    expect(getHolidays("2026-12-25", [])).toEqual([]);
  });

  it("finds the movable US holidays", () => {
    expect(getHolidayName("2026-11-26", "en", ["US"])).toBe("Thanksgiving");
    expect(getHolidayName("2026-05-25", "en", ["US"])).toBe("Memorial Day");
    expect(getHolidayName("2026-04-03", "en", ["US"])).toBe("Good Friday");
  });

  it("finds the Brazilian Carnival on both days", () => {
    expect(getHolidayName("2026-02-16", "pt", ["BR"])).toBe("Carnaval");
    expect(getHolidayName("2026-02-17", "pt", ["BR"])).toBe("Carnaval");
    expect(getHolidayName("2026-02-18", "pt", ["BR"])).toBeNull();
  });

  it("ignores junk dates", () => {
    expect(getHolidayName("not-a-date", "en", ["US"])).toBeNull();
    expect(getHolidayName("2026-13-45", "en", ["US"])).toBeNull();
  });
});

describe("the global set", () => {
  it("adds world celebrations to a national calendar", () => {
    const calendars = ["US", "GLOBAL"] as const;
    expect(getHolidayName("2026-02-17", "en", calendars)).toBe(
      "Lunar New Year"
    );
    expect(getHolidayName("2026-03-04", "en", calendars)).toBe("Holi");
    expect(getHolidayName("2026-11-08", "en", calendars)).toBe("Diwali");
    expect(getHolidayName("2026-03-20", "en", calendars)).toBe("Eid al-Fitr");
    expect(getHolidayName("2026-12-05", "en", calendars)).toBe("Hanukkah");
  });

  it("is not shown unless followed", () => {
    expect(getHolidayName("2026-02-17", "en", ["US"])).toBeNull();
  });

  it("translates the global names", () => {
    expect(getHolidayName("2026-02-17", "pt", ["GLOBAL"])).toBe(
      "Ano Novo Lunar"
    );
    expect(getHolidayName("2026-12-05", "pt", ["GLOBAL"])).toBe("Hanucá");
  });
});

describe("a holiday in two calendars is one holiday", () => {
  it("lists Christmas once when both calendars include it", () => {
    expect(getHolidays("2026-12-25", ["US", "BR", "GLOBAL"])).toEqual([
      "christmas",
    ]);
  });

  it("lets the first calendar win when different holidays share a day", () => {
    // 2 November: Brazil's Finados and the global Day of the Dead.
    expect(getHolidays("2026-11-02", ["BR", "GLOBAL"])).toEqual([
      "all_souls",
      "day_of_the_dead",
    ]);
    expect(getHolidayName("2026-11-02", "pt", ["BR", "GLOBAL"])).toBe(
      "Finados"
    );
    expect(getHolidayName("2026-11-02", "pt", ["GLOBAL", "BR"])).toBe(
      "Dia dos Mortos"
    );
  });
});

describe("resolveCalendars", () => {
  it("falls back to a default only when the user never chose", () => {
    expect(resolveCalendars(null, "pt-BR")).toEqual(["BR", "GLOBAL"]);
  });

  it("respects an explicit empty choice", () => {
    expect(resolveCalendars([], "pt-BR")).toEqual([]);
  });

  it("drops calendar ids it does not know", () => {
    expect(resolveCalendars(["US", "ATLANTIS", "GLOBAL"], "en")).toEqual([
      "US",
      "GLOBAL",
    ]);
  });
});

describe("defaultCalendars", () => {
  it("infers the national calendar from the region in the locale", () => {
    expect(defaultCalendars("en-US")).toEqual(["US", "GLOBAL"]);
    expect(defaultCalendars("pt-BR")).toEqual(["BR", "GLOBAL"]);
  });

  it("does not assume the language means the country", () => {
    expect(defaultCalendars("pt-PT")).toEqual(["GLOBAL"]);
    expect(defaultCalendars("en-GB")).toEqual(["GLOBAL"]);
    expect(defaultCalendars("fr-FR")).toEqual(["GLOBAL"]);
  });

  it("uses the language when there is no region", () => {
    expect(defaultCalendars("en")).toEqual(["US", "GLOBAL"]);
    expect(defaultCalendars("pt")).toEqual(["BR", "GLOBAL"]);
  });
});

describe("the data files", () => {
  it("only reference holidays that exist", () => {
    for (const ids of Object.values(CALENDARS)) {
      for (const id of ids) expect(HOLIDAYS[id]).toBeDefined();
    }
  });

  it("have a name in every supported language", () => {
    for (const holiday of Object.values(HOLIDAYS)) {
      expect(holiday.names.en.trim()).not.toBe("");
      expect(holiday.names.pt.trim()).not.toBe("");
    }
  });

  it("list no holiday twice within one calendar", () => {
    for (const ids of Object.values(CALENDARS)) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("produce a date for every holiday in a covered year", () => {
    const calendars = ["US", "BR", "GLOBAL"] as const;
    for (const year of [2000, 2026, 2050]) {
      const found = new Set<string>();
      for (let m = 1; m <= 12; m += 1) {
        for (let d = 1; d <= 31; d += 1) {
          const date = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          for (const id of getHolidays(date, calendars)) found.add(id);
        }
      }
      for (const calendar of calendars) {
        for (const id of CALENDARS[calendar]) {
          expect(found.has(id), `${id} in ${year}`).toBe(true);
        }
      }
    }
  });
});

describe("toggleCalendar", () => {
  it("appends a calendar that is switched on", () => {
    expect(toggleCalendar(["BR"], "GLOBAL", true)).toEqual(["BR", "GLOBAL"]);
  });

  it("does not duplicate a calendar that is already on", () => {
    expect(toggleCalendar(["BR", "GLOBAL"], "BR", true)).toEqual([
      "GLOBAL",
      "BR",
    ]);
  });

  it("removes a calendar that is switched off, keeping the rest in order", () => {
    expect(toggleCalendar(["US", "BR", "GLOBAL"], "BR", false)).toEqual([
      "US",
      "GLOBAL",
    ]);
  });

  it("can turn everything off, which means no holidays rather than the default", () => {
    const none = toggleCalendar(["US"], "US", false);
    expect(none).toEqual([]);
    expect(resolveCalendars(none, "en-US")).toEqual([]);
  });
});
