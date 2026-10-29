import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import FeedbackDialog from "@/components/tasks/feedback-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/layout/command-palette";
import { TabBar } from "@/components/layout/tab-bar";
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
 * The phone shell (ui-system-and-responsive-layout.md). One column, document
 * scroll, tab bar at the bottom. A wide window puts this inside the phone
 * frame; it does not grow a sidebar.
 */
export function AppShell({ navigation, chrome, children }: AppShellProps) {
  const { t } = useTranslation("nav");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const openFeedback = useCallback(() => setFeedbackOpen(true), []);
  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), []);
  const commands = usePaletteCommands(openFeedback);
  useAppShortcuts({ enabled: navigation, onTogglePalette: togglePalette });

  return (
    <TooltipProvider>
      <div
        className={cn(
          "app-shell min-h-dvh pt-[var(--ios-status-shield,0px)]",
          navigation && "app-shell-tabs"
        )}
      >
        {navigation ? (
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[var(--z-popover)] focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
          >
            {t("skipToContent")}
          </a>
        ) : null}
        <main
          id="main-content"
          tabIndex={-1}
          className="app-shell-main relative min-w-0 flex-1 bg-background outline-none"
        >
          {chrome}
          <div data-app-scroll>
            <div className="mx-auto w-full pb-[var(--app-tab-bar-h,0px)]">
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
