import { describe, expect, it } from "vitest";
import { getFirstEmoji } from "./emoji-utils";

describe("getFirstEmoji", () => {
  it("returns an empty string when there is no emoji", () => {
    expect(getFirstEmoji("")).toBe("");
    expect(getFirstEmoji("abc")).toBe("");
  });

  it("keeps multi-codepoint ZWJ sequences intact", () => {
    expect(getFirstEmoji("🧑‍🧒")).toBe("🧑‍🧒");
    expect(getFirstEmoji("🧑‍🧑‍🧒‍🧒")).toBe("🧑‍🧑‍🧒‍🧒");
  });

  it("returns only the first emoji", () => {
    expect(getFirstEmoji("🧑‍🧒🎉")).toBe("🧑‍🧒");
    expect(getFirstEmoji("a🎉b")).toBe("🎉");
  });
});
