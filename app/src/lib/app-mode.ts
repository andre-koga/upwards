/**
 * The same build serves two sites. `app.` is the whole app; `you.` is the
 * personality portrait on its own, for people who only want that. Both talk to
 * the same account and the same sync, so what someone does on `you.` is already
 * there if they later open `app.`.
 */
export type AppMode = "full" | "you";

/** The host a deployment answers to for the portrait-only site. */
export const YOU_HOST_PREFIX = "you.";

export const FULL_APP_URL = "https://app.upwards.live";

/**
 * `override` (VITE_APP_MODE) wins, so a developer can try either site on
 * localhost; otherwise a host that starts with `you.` is the portrait site.
 */
export function appModeFor(
  hostname: string | undefined,
  override?: string
): AppMode {
  if (override === "you" || override === "full") return override;
  return hostname?.toLowerCase().startsWith(YOU_HOST_PREFIX) ? "you" : "full";
}

export const appMode: AppMode = appModeFor(
  typeof window === "undefined" ? undefined : window.location.hostname,
  import.meta.env.VITE_APP_MODE
);

export const isYouMode = appMode === "you";
