import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  CircleCheckBig,
  FileText,
  History,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { to: "/", labelKey: "today" as const, icon: CircleCheckBig, end: true },
  { to: "/journal", labelKey: "journal" as const, icon: BookOpen },
  { to: "/stats", labelKey: "stats" as const, icon: Sparkles },
  { to: "/friends", labelKey: "friends" as const, icon: Users },
  { to: "/settings", labelKey: "settings" as const, icon: Settings },
];

const SECONDARY_NAV = [
  { to: "/whats-new", labelKey: "whatsNew" as const, icon: History },
  { to: "/logs", labelKey: "errorLogs" as const, icon: FileText },
];

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof CircleCheckBig;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
}

/** Persistent desktop navigation rail. Hidden below `md`. */
export function DesktopNav() {
  const { t } = useTranslation("nav");

  return (
    <aside
      className="hidden md:flex md:w-52 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-background"
      aria-label={t("primaryNavigation")}
    >
      <div className="flex h-14 items-center px-4">
        <span className="font-crimson text-xl font-semibold tracking-tight text-foreground">
          Upwards
        </span>
      </div>

      <nav
        className="flex flex-1 flex-col gap-1 px-2 pb-4"
        aria-label={t("primaryNavigation")}
      >
        {PRIMARY_NAV.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            end={item.end}
            label={t(item.labelKey)}
            icon={item.icon}
          />
        ))}

        <div className="my-3 border-t border-border" role="separator" />

        {SECONDARY_NAV.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={t(item.labelKey)}
            icon={item.icon}
          />
        ))}
      </nav>
    </aside>
  );
}
