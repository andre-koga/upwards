/**
 * Keep installed-PWA / mobile browser chrome (status bar + Android nav bar)
 * in sync with the app's resolved background color and light/dark mode.
 *
 * - `theme-color` meta → top status bar (and often title bar)
 * - `color-scheme` meta → bottom Android system navigation bar in standalone PWAs
 */

const THEME_COLOR_META = 'meta[name="theme-color"]';
const COLOR_SCHEME_META = 'meta[name="color-scheme"]';

function ensureMeta(selector: string, name: string): HTMLMetaElement {
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.prepend(meta);
  }
  return meta;
}

/** Convert `H S% L%` (or `H S L`) CSS variable value to `#rrggbb`. */
export function hslChannelsToHex(channels: string): string | null {
  const parts = channels
    .trim()
    .split(/[\s/]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;

  const h = Number.parseFloat(parts[0]);
  const s = Number.parseFloat(parts[1]) / 100;
  const l = Number.parseFloat(parts[2]) / 100;
  if (![h, s, l].every((n) => Number.isFinite(n))) return null;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toByte = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

export function readBackgroundHex(): string | null {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();
  if (!raw) return null;
  return hslChannelsToHex(raw);
}

export function isDocumentDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * Apply current CSS `--background` + dark class to browser/PWA chrome metas.
 * Safe to call repeatedly (idempotent).
 */
export function syncBrowserChromeTheme(): void {
  if (typeof document === "undefined") return;

  const hex = readBackgroundHex();
  const scheme = isDocumentDark() ? "dark" : "light";

  if (hex) {
    ensureMeta(THEME_COLOR_META, "theme-color").setAttribute("content", hex);
    document.documentElement.style.backgroundColor = hex;
    if (document.body) {
      document.body.style.backgroundColor = hex;
    }
  }

  ensureMeta(COLOR_SCHEME_META, "color-scheme").setAttribute("content", scheme);
}

/**
 * Watch theme class + palette attribute changes and re-sync chrome colors.
 * Returns a cleanup function.
 */
export function observeBrowserChromeTheme(): () => void {
  syncBrowserChromeTheme();

  let frame = 0;
  const scheduleSync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      syncBrowserChromeTheme();
    });
  };

  const observer = new MutationObserver(scheduleSync);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-palette"],
  });

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      scheduleSync();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
