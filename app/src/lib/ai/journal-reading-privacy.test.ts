import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// product-scope.md §2.12: the count-based insight and Today ordering still
// never receive the journal. The letter is the only request that does, and
// only after the account setting is on. The hook checks that before it builds
// the request.

const root = join(__dirname, "../../../..");

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const CLOSED = [
  "app/src/lib/ai/build-insight-payload.ts",
  "app/src/hooks/use-home-insight.ts",
  "supabase/functions/_shared/insight.ts",
  "supabase/functions/_shared/rank-today.ts",
  "supabase/functions/generate-ai-insights/index.ts",
  "supabase/functions/rank-today/index.ts",
];

describe("journal text stays out of the count-based AI", () => {
  it("counts whether a day has writing and does not copy the words", () => {
    const text = source("app/src/lib/ai/build-insight-payload.ts");
    // Presence only (`text_content?.trim()`), never the string itself.
    expect(text).not.toMatch(/text_content(?!\?\.trim\(\))/);
    expect(text).not.toMatch(/photo_paths|video_path|memories|session notes/);
  });

  for (const file of CLOSED.filter(
    (path) => path !== "app/src/lib/ai/build-insight-payload.ts"
  )) {
    it(`${file} does not read journal text, memories, or session notes`, () => {
      const text = source(file);
      expect(text).not.toMatch(/text_content/);
      expect(text).not.toMatch(/journalEntries/);
      expect(text).not.toMatch(/memories/);
    });
  }
});

describe("the letter is not built while reading is off", () => {
  const hook = source("app/src/hooks/use-journal-letter.ts");

  it("checks the account setting before it builds a request", () => {
    const guard = hook.indexOf("journalReading !== true");
    // The import sits above the guard. The call is what must come after it.
    const build = hook.indexOf("buildLetterRequest(");
    expect(guard).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(guard);
  });

  it("is the only hook that asks for the letter", () => {
    const insight = source("app/src/hooks/use-home-insight.ts");
    expect(insight).not.toContain("buildLetterRequest");
    expect(insight).not.toContain("generate-journal-letter");
  });
});

describe("the letter function does not log the journal", () => {
  const fn = source("supabase/functions/generate-journal-letter/index.ts");

  it("refuses the call unless reading is on, and does not print the body", () => {
    expect(fn).toContain("journal_reading");
    expect(fn).not.toMatch(/console\.\w+\([^)]*bodyText/);
    expect(fn).not.toMatch(/console\.\w+\([^)]*letterRequest/);
  });
});
