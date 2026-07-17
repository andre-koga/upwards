import { useEffect } from "react";
import { observeBrowserChromeTheme } from "@/lib/browser-chrome-theme";

/**
 * Keeps installed-PWA status / navigation bar colors aligned with the
 * active theme + palette. Mount once near the app root.
 */
export function BrowserChromeThemeSync() {
  useEffect(() => observeBrowserChromeTheme(), []);
  return null;
}
