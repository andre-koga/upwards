import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import FeedbackDialog from "@/components/tasks/feedback-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/layout/command-palette";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TabBar } from "@/components/layout/tab-bar";
import { routeUsesWideColumn } from "@/lib/navigation/destinations";
import { useAppShortcuts } from "@/components/layout/use-app-shortcuts";
import { usePaletteCommands } from "@/components/layout/use-palette-commands";

interface AppShellProps {
  /** False for sign-in, loading, and password-recovery screens. */
  navigation: boolean;
  /** Fixed status chrome (sync pill) that must stay inside the content pane. */
  chrome?: ReactNode;
  children: ReactNode;
}

/**
 * The adaptive application shell (ui-system-and-responsive-layout.md).
 *
 * - Below `md`: the document scrolls; a frosted four-tab bar floats at the
 *   bottom. `--app-tab-bar-h` tells fixed bottom controls how much to clear.
 * - `md` and up: a sidebar (icon rail at `md`, labelled at `lg`) beside one
 *   content pane that owns scrolling. The pane is a containing block for
 *   `position: fixed` descendants, so floating controls stay inside it
 *   instead of drifting across the whole window. Overlays portal to the body
 *   and still cover the whole window.
 */
export function AppShell({ navigation, chrome, children }: AppShellProps) {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const wideColumn = routeUsesWideColumn(pathname);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const commands = usePaletteCommands(openFeedback);
  useAppShortcuts({ enabled: navigation, onTogglePalette: togglePalette });

  return (
    <TooltipProvider>
      <div
        className={cn(
          "min-h-dvh pt-[var(--ios-status-shield,0px)] md:flex md:h-dvh",
          navigation && "app-shell-tabs"
        )}
      >
        {navigation ? (
          <>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[var(--z-popover)] focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
            >
              {t("skipToContent")}
            </a>
            <SidebarNav
              onOpenPalette={openPalette}
              onOpenFeedback={openFeedback}
            />
          </>
        ) : null}
        <main
          id="main-content"
          tabIndex={-1}
          className="relative min-w-0 flex-1 bg-background outline-none md:h-full md:overflow-hidden md:[transform:translateZ(0)]"
        >
          {chrome}
          <div data-app-scroll className="md:h-full md:overflow-y-auto">
            <div
              className={cn(
                "mx-auto w-full pb-[var(--app-tab-bar-h,0px)] md:max-w-2xl",
                wideColumn ? "lg:max-w-6xl" : "lg:max-w-3xl"
              )}
            >
              {children}
            </div>
          </div>
        </main>
        {navigation ? <TabBar /> : null}
      </div>
      {navigation ? (
        <>
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            commands={commands}
          />
          <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
        </>
      ) : null}
    </TooltipProvider>
  );
}
