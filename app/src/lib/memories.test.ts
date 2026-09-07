import { describe, expect, it } from "vitest";
import { memoryHasContent, sortMemories } from "./memories";

describe("memories", () => {
  it("orders active memories newest first and excludes trashed ones", () => {
    const base = {
      text_content: "x",
      photo_paths: null,
      time_label: null,
      updated_at: "2020-01-01",
      synced_at: null,
    };
    const sorted = sortMemories([
      { ...base, id: "old", created_at: "2021-01-01", deleted_at: null },
      { ...base, id: "new", created_at: "2022-01-01", deleted_at: null },
      { ...base, id: "trashed", created_at: "2023-01-01", deleted_at: "2023-06-01" },
    ]);
    expect(sorted.map((memory) => memory.id)).toEqual(["new", "old"]);
  });

  it("requires text or a photo", () => {
    expect(memoryHasContent({ text_content: " ", photo_paths: [] })).toBe(
      false
    );
    expect(
      memoryHasContent({ text_content: null, photo_paths: ["photo"] })
    ).toBe(true);
  });
});
