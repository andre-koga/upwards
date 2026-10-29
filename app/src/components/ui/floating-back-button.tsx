import { Link, useLocation } from "react-router-dom";
import { Undo2, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { isTabRootPath } from "@/lib/navigation/destinations";

const FLOATING_BACK_BUTTON_BASE =
  "border-border bg-background text-muted-foreground shadow-md";

interface FloatingBackButtonProps {
  to?: string;
  onClick?: () => void;
  title?: string;
  "aria-label"?: string;
  icon?: "back" | "undo" | "settings";
  /** When false, omits fixed corner positioning (for grouped nav controls). */
  fixed?: boolean;
  className?: string;
}

export function FloatingBackButton({
  to,
  onClick,
  title,
  "aria-label": ariaLabel,
  icon = "back",
  fixed = true,
  className,
}: FloatingBackButtonProps) {
  const { pathname } = useLocation();
  const Icon = icon === "settings" ? Settings : icon === "undo" ? Undo2 : X;
  // The tab bar already leads to every tab root, so a corner button on a
  // tab's own page would go nowhere new.
  if (fixed && to !== undefined && isTabRootPath(pathname)) return null;
  const merged = cn(
    FLOATING_BACK_BUTTON_BASE,
    fixed &&
      "fixed bottom-[calc(var(--app-tab-bar-h,0px)+0.75rem)] left-4 z-50",
    className
  );

  if (to !== undefined) {
    return (
      <Button
        asChild
        type="button"
        variant="outline"
        size="floatingNav"
        className={merged}
      >
        <Link to={to} title={title} aria-label={ariaLabel ?? title}>
          <Icon className="h-5 w-5" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="floatingNav"
      title={title}
      aria-label={ariaLabel ?? title}
      onClick={onClick}
      className={merged}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}
