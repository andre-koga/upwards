import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// product-scope.md §2.8: the birth date is personal data and is never sent to
// the AI provider. The insight payload is built from aggregates in this folder;
// if a later change reaches for the account settings here, it must be a
// deliberate decision that updates that document, not an accident.
describe("the birthday stays out of AI requests", () => {
  const dir = join(__dirname);
  const files = readdirSync(dir).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts")
  );

  it("finds the AI source files to check", () => {
    expect(files).toContain("build-insight-payload.ts");
  });

  for (const file of files) {
    it(`${file} never reads the birthday or the account settings`, () => {
      const source = readFileSync(join(dir, file), "utf8");
      expect(source).not.toMatch(/birthday/i);
      expect(source).not.toMatch(/account-settings/);
      expect(source).not.toMatch(/user_profiles/);
    });
  }
});
