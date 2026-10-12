import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { TABS, activeTabForPath } from "@/lib/navigation/destinations";

/** Phone navigation: four tabs, frosted, floating above the safe area. */
export function TabBar() {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const active = activeTabForPath(pathname);

  return (
    <nav
      aria-label={t("primaryNavigation")}
      className="fixed inset-x-0 bottom-0 z-[var(--z-chrome)] border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-md grid-cols-4">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          const Icon = tab.icon;
          return (
            <li key={tab.id} className="min-w-0">
              <Link
                to={tab.to}
                aria-current={isActive ? "page" : undefined}
                className="group flex h-full flex-col items-center justify-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                    isActive
                      ? "bg-sage text-green-deep"
                      : "text-muted-foreground group-active:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span
                  className={cn(
                    "truncate text-[11px] font-medium leading-none",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
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
