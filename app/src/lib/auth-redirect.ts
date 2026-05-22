/** Absolute URL for Supabase auth email links (must be allow-listed in the project). */
export function getAuthRedirectUrl(path: string): string {
  const base =
    import.meta.env.VITE_APP_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
