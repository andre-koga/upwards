const ACTIVATION_TIMEOUT_MS = 10_000;

export type AppUpdateCheck = "current" | "unavailable" | "failed" | "updating";

function waitForActivation(worker: ServiceWorker): Promise<boolean> {
  if (worker.state === "activated") return Promise.resolve(true);
  if (worker.state === "redundant") return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = window.setTimeout(
      () => resolve(false),
      ACTIVATION_TIMEOUT_MS
    );
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        window.clearTimeout(timer);
        resolve(true);
      } else if (worker.state === "redundant") {
        window.clearTimeout(timer);
        resolve(false);
      }
    });
  });
}

function pendingWorker(
  registration: ServiceWorkerRegistration
): ServiceWorker | null {
  const worker = registration.installing ?? registration.waiting;
  if (!worker || worker.state === "redundant") return null;
  return worker;
}

/**
 * Fetches the newest service worker and reloads once it controls the page.
 *
 * Reloading before the new worker activates would be served by the old
 * precache and land back on the same outdated build.
 */
export async function reloadIntoLatestBuild(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.update();
      const next = registration.installing ?? registration.waiting;
      if (next) await waitForActivation(next);
    }
  } catch (error) {
    console.warn("[pwa] service worker update failed:", error);
  }
  window.location.reload();
}

/**
 * Looks for a newer service worker. Reloads only when one is found and
 * activated, so a check on an up-to-date install leaves the page in place.
 */
export async function checkForAppUpdate(): Promise<AppUpdateCheck> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return "unavailable";
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return "unavailable";

    let discovered: ServiceWorker | null = pendingWorker(registration);
    const onUpdateFound = () => {
      discovered = registration.installing ?? discovered;
    };
    registration.addEventListener("updatefound", onUpdateFound);
    try {
      await registration.update();
    } finally {
      registration.removeEventListener("updatefound", onUpdateFound);
    }

    const next =
      pendingWorker(registration) ??
      (discovered && discovered.state !== "redundant" ? discovered : null);
    if (!next) return "current";

    const activated = await waitForActivation(next);
    if (!activated) return "failed";
    window.location.reload();
    return "updating";
  } catch (error) {
    console.warn("[pwa] app update check failed:", error);
    return "failed";
  }
}
