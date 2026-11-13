import { isYouMode } from "@/lib/app-mode";

/**
 * Absolute URL for Supabase auth email links (must be allow-listed in the project).
 * The portrait site always links back to itself: VITE_APP_URL names the whole
 * app, and a link that jumped hosts would sign the person into the wrong one.
 */
export function getAuthRedirectUrl(path: string): string {
  const base =
    (isYouMode
      ? undefined
      : import.meta.env.VITE_APP_URL?.replace(/\/$/, "")) ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
