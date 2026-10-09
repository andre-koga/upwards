import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// design-and-branding.md §2.3 requires 4.5:1 for text and 3:1 for form-control
// borders, in light and dark. The palette lives in index.css as HSL channel
// triplets; this reads it, so editing a token that breaks a pairing fails here
// instead of shipping.

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../index.css"),
  "utf8"
);

function block(selector: ":root" | ".dark"): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf("\n  }", start));
  const vars = new Map<string, string>();
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    vars.set(m[1], m[2].trim());
  }
  return vars;
}

/** Follows `var(--x)` references down to an `H S% L%` triplet. */
function resolve(vars: Map<string, string>, name: string, depth = 0): string {
  const value = vars.get(name);
  if (value === undefined) throw new Error(`--${name} is not defined`);
  const ref = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  if (!ref) return value;
  if (depth > 5) throw new Error(`--${name} loops`);
  return resolve(vars, ref[1], depth + 1);
}

function rgb(triplet: string): [number, number, number] {
  const m = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(
    triplet
  );
  if (!m) throw new Error(`not an HSL triplet: ${triplet}`);
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = (t + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(vars: Map<string, string>, fg: string, bg: string): number {
  const a = luminance(rgb(resolve(vars, fg)));
  const b = luminance(rgb(resolve(vars, bg)));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const SURFACES = ["canvas", "paper", "canvas-deep"] as const;
// Text roles that must read on every surface they can sit on.
const TEXT = [
  "ink",
  "ink-muted",
  "ink-faint",
  "green",
  "terracotta-text",
  "gold-text",
  "destructive",
];

describe.each([":root", ".dark"] as const)("palette contrast in %s", (sel) => {
  const vars = block(sel);

  it.each(SURFACES.flatMap((s) => TEXT.map((t) => [t, s] as const)))(
    "%s reads on %s (4.5:1)",
    (text, surface) => {
      expect(contrast(vars, text, surface)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it("primary button text reads on the primary fill", () => {
    expect(
      contrast(vars, "primary-foreground", "primary")
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("destructive button text reads on the destructive fill", () => {
    expect(
      contrast(vars, "destructive-foreground", "destructive")
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("active nav (green-deep on sage) reads", () => {
    expect(contrast(vars, "green-deep", "sage")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars, "ink-muted", "sage")).toBeGreaterThanOrEqual(4.5);
  });

  it("form-control borders are visible against both page surfaces (3:1)", () => {
    for (const surface of ["canvas", "paper"]) {
      expect(contrast(vars, "line-strong", surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it("the focus ring is visible against the page surfaces (3:1)", () => {
    for (const surface of ["canvas", "paper"]) {
      expect(contrast(vars, "ring", surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it("maps every shadcn variable the primitives use", () => {
    for (const name of [
      "background",
      "foreground",
      "card",
      "popover",
      "primary",
      "secondary",
      "muted",
      "muted-foreground",
      "accent",
      "destructive",
      "border",
      "input",
      "ring",
    ]) {
      expect(() => resolve(vars, name), name).not.toThrow();
    }
  });
});
