import { describe, expect, it } from "vitest";
import { EMPTY_ACCOUNT_SETTINGS } from "@/lib/account-settings";
import {
  pendingSetupQuestions,
  setupAnswersToSettings,
} from "./setup-questions";

const base = {
  settings: EMPTY_ACCOUNT_SETTINGS,
  accountHasAnswered: true,
  blocked: false,
};

describe("pendingSetupQuestions", () => {
  it("asks both when neither was ever chosen", () => {
    expect(pendingSetupQuestions(base)).toEqual(["autoLocation", "dailyClip"]);
  });

  it("asks nothing until the account has answered", () => {
    expect(
      pendingSetupQuestions({ ...base, accountHasAnswered: false })
    ).toEqual([]);
  });

  it("asks nothing while something else has the person's attention", () => {
    expect(pendingSetupQuestions({ ...base, blocked: true })).toEqual([]);
  });

  it("does not re-ask a choice, whichever way it went", () => {
    expect(
      pendingSetupQuestions({
        ...base,
        settings: { ...EMPTY_ACCOUNT_SETTINGS, autoLocation: false },
      })
    ).toEqual(["dailyClip"]);
    expect(
      pendingSetupQuestions({
        ...base,
        settings: { ...EMPTY_ACCOUNT_SETTINGS, dailyClip: true },
      })
    ).toEqual(["autoLocation"]);
  });

  it("asks nothing once both are chosen", () => {
    expect(
      pendingSetupQuestions({
        ...base,
        settings: {
          ...EMPTY_ACCOUNT_SETTINGS,
          autoLocation: false,
          dailyClip: false,
        },
      })
    ).toEqual([]);
  });

  it("ignores settings that are not questions", () => {
    expect(
      pendingSetupQuestions({
        ...base,
        settings: {
          autoLocation: true,
          dailyClip: true,
          holidayCalendars: null,
          hemisphere: null,
          birthday: null,
        },
      })
    ).toEqual([]);
  });
});

describe("setupAnswersToSettings", () => {
  it("records a pick as on and everything asked but not picked as off", () => {
    expect(
      setupAnswersToSettings(
        ["autoLocation", "dailyClip"],
        new Set(["dailyClip"])
      )
    ).toEqual({ autoLocation: false, dailyClip: true });
  });

  it("records 'not now' as off for every question asked, so none is asked again", () => {
    expect(
      setupAnswersToSettings(["autoLocation", "dailyClip"], new Set())
    ).toEqual({ autoLocation: false, dailyClip: false });
  });

  it("leaves alone a question that was not asked", () => {
    expect(
      setupAnswersToSettings(["dailyClip"], new Set(["dailyClip"]))
    ).toEqual({ dailyClip: true });
  });
});
