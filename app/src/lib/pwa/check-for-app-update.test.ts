import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForAppUpdate } from "./reload-into-latest-build";

type Listener = () => void;

function installWindow() {
  const reload = vi.fn();
  vi.stubGlobal("window", {
    location: { reload },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
  return reload;
}

function makeWorker(initial: ServiceWorkerState) {
  const listeners = new Set<Listener>();
  return {
    state: initial,
    addEventListener(type: string, fn: Listener) {
      if (type === "statechange") listeners.add(fn);
    },
    setState(next: ServiceWorkerState) {
      this.state = next;
      for (const fn of listeners) fn();
    },
  };
}

function installRegistration(registration: {
  installing: ReturnType<typeof makeWorker> | null;
  waiting: ReturnType<typeof makeWorker> | null;
  update: () => Promise<void>;
  addEventListener?: (type: string, fn: Listener) => void;
  removeEventListener?: (type: string, fn: Listener) => void;
}) {
  const updateFound = new Set<Listener>();
  const record = {
    ...registration,
    addEventListener(type: string, fn: Listener) {
      if (type === "updatefound") updateFound.add(fn);
      registration.addEventListener?.(type, fn);
    },
    removeEventListener(type: string, fn: Listener) {
      if (type === "updatefound") updateFound.delete(fn);
      registration.removeEventListener?.(type, fn);
    },
    fireUpdateFound() {
      for (const fn of updateFound) fn();
    },
  };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => record,
    },
  });
  return record;
}

describe("checkForAppUpdate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is unavailable when the browser has no service worker", async () => {
    installWindow();
    vi.stubGlobal("navigator", {});
    await expect(checkForAppUpdate()).resolves.toBe("unavailable");
  });

  it("is unavailable when no registration exists", async () => {
    installWindow();
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistration: async () => undefined },
    });
    await expect(checkForAppUpdate()).resolves.toBe("unavailable");
  });

  it("stays on the page when the installed build is current", async () => {
    const reload = installWindow();
    installRegistration({
      installing: null,
      waiting: null,
      update: async () => {},
    });
    await expect(checkForAppUpdate()).resolves.toBe("current");
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once a waiting worker activates", async () => {
    const reload = installWindow();
    const waiting = makeWorker("installing");
    installRegistration({
      installing: null,
      waiting,
      update: async () => {
        setTimeout(() => waiting.setState("activated"), 0);
      },
    });
    await expect(checkForAppUpdate()).resolves.toBe("updating");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads when updatefound installs a new worker", async () => {
    const reload = installWindow();
    const installing = makeWorker("activated");
    const registration = installRegistration({
      installing: null,
      waiting: null,
      update: async () => {
        registration.installing = installing;
        registration.fireUpdateFound();
      },
    });
    await expect(checkForAppUpdate()).resolves.toBe("updating");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reports failure when the update check throws", async () => {
    const reload = installWindow();
    installRegistration({
      installing: null,
      waiting: null,
      update: async () => {
        throw new Error("network");
      },
    });
    await expect(checkForAppUpdate()).resolves.toBe("failed");
    expect(reload).not.toHaveBeenCalled();
  });
});
