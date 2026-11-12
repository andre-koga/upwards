import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
const classes = new Set<string>();

function installDom() {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
  vi.stubGlobal("document", {
    documentElement: {
      classList: {
        toggle(name: string, on?: boolean) {
          const enabled = on ?? !classes.has(name);
          if (enabled) classes.add(name);
          else classes.delete(name);
          return enabled;
        },
      },
    },
  });
}

describe("compact screen edges", () => {
  beforeEach(() => {
    storage.clear();
    classes.clear();
    installDom();
    vi.resetModules();
  });

  it("stays off until chosen, and the choice is kept on this device", async () => {
    const mod = await import("./compact-screen-edges");
    expect(mod.getCompactScreenEdges()).toBe(false);
    expect(classes.has("compact-screen-edges")).toBe(false);

    mod.setCompactScreenEdges(true);
    expect(storage.get("upwards-compact-screen-edges")).toBe("1");
    expect(classes.has("compact-screen-edges")).toBe(true);
    expect(mod.getCompactScreenEdges()).toBe(true);

    vi.resetModules();
    const again = await import("./compact-screen-edges");
    expect(again.getCompactScreenEdges()).toBe(true);
    expect(classes.has("compact-screen-edges")).toBe(true);

    again.setCompactScreenEdges(false);
    expect(storage.get("upwards-compact-screen-edges")).toBe("0");
    expect(classes.has("compact-screen-edges")).toBe(false);
  });
});
