const ACTIVATION_TIMEOUT_MS = 10_000;

function waitForActivation(worker: ServiceWorker): Promise<void> {
  if (worker.state === "activated") return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, ACTIVATION_TIMEOUT_MS);
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        window.clearTimeout(timer);
        resolve();
      }
    });
  });
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
