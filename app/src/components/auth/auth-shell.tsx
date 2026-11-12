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
 * password reset, choose a new password. One column with the same centred
 * masthead as the Journal: wordmark, serif title, a short rule, an italic
 * line. Fields sit on the page, not in a card. No navigation, because there is nowhere
 * to go yet.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-9">
        <Wordmark className="justify-center" />

        <header className="flex flex-col items-center text-center">
          <h1 className="font-display text-[2.375rem] font-medium leading-[1.1] tracking-[-0.02em]">
            {title}
          </h1>
          <span className="mt-4 h-px w-10 bg-foreground/25" aria-hidden />
          {description ? (
            <p className="mt-4 max-w-[19rem] text-pretty font-display text-[1.0625rem] italic leading-relaxed text-muted-foreground">
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
