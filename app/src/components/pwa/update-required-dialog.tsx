import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { syncEngine } from "@/lib/sync";
import { countUnsyncedOperations } from "@/lib/sync/pending-operations";
import { reloadIntoLatestBuild } from "@/lib/pwa/reload-into-latest-build";

const preventDismiss = (event: Event) => event.preventDefault();

/**
 * Blocks the app when the server turns this build away (`client_outdated`).
 * Not dismissible: every write after this point would only grow a queue the
 * build can never upload. Pending changes stay on the device and upload from
 * the updated build.
 */
export function UpdateRequiredDialog() {
  const { t } = useTranslation("nav");
  const [updateRequired, setUpdateRequired] = useState(
    syncEngine.getState().updateRequired
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [updating, setUpdating] = useState(false);

  useEffect(
    () =>
      syncEngine.subscribe((state) => setUpdateRequired(state.updateRequired)),
    []
  );

  useEffect(() => {
    if (!updateRequired) return;
    let cancelled = false;
    void countUnsyncedOperations().then((count) => {
      if (!cancelled) setPendingCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [updateRequired]);

  const handleUpdate = async () => {
    setUpdating(true);
    await reloadIntoLatestBuild();
  };

  return (
    <Dialog open={updateRequired}>
      <DialogContent
        size="sm"
        onEscapeKeyDown={preventDismiss}
        onPointerDownOutside={preventDismiss}
        onInteractOutside={preventDismiss}
      >
        <DialogHeader>
          <DialogTitle>{t("updateRequired.title")}</DialogTitle>
          <DialogDescription>{t("updateRequired.description")}</DialogDescription>
        </DialogHeader>
        {pendingCount > 0 && (
          <p className="text-sm font-medium">
            {t("updateRequired.pending", { count: pendingCount })}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            className="h-11 w-full"
            disabled={updating}
            onClick={() => void handleUpdate()}
          >
            <RefreshCw
              className={updating ? "animate-spin motion-reduce:animate-none" : undefined}
              aria-hidden="true"
            />
            {updating ? t("updateRequired.updating") : t("updateRequired.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
