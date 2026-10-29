import { describe, expect, it } from "vitest";
import {
  fingerprintLetter,
  letterHasProse,
  letterSystemPrompt,
  parseLetter,
  parseLetterRequest,
  type LetterDay,
  type LetterHabit,
  type LetterRequest,
} from "../../../../supabase/functions/_shared/letter";

function day(over: Partial<LetterDay> = {}): LetterDay {
  return {
    date: "2026-10-21",
    title: "A short morning",
    text: "The run was easy and I slept badly the night before.",
    memories: [],
    places: ["The river"],
    notes: [],
    ...over,
  };
}

function habit(over: Partial<LetterHabit> = {}): LetterHabit {
  return {
    key: "1",
    name: "Run",
    daysDone: 4,
    daysActive: 7,
    streak: 2,
    target: 1,
    minutes: 80,
    ...over,
  };
}

function request(over: Partial<LetterRequest> = {}): LetterRequest {
  return {
    range: "7d",
    weekStart: "2026-10-15",
    language: "en",
    days: [day()],
    habits: [habit()],
    ...over,
  };
}

const quote = {
  date: "2026-10-21",
  quote: "I slept badly the night before",
};

describe("parseLetterRequest", () => {
  it("drops coordinates and anything else that is not words or figures", () => {
    const parsed = parseLetterRequest({
      range: "7d",
      weekStart: "2026-10-15",
      language: "en",
      days: [
        {
          ...day(),
          lat: -23.5,
          lon: -46.6,
          photo_paths: ["secret.jpg"],
        },
      ],
      habits: [habit()],
      birthday: "1990-05-17",
    });
    expect(parsed?.days[0]).toEqual(day());
    expect(JSON.stringify(parsed)).not.toContain("lat");
    expect(JSON.stringify(parsed)).not.toContain("1990");
    expect(JSON.stringify(parsed)).not.toContain("secret");
  });

  it("rejects a day whose done count exceeds the days it could be done", () => {
    expect(
      parseLetterRequest({
        ...request(),
        habits: [habit({ daysDone: 8, daysActive: 7 })],
      })
    ).toBeNull();
  });
});

describe("letterHasProse", () => {
  it("is false for an empty journal, even when the tracker is full", () => {
    const quiet = request({
      days: [
        day({
          title: "",
          text: "  ",
          memories: [],
          notes: [],
          places: ["Park"],
        }),
      ],
      habits: [habit({ daysDone: 7, daysActive: 7 })],
    });
    expect(letterHasProse(quiet)).toBe(false);
  });

  it("is true when a session note is the only writing", () => {
    expect(
      letterHasProse(
        request({
          days: [day({ title: "", text: "", notes: ["easy pace"] })],
        })
      )
    ).toBe(true);
  });
});

describe("parseLetter", () => {
  it("keeps a paragraph that quotes the day and cites a real figure", () => {
    const result = parseLetter(
      JSON.stringify({
        paragraphs: [
          {
            text: "You wrote “I slept badly the night before”, and the run was logged on 4 mornings.",
            quotes: [quote],
            habits: ["1"],
          },
        ],
        experiment: null,
      }),
      request()
    );
    expect(result?.paragraphs).toHaveLength(1);
    expect(result?.paragraphs[0]?.habits).toEqual(["1"]);
  });

  it("drops a bare 7/7 sentence", () => {
    const result = parseLetter(
      JSON.stringify({
        paragraphs: [
          {
            text: "You did this 7/7 this week.",
            quotes: [],
            habits: ["1"],
          },
        ],
        experiment: null,
      }),
      request()
    );
    expect(result?.paragraphs).toEqual([]);
  });

  it("drops 7/7 when the quotation is real but the ratio was not in the request", () => {
    // The window is seven days and the date is the 21st. Neither makes 7 a
    // figure. daysActive is 5 here, so "7/7" is not this habit's count.
    const result = parseLetter(
      JSON.stringify({
        paragraphs: [
          {
            text: "You did this 7/7. You wrote “I slept badly the night before”.",
            quotes: [quote],
            habits: ["1"],
          },
        ],
        experiment: null,
      }),
      request({ habits: [habit({ daysActive: 5 })] })
    );
    expect(result?.paragraphs).toEqual([]);
  });

  it("drops a quotation the day does not contain", () => {
    const result = parseLetter(
      JSON.stringify({
        paragraphs: [
          {
            text: "You wrote “I slept wonderfully the whole night”.",
            quotes: [
              {
                date: "2026-10-21",
                quote: "I slept wonderfully the whole night",
              },
            ],
            habits: [],
          },
        ],
        experiment: null,
      }),
      request()
    );
    expect(result?.paragraphs).toEqual([]);
  });

  it("drops a quotation that is not shown in the sentence", () => {
    const result = parseLetter(
      JSON.stringify({
        paragraphs: [
          {
            text: "The mornings were the good ones.",
            quotes: [quote],
            habits: [],
          },
        ],
        experiment: null,
      }),
      request()
    );
    expect(result?.paragraphs).toEqual([]);
  });

  it("keeps the first experiment and drops a second", () => {
    const first = {
      text: "Watching whether a long entry shows up on a run day. You wrote “I slept badly the night before”.",
      quotes: [quote],
      habitKey: "1",
      habits: ["1"],
    };
    const second = {
      text: "Also start meditating. You wrote “I slept badly the night before”.",
      quotes: [quote],
      habitKey: "1",
      habits: ["1"],
    };
    const fromArray = parseLetter(
      JSON.stringify({ paragraphs: [], experiment: [first, second] }),
      request()
    );
    expect(fromArray?.experiment?.text).toContain("Watching");
    const fromList = parseLetter(
      JSON.stringify({ paragraphs: [], experiments: [first, second] }),
      request()
    );
    expect(fromList?.experiment?.text).toContain("Watching");
    expect(fromList?.experiment?.text).not.toContain("meditating");
  });

  it("drops an experiment that proposes a new habit", () => {
    const result = parseLetter(
      JSON.stringify({
        paragraphs: [],
        experiment: {
          text: "Add a meditation habit. You wrote “I slept badly the night before”.",
          quotes: [quote],
          habitKey: null,
          newHabit: "Meditation",
          habits: [],
        },
      }),
      request()
    );
    expect(result?.experiment).toBeNull();
  });

  it("drops an experiment about a habit that was not sent", () => {
    const result = parseLetter(
      JSON.stringify({
        paragraphs: [],
        experiment: {
          text: "Watch the stretching. You wrote “I slept badly the night before”.",
          quotes: [quote],
          habitKey: "99",
          habits: [],
        },
      }),
      request()
    );
    expect(result?.experiment).toBeNull();
  });

  it("is null when the answer is not the shape asked for", () => {
    expect(parseLetter("not json", request())).toBeNull();
    expect(parseLetter("[]", request())).toBeNull();
  });
});

describe("letterSystemPrompt", () => {
  it("asks for English or Portuguese and forbids a new habit", () => {
    expect(letterSystemPrompt("en")).toContain("English");
    expect(letterSystemPrompt("pt")).toContain("Portuguese (Brazil)");
    expect(letterSystemPrompt("pt")).toContain("Do not invent a habit");
    expect(letterSystemPrompt("en")).not.toMatch(/compass/i);
  });
});

describe("fingerprintLetter", () => {
  it("changes when the words change and ignores nothing in the request", () => {
    const base = request();
    const edited = request({
      days: [day({ text: "A different day entirely, written at night." })],
    });
    expect(fingerprintLetter(base)).not.toBe(fingerprintLetter(edited));
  });
});
