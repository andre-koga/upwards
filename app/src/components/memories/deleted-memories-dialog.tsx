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
          <p className="py-8 text-center font-display text-[1.0625rem] italic text-muted-foreground">
            {t("trash.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl bg-muted/45">
            {memories.map((memory) => (
              <li key={memory.id} className="space-y-2.5 px-4 py-3.5">
                <span className="block truncate text-[0.9375rem] leading-snug">
                  {memory.time_label ||
                    memory.text_content ||
                    t("trash.fallbackLabel")}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full px-3.5"
                    onClick={() => void restoreMemory(memory).then(onChanged)}
                  >
                    {t("trash.restore")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-3.5 text-destructive hover:text-destructive"
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
