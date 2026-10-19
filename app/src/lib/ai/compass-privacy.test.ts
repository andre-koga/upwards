import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// temporal-data-sync.md, "Compass": the AI does not read the compass in this
// slice. What someone writes about who they are becoming is more personal than
// their birth date, so nothing that builds an AI request, or receives one, may
// touch it. When the AI work arrives it reads the compass only behind an
// account setting that is off by default, and that change updates the document
// and this test together. It is not an accident of reaching for a table.

const aiDir = __dirname;
const root = join(__dirname, "../../../..");

const CLIENT_SIDE_FILES = [
  "app/src/hooks/use-home-insight.ts",
  "app/src/lib/home/digest.ts",
  "app/src/components/tasks/hooks/use-ai-today-order.ts",
];

function readdirTs(dir: string, skip: (name: string) => boolean): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && !skip(name))
    .map((name) => join(dir, name));
}

const files = [
  ...readdirTs(aiDir, (name) => name.endsWith(".test.ts")),
  ...CLIENT_SIDE_FILES.map((file) => join(root, file)),
  ...readdirTs(join(root, "supabase/functions/_shared"), () => false),
  join(root, "supabase/functions/generate-ai-insights/index.ts"),
  join(root, "supabase/functions/rank-today/index.ts"),
];

describe("the compass stays out of AI requests", () => {
  it("finds the files that build or receive an AI request", () => {
    const names = files.map((file) => file.split("/").slice(-2).join("/"));
    expect(names).toContain("ai/build-insight-payload.ts");
    expect(names).toContain("_shared/insight.ts");
    expect(names).toContain("generate-ai-insights/index.ts");
    expect(files.length).toBeGreaterThan(15);
  });

  for (const file of files) {
    const label = file.slice(root.length + 1);
    it(`${label} never reads the compass`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/compass/i);
      expect(source).not.toMatch(/north[_ ]?star/i);
      expect(source).not.toMatch(/compass_?items/i);
    });
  }
});
