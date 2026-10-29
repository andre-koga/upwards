import {
  BookOpen,
  CircleCheckBig,
  FileText,
  History,
  UserRound,
  type LucideIcon,
} from "lucide-react";

// design-and-branding.md §3.2: three primary destinations, under the hard cap
// on the phone tab bar. Everything else is secondary and lives in the sidebar's
// "more" list, the Today menu, or the command palette.

export type TabId = "today" | "journal" | "you";

export interface TabDestination {
  id: TabId;
  to: string;
  /** `nav` namespace key for the visible label. */
  labelKey: `tabs.${TabId}`;
  icon: LucideIcon;
  /** Digit used with ⌘/Ctrl: ⌘1 is the first tab. */
  shortcut: string;
}

export const TABS: readonly TabDestination[] = [
  {
    id: "today",
    to: "/",
    labelKey: "tabs.today",
    icon: CircleCheckBig,
    shortcut: "1",
  },
  {
    id: "journal",
    to: "/journal",
    labelKey: "tabs.journal",
    icon: BookOpen,
    shortcut: "2",
  },
  // The compass (B5b-2). Settings stays reachable from that page.
  {
    id: "you",
    to: "/you",
    labelKey: "tabs.you",
    icon: UserRound,
    shortcut: "3",
  },
];

export interface SecondaryDestination {
  id: "whatsNew" | "logs";
  to: string;
  /** `nav` namespace key for the visible label. */
  labelKey: "whatsNew" | "errorLogs";
  icon: LucideIcon;
}

export const SECONDARY_DESTINATIONS: readonly SecondaryDestination[] = [
  { id: "whatsNew", to: "/whats-new", labelKey: "whatsNew", icon: History },
  { id: "logs", to: "/logs", labelKey: "errorLogs", icon: FileText },
];

/** Routes that open a tab directly. A back button on these goes nowhere new. */
const TAB_ROOT_PATHS: ReadonlySet<string> = new Set(TABS.map((tab) => tab.to));

export function isTabRootPath(pathname: string): boolean {
  return TAB_ROOT_PATHS.has(normalize(pathname));
}

/** Which tab a route belongs to, so sub-pages keep their parent highlighted. */
export function activeTabForPath(pathname: string): TabId | null {
  const path = normalize(pathname);
  if (path === "/") return "today";
  if (
    path === "/journal" ||
    path.startsWith("/journal/") ||
    path === "/memories" ||
    path.startsWith("/memories/")
  ) {
    return "journal";
  }
  if (
    path === "/you" ||
    path.startsWith("/you/") ||
    path === "/settings" ||
    path.startsWith("/settings/") ||
    path === "/whats-new" ||
    path === "/logs"
  ) {
    return "you";
  }
  return null;
}

/**
 * Routes with a real two-column layout at `lg`. Every other page reads as one
 * capped column beside the sidebar (ui-system-and-responsive-layout.md); these
 * take the width and place a context rail beside the main column themselves.
 */
export function routeUsesWideColumn(pathname: string): boolean {
  const path = normalize(pathname);
  return path === "/journal" || path.startsWith("/journal/");
}

/** The tab for a ⌘/Ctrl + digit shortcut, or null. */
export function tabForShortcutKey(key: string): TabDestination | null {
  return TABS.find((tab) => tab.shortcut === key) ?? null;
}

/**
 * Routes that must render without app navigation: the sign-in gate and the
 * password-recovery pages reached from an email link.
 */
export function routeHidesNavigation(pathname: string): boolean {
  const path = normalize(pathname);
  return (
    path === "/settings/forgot-password" || path === "/settings/reset-password"
  );
}

function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}
