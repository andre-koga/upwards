import type { ReactNode } from "react";
import { DesktopNav } from "@/components/layout/desktop-nav";

interface AppShellProps {
  children: ReactNode;
}

/**
 * Adaptive application chrome.
 *
 * - Below `md`: full-bleed mobile layout (bottom nav / sheets stay in pages).
 * - `md` and above: persistent sidebar + one main content scroll owner.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background md:h-dvh md:flex-row md:overflow-hidden">
      <DesktopNav />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <main
          id="app-main"
          data-app-scroll
          className="relative min-h-0 flex-1 overflow-x-hidden md:overflow-y-auto"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
