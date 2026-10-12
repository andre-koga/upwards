import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLocalDatabaseHealth } from "@/hooks/use-local-database-health";

/** Shown on every screen while this device's database does not answer. */
export function StorageStallNotice() {
  const { t } = useTranslation("settings");
  const health = useLocalDatabaseHealth();
  if (health !== "stalled") return null;

  return (
    <section
      role="alert"
      className="mx-4 mt-14 space-y-3 rounded-lg border border-destructive/40 bg-background p-4"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("storageStall.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("storageStall.body")}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
      >
        {t("storageStall.reload")}
      </Button>
    </section>
  );
}
