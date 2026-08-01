import { Link } from "react-router-dom";
import { Undo2, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const Icon = icon === "settings" ? Settings : icon === "undo" ? Undo2 : X;
  const merged = cn(
    FLOATING_BACK_BUTTON_BASE,
    fixed && "fixed bottom-3 left-4 z-50",
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
