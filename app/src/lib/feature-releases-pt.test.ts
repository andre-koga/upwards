import { describe, expect, it } from "vitest";
import { FEATURE_RELEASES } from "./feature-releases";
import { FEATURE_RELEASES_PT, releaseText } from "./feature-releases-pt";

describe("What's New in Portuguese", () => {
  it("has a translation for every release, so a new entry cannot ship English-only", () => {
    const missing = FEATURE_RELEASES.filter(
      (r) => !FEATURE_RELEASES_PT[r.id]
    ).map((r) => r.id);
    expect(missing).toEqual([]);
  });

  it("has no translation for a release that no longer exists", () => {
    const ids = new Set(FEATURE_RELEASES.map((r) => r.id));
    const orphaned = Object.keys(FEATURE_RELEASES_PT).filter(
      (id) => !ids.has(id)
    );
    expect(orphaned).toEqual([]);
  });

  it("keeps the same number of bullets and fixes as the English entry", () => {
    const mismatched = FEATURE_RELEASES.filter((r) => {
      const pt = FEATURE_RELEASES_PT[r.id];
      return (
        !pt ||
        pt.bullets.length !== r.bullets.length ||
        (pt.fixes?.length ?? 0) !== (r.fixes?.length ?? 0)
      );
    }).map((r) => r.id);
    expect(mismatched).toEqual([]);
  });

  it("has no empty text", () => {
    for (const [id, pt] of Object.entries(FEATURE_RELEASES_PT)) {
      expect(pt.title.trim(), id).not.toBe("");
      for (const line of [...pt.bullets, ...(pt.fixes ?? [])]) {
        expect(line.trim(), id).not.toBe("");
      }
    }
  });

  it("picks Portuguese for pt and pt-BR, and English otherwise", () => {
    const release = FEATURE_RELEASES[0]!;
    expect(releaseText(release, "pt").title).toBe(
      FEATURE_RELEASES_PT[release.id]!.title
    );
    expect(releaseText(release, "pt-BR").title).toBe(
      FEATURE_RELEASES_PT[release.id]!.title
    );
    expect(releaseText(release, "en").title).toBe(release.title);
    expect(releaseText(release, "fr").title).toBe(release.title);
  });

  it("falls back to English when a release has no translation", () => {
    const orphan = {
      id: "not-translated",
      date: "2030-01-01",
      title: "English only",
      bullets: ["one"],
    };
    expect(releaseText(orphan, "pt")).toMatchObject({
      title: "English only",
      bullets: ["one"],
    });
  });
});
