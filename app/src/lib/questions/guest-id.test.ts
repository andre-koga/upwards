import { describe, expect, it } from "vitest";
import { getOrCreateGuestId } from "./guest-id";

function memoryStore(initial?: string) {
  const data = new Map<string, string>();
  if (initial) data.set("upwards:guest_id", initial);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const ID = "6f1c2d3e-4a5b-4c6d-8e7f-90a1b2c3d4e5";

describe("guest id", () => {
  it("makes one and keeps it", () => {
    const store = memoryStore();
    expect(getOrCreateGuestId(store, () => ID)).toBe(ID);
    expect(getOrCreateGuestId(store, () => "other")).toBe(ID);
  });

  it("replaces a stored value that is not an id", () => {
    const store = memoryStore("not-an-id");
    expect(getOrCreateGuestId(store, () => ID)).toBe(ID);
    expect(store.getItem("upwards:guest_id")).toBe(ID);
  });
});
