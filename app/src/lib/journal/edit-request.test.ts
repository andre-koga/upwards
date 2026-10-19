import { beforeEach, describe, expect, it } from "vitest";
import {
  EDIT_REQUEST_TTL_MS,
  clearJournalEditRequest,
  draftMatchesRequest,
  peekJournalEditRequest,
  requestJournalEdit,
} from "./edit-request";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  globalThis.sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  } as Storage;
});

const entry = {
  entry_date: "2026-08-01",
  title: "Morning",
  text_content: "Joined text",
  photo_paths: ["a", "b"],
};

describe("journal edit request", () => {
  it("is found for its day and only its day", () => {
    requestJournalEdit(entry, 1_000);
    expect(peekJournalEditRequest("2026-08-01", 1_500)).toMatchObject({
      date: "2026-08-01",
      title: "Morning",
      text: "Joined text",
      photoCount: 2,
    });
    expect(peekJournalEditRequest("2026-08-02", 1_500)).toBeNull();
  });

  it("is peeked without being used up, until it is cleared", () => {
    requestJournalEdit(entry, 1_000);
    expect(peekJournalEditRequest("2026-08-01", 1_100)).not.toBeNull();
    expect(peekJournalEditRequest("2026-08-01", 1_200)).not.toBeNull();
    clearJournalEditRequest();
    expect(peekJournalEditRequest("2026-08-01", 1_300)).toBeNull();
  });

  it("expires, so a request nothing answered cannot open the editor later", () => {
    requestJournalEdit(entry, 1_000);
    expect(
      peekJournalEditRequest("2026-08-01", 1_000 + EDIT_REQUEST_TTL_MS + 1)
    ).toBeNull();
    // And it is gone, not just hidden.
    expect(store.size).toBe(0);
  });

  it("ignores a request from the future and a malformed one", () => {
    requestJournalEdit(entry, 5_000);
    expect(peekJournalEditRequest("2026-08-01", 1_000)).toBeNull();
    store.set("okhabit:journal-edit-request", "{not json");
    expect(peekJournalEditRequest("2026-08-01", 1_000)).toBeNull();
    store.set("okhabit:journal-edit-request", JSON.stringify({ date: "x" }));
    expect(peekJournalEditRequest("x", 1_000)).toBeNull();
  });

  it("treats a day with no title, text or photos as empty strings and zero", () => {
    requestJournalEdit(
      {
        entry_date: "2026-08-01",
        title: null,
        text_content: null,
        photo_paths: null,
      },
      1_000
    );
    const request = peekJournalEditRequest("2026-08-01", 1_001);
    expect(request).toMatchObject({ title: "", text: "", photoCount: 0 });
  });

  it("survives storage that throws", () => {
    globalThis.sessionStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => requestJournalEdit(entry)).not.toThrow();
    expect(peekJournalEditRequest("2026-08-01")).toBeNull();
    expect(() => clearJournalEditRequest()).not.toThrow();
  });
});

describe("draftMatchesRequest", () => {
  const request = {
    date: "2026-08-01",
    title: "Morning",
    text: "Joined text",
    photoCount: 2,
    at: 1,
  };

  it("matches only when the draft holds what the day was resolved to", () => {
    expect(
      draftMatchesRequest(request, {
        title: "Morning",
        text: "Joined text",
        photoCount: 2,
      })
    ).toBe(true);
  });

  it("does not match the empty draft Today starts with, which is the case that matters", () => {
    expect(
      draftMatchesRequest(request, { title: "", text: "", photoCount: 0 })
    ).toBe(false);
  });

  it("does not match a draft that differs in any one part", () => {
    expect(
      draftMatchesRequest(request, {
        title: "Other",
        text: "Joined text",
        photoCount: 2,
      })
    ).toBe(false);
    expect(
      draftMatchesRequest(request, {
        title: "Morning",
        text: "Joined",
        photoCount: 2,
      })
    ).toBe(false);
    expect(
      draftMatchesRequest(request, {
        title: "Morning",
        text: "Joined text",
        photoCount: 1,
      })
    ).toBe(false);
  });
});
