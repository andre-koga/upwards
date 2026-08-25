import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FormDialog, FormDialogActions } from "@/components/forms";

interface SignOutConfirmDialogProps {
  open: boolean;
  pendingOpCount: number;
  unsyncedRowCount: number;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onRetrySync: () => void;
  onDiscardAndSignOut: () => void;
}

export function SignOutConfirmDialog({
  open,
  pendingOpCount,
  unsyncedRowCount,
  busy,
  onOpenChange,
  onRetrySync,
  onDiscardAndSignOut,
}: SignOutConfirmDialogProps) {
  const { t } = useTranslation("settings");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const totalUnsynced = pendingOpCount + unsyncedRowCount;

  return (
    <FormDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setConfirmDiscard(false);
        onOpenChange(nextOpen);
      }}
      title={t("auth.signOutBlocked.title")}
      description={t("auth.signOutBlocked.description", {
        pending: pendingOpCount,
        unsynced: unsyncedRowCount,
        total: totalUnsynced,
      })}
    >
      <FormDialogActions
        onConfirm={() => {
          if (confirmDiscard) {
            onDiscardAndSignOut();
            return;
          }
          onRetrySync();
        }}
        confirmLabel={
          confirmDiscard
            ? t("auth.signOutBlocked.discardConfirm")
            : t("auth.signOutBlocked.retrySync")
        }
        confirmDisabled={busy}
        confirmDestructive={confirmDiscard}
        secondaryAction={{
          label: confirmDiscard
            ? t("auth.signOutBlocked.staySignedIn")
            : t("auth.signOutBlocked.discard"),
          onClick: () => {
            if (confirmDiscard) {
              setConfirmDiscard(false);
              onOpenChange(false);
              return;
            }
            setConfirmDiscard(true);
          },
          disabled: busy,
          destructive: !confirmDiscard,
        }}
      />
    </FormDialog>
  );
}
