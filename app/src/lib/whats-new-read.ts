import { FEATURE_RELEASES } from "@/lib/feature-releases";

const COOKIE_NAME = "whats_new_last_seen";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string): void {
  const expires = new Date(
    Date.now() + COOKIE_MAX_AGE_SECONDS * 1000
  ).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getLatestReleaseDate(): string {
  return FEATURE_RELEASES[0]?.date ?? "";
}

export function getWhatsNewLastSeenDate(): string | null {
  return getCookie(COOKIE_NAME);
}

/** True when FEATURE_RELEASES has entries newer than the last-seen cookie date. */
export function hasUnreadWhatsNewRelease(): boolean {
  const latest = getLatestReleaseDate();
  if (!latest) return false;

  const lastSeen = getWhatsNewLastSeenDate();
  if (!lastSeen) return true;

  return latest > lastSeen;
}

/** Persist the newest release date so the indicator stays cleared until a newer release ships. */
export function markWhatsNewSeen(): void {
  const latest = getLatestReleaseDate();
  if (latest) {
    setCookie(COOKIE_NAME, latest);
  }
}
