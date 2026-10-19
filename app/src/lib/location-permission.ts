export type LocationProblem = "denied" | "unsupported" | null;

/**
 * Asks the browser for location permission once, so the prompt appears while the
 * user is looking at the switch they just flipped, not later on Today. Resolves
 * to the problem, if any.
 */
export function requestLocationPermission(): Promise<LocationProblem> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve("unsupported");
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(null),
      (error) =>
        // Only an explicit refusal blocks. A timeout or an unavailable fix is
        // not a refusal, and the setting can still be on.
        resolve(error.code === error.PERMISSION_DENIED ? "denied" : null),
      { timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  });
}
