import { useEffect } from "react";
import { useTheme } from "next-themes";

const LIGHT_THEME_COLOR = "#ffffff";
const DARK_THEME_COLOR = "#000000";

/**
 * Keeps Android's installed-PWA system-bar request aligned with the resolved
 * in-app theme. Both media-qualified tags are updated because Android may keep
 * selecting the tag that matches the device theme rather than the app theme.
 */
export function SystemBarThemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;

    const themeColor =
      resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;

    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", themeColor));

    document
      .querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
      ?.setAttribute("content", resolvedTheme);
  }, [resolvedTheme]);

  return null;
}
