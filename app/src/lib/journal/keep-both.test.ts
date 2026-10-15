import { describe, expect, it } from "vitest";
import type { LocationData } from "@/lib/db/types";
import {
  KEEP_BOTH_DIVIDER,
  MAX_JOURNAL_PHOTOS,
  joinJournalText,
  keepBothFields,
  type KeepBothFields,
} from "./keep-both";

const place = (name: string): LocationData => ({
  displayName: name,
  city: name,
  state: null,
  country: null,
  countryCode: null,
  lat: null,
  lon: null,
});

function fields(over: Partial<KeepBothFields> = {}): KeepBothFields {
  return {
    title: null,
    text_content: null,
    day_emoji: null,
    is_bookmarked: false,
    video_path: null,
    video_thumbnail: null,
    photo_paths: null,
    location: null,
    ...over,
  };
}

describe("joinJournalText", () => {
  it("joins two different texts with the divider, mine first", () => {
    expect(joinJournalText("Walked to the lake.", "Cooked dinner.")).toBe(
      `Walked to the lake.${KEEP_BOTH_DIVIDER}Cooked dinner.`
    );
  });

  it("never drops either text, whatever the length", () => {
    const long = "a".repeat(290);
    const joined = joinJournalText(long, "b".repeat(290)) ?? "";
    expect(joined).toContain("a".repeat(290));
    expect(joined).toContain("b".repeat(290));
    expect(joined.length).toBeGreaterThan(300);
  });

  it("does not repeat identical texts", () => {
    expect(joinJournalText("Same.", "Same.")).toBe("Same.");
    expect(joinJournalText("  Same. ", "Same.")).toBe("Same.");
  });

  it("keeps the longer text alone when one only extends the other", () => {
    expect(joinJournalText("Walked.", "Walked. Then rain.")).toBe(
      "Walked. Then rain."
    );
    expect(joinJournalText("Walked. Then rain.", "Walked.")).toBe(
      "Walked. Then rain."
    );
  });

  it("returns the one text there is, or null for none", () => {
    expect(joinJournalText("Only mine.", null)).toBe("Only mine.");
    expect(joinJournalText("", "Only theirs.")).toBe("Only theirs.");
    expect(joinJournalText("  ", null)).toBeNull();
    expect(joinJournalText(null, undefined)).toBeNull();
  });
});

describe("keepBothFields", () => {
  it("joins the text and keeps this device's title and emoji", () => {
    const merged = keepBothFields(
      fields({ title: "Mine", day_emoji: "🌧️", text_content: "A" }),
      fields({ title: "Theirs", day_emoji: "☀️", text_content: "B" })
    );
    expect(merged.title).toBe("Mine");
    expect(merged.day_emoji).toBe("🌧️");
    expect(merged.text_content).toBe(`A${KEEP_BOTH_DIVIDER}B`);
  });

  it("fills a title or emoji only this device lacks from the other", () => {
    const merged = keepBothFields(
      fields({ title: null, day_emoji: " " }),
      fields({ title: "Theirs", day_emoji: "☀️" })
    );
    expect(merged.title).toBe("Theirs");
    expect(merged.day_emoji).toBe("☀️");
  });

  it("unions photos without repeats, mine first", () => {
    const merged = keepBothFields(
      fields({ photo_paths: ["a", "b"] }),
      fields({ photo_paths: ["b", "c"] })
    );
    expect(merged.photo_paths).toEqual(["a", "b", "c"]);
  });

  it("caps photos at the editor's limit, keeping the newest", () => {
    const mine = Array.from({ length: 6 }, (_, i) => `m${i}`);
    const theirs = Array.from({ length: 6 }, (_, i) => `t${i}`);
    const merged = keepBothFields(
      fields({ photo_paths: mine }),
      fields({ photo_paths: theirs })
    );
    expect(merged.photo_paths).toHaveLength(MAX_JOURNAL_PHOTOS);
    expect(merged.photo_paths?.at(-1)).toBe("t5");
  });

  it("returns no photo list rather than an empty one", () => {
    expect(
      keepBothFields(fields({ photo_paths: [] }), fields({ photo_paths: null }))
        .photo_paths
    ).toBeNull();
  });

  it("unions places, deduplicated, and caps them at five", () => {
    const merged = keepBothFields(
      fields({ location: { locations: [place("Lisbon"), place("Porto")] } }),
      fields({ location: { locations: [place("Porto"), place("Faro")] } })
    );
    expect(merged.location?.locations.map((l) => l.displayName)).toEqual([
      "Lisbon",
      "Porto",
      "Faro",
    ]);

    const many = (prefix: string) => ({
      locations: Array.from({ length: 4 }, (_, i) => place(`${prefix}${i}`)),
    });
    expect(
      keepBothFields(
        fields({ location: many("a") }),
        fields({ location: many("b") })
      ).location?.locations
    ).toHaveLength(5);
  });

  it("keeps a heart set on either side", () => {
    expect(
      keepBothFields(fields(), fields({ is_bookmarked: true })).is_bookmarked
    ).toBe(true);
    expect(
      keepBothFields(fields({ is_bookmarked: true }), fields()).is_bookmarked
    ).toBe(true);
    expect(keepBothFields(fields(), fields()).is_bookmarked).toBe(false);
  });

  it("keeps one clip with its own poster, never a poster from the other clip", () => {
    const mine = keepBothFields(
      fields({ video_path: "u/mine.mp4", video_thumbnail: "poster-mine" }),
      fields({ video_path: "u/theirs.mp4", video_thumbnail: "poster-theirs" })
    );
    expect(mine.video_path).toBe("u/mine.mp4");
    expect(mine.video_thumbnail).toBe("poster-mine");

    const theirs = keepBothFields(
      fields(),
      fields({ video_path: "u/theirs.mp4", video_thumbnail: "poster-theirs" })
    );
    expect(theirs.video_path).toBe("u/theirs.mp4");
    expect(theirs.video_thumbnail).toBe("poster-theirs");
  });
});
