import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

function isRunningAsInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/**
 * Offers installation only when a Chromium browser has confirmed that the PWA
 * meets its installability requirements. Calling `prompt()` from the button
 * click preserves the browser's native install UI, including its app details.
 */
export function InstallAppPrompt() {
  const { t } = useTranslation("nav");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isRunningAsInstalledApp()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => setDeferredPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // The event is one-shot. The browser will dispatch a new event later if
    // installation remains available.
    setDeferredPrompt(null);
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <aside
      aria-label={t("installApp")}
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-[1.5rem] border border-foreground/10 bg-background/80 py-2 pl-4 pr-2 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.45)] backdrop-blur-md"
    >
      <Download
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[1.0625rem] leading-snug">
          {t("installApp")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("installAppDescription")}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-9 shrink-0 rounded-full px-4"
        onClick={() => void handleInstall()}
      >
        {t("install")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
        onClick={() => setDismissed(true)}
        aria-label={t("dismissInstall")}
      >
        <X className="h-4 w-4" />
      </Button>
    </aside>
  );
}
