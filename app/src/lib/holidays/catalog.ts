import type { HolidayRule } from "./rules";

export interface HolidayDef {
  rule: HolidayRule;
  /** Shown in the user's language, whichever calendar the holiday came from. */
  names: { en: string; pt: string };
}

const MON = 1;
const THU = 4;

/**
 * Every holiday the app knows, keyed by a stable id. Calendars (calendars.ts)
 * are lists of these ids, so a holiday shared by several calendars (Christmas)
 * is defined once and shows once. Adding a country is a new list; adding a
 * holiday is a new entry here. Names are in both supported languages because
 * the calendar a person follows is separate from the language they read.
 */
export const HOLIDAYS = {
  // Shared
  new_year: {
    rule: { type: "fixed", month: 1, day: 1 },
    names: { en: "New Year's Day", pt: "Ano Novo" },
  },
  christmas_eve: {
    rule: { type: "fixed", month: 12, day: 24 },
    names: { en: "Christmas Eve", pt: "Véspera de Natal" },
  },
  christmas: {
    rule: { type: "fixed", month: 12, day: 25 },
    names: { en: "Christmas Day", pt: "Natal" },
  },
  new_years_eve: {
    rule: { type: "fixed", month: 12, day: 31 },
    names: { en: "New Year's Eve", pt: "Véspera de Ano Novo" },
  },
  good_friday: {
    rule: { type: "easter", offset: -2 },
    names: { en: "Good Friday", pt: "Sexta-feira Santa" },
  },
  easter: {
    rule: { type: "easter", offset: 0 },
    names: { en: "Easter Sunday", pt: "Páscoa" },
  },
  easter_monday: {
    rule: { type: "easter", offset: 1 },
    names: { en: "Easter Monday", pt: "Segunda-feira de Páscoa" },
  },

  // United States
  valentines_day: {
    rule: { type: "fixed", month: 2, day: 14 },
    names: { en: "Valentine's Day", pt: "Dia de São Valentim" },
  },
  st_patricks_day: {
    rule: { type: "fixed", month: 3, day: 17 },
    names: { en: "St. Patrick's Day", pt: "Dia de São Patrício" },
  },
  juneteenth: {
    rule: { type: "fixed", month: 6, day: 19 },
    names: { en: "Juneteenth", pt: "Juneteenth" },
  },
  us_independence_day: {
    rule: { type: "fixed", month: 7, day: 4 },
    names: { en: "Independence Day", pt: "Dia da Independência dos EUA" },
  },
  halloween: {
    rule: { type: "fixed", month: 10, day: 31 },
    names: { en: "Halloween", pt: "Halloween" },
  },
  veterans_day: {
    rule: { type: "fixed", month: 11, day: 11 },
    names: { en: "Veterans Day", pt: "Dia dos Veteranos" },
  },
  mlk_day: {
    rule: { type: "nthWeekday", month: 1, weekday: MON, n: 3 },
    names: {
      en: "Martin Luther King Jr. Day",
      pt: "Dia de Martin Luther King Jr.",
    },
  },
  presidents_day: {
    rule: { type: "nthWeekday", month: 2, weekday: MON, n: 3 },
    names: { en: "Presidents' Day", pt: "Dia dos Presidentes" },
  },
  memorial_day: {
    rule: { type: "nthWeekday", month: 5, weekday: MON, n: -1 },
    names: { en: "Memorial Day", pt: "Memorial Day" },
  },
  us_labor_day: {
    rule: { type: "nthWeekday", month: 9, weekday: MON, n: 1 },
    names: { en: "Labor Day", pt: "Dia do Trabalho (EUA)" },
  },
  columbus_day: {
    rule: { type: "nthWeekday", month: 10, weekday: MON, n: 2 },
    names: { en: "Columbus Day", pt: "Dia de Colombo" },
  },
  thanksgiving: {
    rule: { type: "nthWeekday", month: 11, weekday: THU, n: 4 },
    names: { en: "Thanksgiving", pt: "Dia de Ação de Graças" },
  },

  // Brazil
  carnival_monday: {
    rule: { type: "easter", offset: -48 },
    names: { en: "Carnival", pt: "Carnaval" },
  },
  carnival: {
    rule: { type: "easter", offset: -47 },
    names: { en: "Carnival", pt: "Carnaval" },
  },
  corpus_christi: {
    rule: { type: "easter", offset: 60 },
    names: { en: "Corpus Christi", pt: "Corpus Christi" },
  },
  tiradentes: {
    rule: { type: "fixed", month: 4, day: 21 },
    names: { en: "Tiradentes Day", pt: "Tiradentes" },
  },
  br_labor_day: {
    rule: { type: "fixed", month: 5, day: 1 },
    names: { en: "Labour Day", pt: "Dia do Trabalho" },
  },
  br_independence_day: {
    rule: { type: "fixed", month: 9, day: 7 },
    names: { en: "Brazilian Independence Day", pt: "Independência do Brasil" },
  },
  aparecida: {
    rule: { type: "fixed", month: 10, day: 12 },
    names: { en: "Our Lady of Aparecida", pt: "Nossa Senhora Aparecida" },
  },
  all_souls: {
    rule: { type: "fixed", month: 11, day: 2 },
    names: { en: "All Souls' Day", pt: "Finados" },
  },
  republic_day: {
    rule: { type: "fixed", month: 11, day: 15 },
    names: { en: "Republic Proclamation Day", pt: "Proclamação da República" },
  },
  black_awareness_day: {
    rule: { type: "fixed", month: 11, day: 20 },
    names: { en: "Black Awareness Day", pt: "Consciência Negra" },
  },

  // Global set
  lunar_new_year: {
    rule: { type: "chinese", month: 1, day: 1 },
    names: { en: "Lunar New Year", pt: "Ano Novo Lunar" },
  },
  holi: {
    rule: { type: "hindu", festival: "holi" },
    names: { en: "Holi", pt: "Holi" },
  },
  ramadan_start: {
    rule: { type: "islamic", month: 9, day: 1 },
    names: { en: "Start of Ramadan", pt: "Início do Ramadã" },
  },
  eid_al_fitr: {
    rule: { type: "islamic", month: 10, day: 1 },
    names: { en: "Eid al-Fitr", pt: "Eid al-Fitr" },
  },
  eid_al_adha: {
    rule: { type: "islamic", month: 12, day: 10 },
    names: { en: "Eid al-Adha", pt: "Eid al-Adha" },
  },
  diwali: {
    rule: { type: "hindu", festival: "diwali" },
    names: { en: "Diwali", pt: "Diwali" },
  },
  hanukkah: {
    rule: { type: "hebrew", month: "Kislev", day: 25 },
    names: { en: "Hanukkah", pt: "Hanucá" },
  },
  day_of_the_dead: {
    rule: { type: "fixed", month: 11, day: 2 },
    names: { en: "Day of the Dead", pt: "Dia dos Mortos" },
  },
} as const satisfies Record<string, HolidayDef>;

export type HolidayId = keyof typeof HOLIDAYS;
