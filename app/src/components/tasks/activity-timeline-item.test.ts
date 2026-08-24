import { describe, expect, it } from "vitest";
import {
  TIMELINE_ITEM_NAME_CLASS,
  TIMELINE_ITEM_NOTE_CLASS,
} from "./activity-timeline-item";

describe("activity timeline item wrapping", () => {
  it("wraps the activity name and note instead of truncating", () => {
    expect(TIMELINE_ITEM_NAME_CLASS).toContain("break-words");
    expect(TIMELINE_ITEM_NAME_CLASS).toContain("whitespace-normal");
    expect(TIMELINE_ITEM_NAME_CLASS).not.toContain("truncate");
    expect(TIMELINE_ITEM_NOTE_CLASS).toContain("whitespace-pre-wrap");
    expect(TIMELINE_ITEM_NOTE_CLASS).toContain("break-words");
    expect(TIMELINE_ITEM_NOTE_CLASS).not.toContain("truncate");
  });
});
