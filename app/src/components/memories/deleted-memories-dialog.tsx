import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmFormDialog, FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import type { Memory } from "@/lib/db/types";
import { eraseTrashedMemory, restoreMemory } from "@/lib/memories-actions";

interface DeletedMemoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memories: Memory[];
  /** Called after a memory is restored or erased, so the record reloads. */
  onChanged: () => void;
}

/** The way back for a trashed memory: restore it, or delete it for good. */
export function DeletedMemoriesDialog({
  open,
  onOpenChange,
  memories,
  onChanged,
}: DeletedMemoriesDialogProps) {
  const { t } = useTranslation("memories");
  const [permanent, setPermanent] = useState<Memory | null>(null);

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t("trash.title")}
      >
        {memories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("trash.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {memories.map((memory) => (
              <li
                key={memory.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span className="min-w-0 flex-1 basis-32 truncate">
                  {memory.time_label ||
                    memory.text_content ||
                    t("trash.fallbackLabel")}
                </span>
                <span className="flex shrink-0 flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void restoreMemory(memory).then(onChanged)}
                  >
                    {t("trash.restore")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPermanent(memory)}
                  >
                    {t("trash.deletePermanently")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </FormDialog>
      <ConfirmFormDialog
        open={Boolean(permanent)}
        onOpenChange={(next) => !next && setPermanent(null)}
        title={t("trash.confirmTitle")}
        message={t("trash.confirmMessage")}
        confirmLabel={t("trash.deletePermanently")}
        destructive
        onConfirm={() => {
          if (!permanent) return;
          void eraseTrashedMemory(permanent).then(() => {
            setPermanent(null);
            onChanged();
          });
        }}
      />
    </>
  );
}
