import {
  BookOpen,
  CircleCheckBig,
  FileText,
  History,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { isYouMode } from "@/lib/app-mode";

// Today, Journal and You, plus Settings, which is
// the fourth and last tab the phone bar allows. Everything else is secondary
// and reached from Settings or the command palette.

export type TabId = "today" | "journal" | "you" | "settings";

export interface TabDestination {
  id: TabId;
  to: string;
  /** `nav` namespace key for the visible label. */
  labelKey: `tabs.${TabId}`;
  icon: LucideIcon;
  /** Digit used with ⌘/Ctrl: ⌘1 is the first tab. */
  shortcut: string;
}

const ALL_TABS: readonly TabDestination[] = [
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
  {
    id: "you",
    to: "/you",
    labelKey: "tabs.you",
    icon: UserRound,
    shortcut: "3",
  },
  {
    id: "settings",
    to: "/settings",
    labelKey: "tabs.settings",
    icon: Settings,
    shortcut: "4",
  },
];

/** The portrait site shows only You and Settings, numbered from 1. */
export const TABS: readonly TabDestination[] = isYouMode
  ? ALL_TABS.filter((tab) => tab.id === "you" || tab.id === "settings").map(
      (tab, index) => ({ ...tab, shortcut: String(index + 1) })
    )
  : ALL_TABS;

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
  if (path === "/you" || path.startsWith("/you/")) return "you";
  if (
    path === "/settings" ||
    path.startsWith("/settings/") ||
    path === "/whats-new" ||
    path === "/logs"
  ) {
    return "settings";
  }
  return null;
}

/**
 * Routes with a real two-column layout at `lg`. Every other page reads as one
 * capped column beside the sidebar; these
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
