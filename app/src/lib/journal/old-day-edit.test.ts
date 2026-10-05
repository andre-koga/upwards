import { describe, expect, it } from "vitest";
import {
  buildJournalRevision,
  hasJournalChange,
  isOldDay,
  pathsReferencedByRevisions,
  summarizeJournalChange,
  type RevisableJournalFields,
} from "./old-day-edit";

// DST assertions need a zone that has DST.
process.env.TZ = "America/New_York";

const entry = (
  patch: Partial<RevisableJournalFields> = {}
): RevisableJournalFields => ({
  title: "Title",
  day_emoji: "🙂",
  text_content: "Text",
  photo_paths: null,
  video_path: null,
  ...patch,
});

describe("isOldDay", () => {
  const now = new Date(2026, 5, 20, 15, 0);

  it("does not ask for today, the future, or the last 7 days", () => {
    expect(isOldDay("2026-06-20", now)).toBe(false);
    expect(isOldDay("2026-06-21", now)).toBe(false);
    expect(isOldDay("2026-06-13", now)).toBe(false); // exactly 7 days
  });

  it("asks once a day is older than 7 days", () => {
    expect(isOldDay("2026-06-12", now)).toBe(true);
    expect(isOldDay("2025-03-14", now)).toBe(true);
  });

  it("is not thrown off by the clocks changing in between", () => {
    // Nov 1 2026 has 25 hours; 7 days before Nov 8 is Nov 1.
    const afterFallBack = new Date(2026, 10, 8, 9, 0);
    expect(isOldDay("2026-11-01", afterFallBack)).toBe(false);
    expect(isOldDay("2026-10-31", afterFallBack)).toBe(true);
    // Mar 8 2026 has 23 hours.
    const afterSpringForward = new Date(2026, 2, 15, 9, 0);
    expect(isOldDay("2026-03-08", afterSpringForward)).toBe(false);
    expect(isOldDay("2026-03-07", afterSpringForward)).toBe(true);
  });

  it("uses the time of day only to pick today's date", () => {
    expect(isOldDay("2026-06-12", new Date(2026, 5, 20, 0, 1))).toBe(true);
    expect(isOldDay("2026-06-13", new Date(2026, 5, 20, 23, 59))).toBe(false);
  });
});

describe("summarizeJournalChange", () => {
  it("reports each field that was added, changed, or removed", () => {
    const summary = summarizeJournalChange(
      entry({ title: "Old", text_content: "Keep", day_emoji: "🙂" }),
      entry({ title: "New", text_content: "Keep", day_emoji: "" })
    );
    expect(summary.title).toBe("changed");
    expect(summary.text).toBeNull();
    expect(summary.emoji).toBe("removed");
  });

  it("counts added and removed photos", () => {
    const summary = summarizeJournalChange(
      entry({ photo_paths: ["a", "b"] }),
      entry({ photo_paths: ["b", "c", "d"] })
    );
    expect(summary.photosAdded).toBe(2);
    expect(summary.photosRemoved).toBe(1);
  });

  it("ignores whitespace-only differences", () => {
    expect(
      hasJournalChange(
        summarizeJournalChange(
          entry({ text_content: "Text" }),
          entry({ text_content: "  Text  " })
        )
      )
    ).toBe(false);
  });

  it("treats a missing entry as everything added", () => {
    const summary = summarizeJournalChange(null, entry({ photo_paths: ["a"] }));
    expect(summary.title).toBe("added");
    expect(summary.text).toBe("added");
    expect(summary.photosAdded).toBe(1);
  });
});

describe("buildJournalRevision", () => {
  const at = "2026-10-05T12:00:00.000Z";
  const base = {
    ...entry({ photo_paths: ["p1", "p2"] }),
    entry_date: "2025-03-14",
  };
  const make = (after: RevisableJournalFields, before = base) =>
    buildJournalRevision({
      before,
      after,
      id: "rev-1",
      at,
      videoThumbnail: null,
    });

  it("keeps the previous values when an edit overwrites them", () => {
    const revision = make(entry({ text_content: "Rewritten" }));
    expect(revision).toMatchObject({
      id: "rev-1",
      entry_date: "2025-03-14",
      title: "Title",
      text_content: "Text",
      photo_paths: ["p1", "p2"],
      created_at: at,
    });
  });

  it("records a revision when a photo is removed", () => {
    expect(make(entry({ photo_paths: ["p1"] }))).not.toBeNull();
  });

  it("records nothing when the values did not change", () => {
    expect(make({ ...base })).toBeNull();
  });

  it("records nothing for a day that had no content yet", () => {
    const empty = {
      title: null,
      day_emoji: null,
      text_content: null,
      photo_paths: null,
      video_path: null,
      entry_date: "2025-03-14",
    };
    expect(make(entry(), empty)).toBeNull();
    expect(
      buildJournalRevision({
        before: null,
        after: entry(),
        id: "r",
        at,
        videoThumbnail: null,
      })
    ).toBeNull();
  });
});

describe("pathsReferencedByRevisions", () => {
  it("collects every photo and clip a revision points at", () => {
    const paths = pathsReferencedByRevisions([
      { photo_paths: ["a", "b"], video_path: "v1" },
      { photo_paths: null, video_path: null },
      { photo_paths: ["b", "c"], video_path: null },
    ]);
    expect([...paths].sort()).toEqual(["a", "b", "c", "v1"]);
  });
});
