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
      className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-background p-3 shadow-xl md:bottom-6 md:right-6 md:left-auto"
    >
      <Download
        className="h-5 w-5 shrink-0 text-primary"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t("installApp")}</p>
        <p className="text-xs text-muted-foreground">
          {t("installAppDescription")}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-10 shrink-0 rounded-lg px-3"
        onClick={() => void handleInstall()}
      >
        {t("install")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-lg"
        onClick={() => setDismissed(true)}
        aria-label={t("dismissInstall")}
      >
        <X className="h-4 w-4" />
      </Button>
    </aside>
  );
}
