import { useEffect } from "react";
import { useTheme } from "next-themes";

const LIGHT_THEME_COLOR = "#ffffff";
const DARK_THEME_COLOR = "#000000";

/**
 * Keeps Android's installed-PWA system-bar request aligned with the resolved
 * in-app theme. Replacing the tag, rather than mutating its content in place,
 * gives Chrome's installed-app host a new metadata entry to consume.
 */
export function SystemBarThemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;

    const themeColor =
      resolvedTheme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;

    const currentThemeColor = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    if (currentThemeColor?.content !== themeColor) {
      const nextThemeColor = document.createElement("meta");
      nextThemeColor.name = "theme-color";
      nextThemeColor.content = themeColor;
      currentThemeColor?.replaceWith(nextThemeColor);
    }

    document
      .querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
      ?.setAttribute("content", resolvedTheme);
  }, [resolvedTheme]);

  return null;
}
