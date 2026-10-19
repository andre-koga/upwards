import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";

interface AuthShellProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Quiet links under the card, such as the way back. */
  footer?: ReactNode;
}

/**
 * The frame of every screen a signed-out person can reach: sign in, ask for a
 * password reset, choose a new password. One column, centred, with the
 * wordmark above and room around it. No navigation, because there is nowhere
 * to go yet (product-scope.md §2.6).
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <Wordmark />

        <header className="space-y-2">
          <h1 className="font-display text-[clamp(1.9rem,6vw,2.5rem)] leading-[1.05] tracking-[-0.03em]">
            {title}
          </h1>
          {description ? (
            <p className="text-pretty text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>

        {children}

        {footer ? (
          <div className="space-y-2 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
