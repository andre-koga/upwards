import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmFormDialog } from "@/components/forms";

export function CompassDeleteDialog({
  name,
  open,
  onOpenChange,
  onConfirm,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation("you");
  const [busy, setBusy] = useState(false);

  return (
    <ConfirmFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("deleted.confirmTitle")}
      message={t("deleted.confirmMessage", { name })}
      confirmLabel={t("deleted.confirm")}
      cancelLabel={t("deleted.cancel")}
      destructive
      busy={busy}
      onConfirm={() => {
        setBusy(true);
        void onConfirm().finally(() => setBusy(false));
      }}
    />
  );
}
