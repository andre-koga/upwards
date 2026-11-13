import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppPageShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * `center` is the masthead of a reflective page (the Journal): a larger
   * serif title, a small rule, and an italic subtitle, all centered.
   */
  align?: "start" | "center";
  /** Overrides the default vertical rhythm (`space-y-6 px-2 py-4 pb-24 md:p-4 md:pb-24`). */
  className?: string;
  children: ReactNode;
}

/**
 * Standard page container with a header: a serif page title like Today's date,
 * and an optional quiet subtitle.
 * On phones the side gutter is thin (`px-2`) so cards use the screen, while the
 * header keeps a wider inset; from `md` it is the usual `p-4`.
 */
export function AppPageShell({
  title,
  subtitle,
  align = "start",
  className,
  children,
}: AppPageShellProps) {
  const centered = align === "center";
  return (
    <div className={cn("space-y-6 px-2 py-4 pb-24 md:p-4 md:pb-24", className)}>
      <header
        className={cn(
          centered
            ? "flex flex-col items-center px-4 pb-3 pt-6 text-center"
            : "space-y-1.5 px-2 pt-1 md:px-0"
        )}
      >
        <h1
          className={cn(
            "font-display font-medium tracking-[-0.02em]",
            centered
              ? "text-[2.5rem] leading-[1.1]"
              : "text-[1.875rem] leading-[1.2]"
          )}
        >
          {title}
        </h1>
        {centered ? (
          <span className="mb-4 mt-4 h-px w-10 bg-foreground/25" aria-hidden />
        ) : null}
        {subtitle != null ? (
          <p
            className={cn(
              "text-muted-foreground",
              centered
                ? "max-w-[19rem] font-display text-[1.0625rem] italic leading-relaxed"
                : "text-[0.9375rem] leading-relaxed"
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
