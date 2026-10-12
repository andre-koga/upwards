import { describe, expect, it } from "vitest";
import { memoryHasContent } from "./memories";

describe("memories", () => {
  it("requires text or a photo", () => {
    expect(memoryHasContent({ text_content: " ", photo_paths: [] })).toBe(
      false
    );
    expect(
      memoryHasContent({ text_content: null, photo_paths: ["photo"] })
    ).toBe(true);
  });
});
