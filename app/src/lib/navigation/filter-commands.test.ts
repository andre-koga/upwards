import { describe, expect, it } from "vitest";
import { filterCommands } from "./filter-commands";

const commands = [
  { label: "Journal", keywords: ["diary", "entries"] },
  { label: "Settings", keywords: ["account", "preferences"] },
  { label: "Sync issues", keywords: ["conflicts", "journal conflicts"] },
  { label: "Diário" },
];

describe("filterCommands", () => {
  it("returns everything for an empty query", () => {
    expect(filterCommands(commands, "  ")).toHaveLength(commands.length);
  });

  it("matches labels and keywords, ignoring case", () => {
    expect(filterCommands(commands, "ACCOUNT").map((c) => c.label)).toEqual([
      "Settings",
    ]);
  });

  it("requires every typed word", () => {
    expect(filterCommands(commands, "sync conflicts")).toHaveLength(1);
    expect(filterCommands(commands, "sync diary")).toHaveLength(0);
  });

  it("ignores accents in both directions", () => {
    expect(filterCommands(commands, "diario").map((c) => c.label)).toContain(
      "Diário"
    );
    expect(filterCommands([{ label: "Journal" }], "jóurnal")).toHaveLength(1);
  });

  it("ranks label prefixes before other matches, keeping order otherwise", () => {
    expect(filterCommands(commands, "journal").map((c) => c.label)).toEqual([
      "Journal",
      "Sync issues",
    ]);
  });
});
