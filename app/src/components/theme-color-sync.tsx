import { useEffect } from "react";
import { useTheme } from "next-themes";

// Canvas colors from index.css (--canvas, light and dark).
const CANVAS = { light: "#f4efe6", dark: "#191715" } as const;

/** Keeps the browser/PWA bar tint in step with the in-app theme choice. */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const color = resolvedTheme === "dark" ? CANVAS.dark : CANVAS.light;
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.content = color;
        meta.removeAttribute("media");
      });
  }, [resolvedTheme]);
  return null;
}
