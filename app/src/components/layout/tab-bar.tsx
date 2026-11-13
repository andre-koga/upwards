import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { TABS, activeTabForPath } from "@/lib/navigation/destinations";

/** Phone navigation: the tab bar, frosted, above the safe area. */
export function TabBar() {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const active = activeTabForPath(pathname);

  return (
    <nav
      aria-label={t("primaryNavigation")}
      className="fixed inset-x-0 bottom-0 z-[var(--z-chrome)] border-t border-foreground/[0.07] bg-background/85 pb-[var(--app-safe-bottom,env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      <ul
        className="mx-auto grid h-14 max-w-md"
        style={{
          gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`,
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="min-w-0">
              <Link
                to={tab.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground/80 active:text-foreground"
                )}
              >
                {/* The current tab is marked like a ribbon bookmark: a short
                    hairline on the bar's top edge, no filled pill. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 h-0.5 w-6 rounded-full bg-foreground transition-opacity",
                    isActive ? "opacity-80" : "opacity-0"
                  )}
                />
                <Icon
                  className="h-[1.375rem] w-[1.375rem]"
                  strokeWidth={isActive ? 2 : 1.5}
                  aria-hidden
                />
                <span className="truncate text-[0.6875rem] font-medium leading-none tracking-[0.02em]">
                  {t(tab.labelKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
