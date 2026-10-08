import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloudUpload, Loader2, TriangleAlert } from "lucide-react";
import { FormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  discardPreviousAccountData,
  onAccountSwitchChoiceNeeded,
} from "@/lib/sync/account-switch";
import { supabase } from "@/lib/supabase";
import { dialogPrimaryDestructiveClassName } from "@/components/forms/styles";

const optionClassName =
  "flex h-auto w-full min-w-0 flex-col items-start gap-0.5 whitespace-normal rounded-xl px-4 py-3 text-left";

/**
 * A different account was signed in on this device and left behind changes the
 * server never accepted. Non-dismissible because the wrong default destroys
 * data. Uploading is not offered: those rows belong to the previous account,
 * so pushing them into this one would merge two people's data.
 */
export function AccountSwitchDialog() {
  const { t } = useTranslation("settings");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(
    () =>
      onAccountSwitchChoiceNeeded((next) => {
        setConfirmDiscard(false);
        setUserId(next);
      }),
    []
  );

  const finish = () => {
    setLoading(false);
    setConfirmDiscard(false);
    setUserId(null);
  };

  const handleDiscardPrevious = async () => {
    if (!userId || loading) return;
    setLoading(true);
    try {
      await discardPreviousAccountData(userId);
    } finally {
      finish();
    }
  };

  // Signing out leaves local data untouched, which is exactly what makes the
  // recovery possible: the user signs back in as the previous account and syncs.
  const handleSignOut = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await supabase?.auth.signOut();
    } finally {
      finish();
    }
  };

  return (
    <FormDialog
      open={userId !== null}
      onOpenChange={() => {
        /* intentionally non-dismissible */
      }}
      title={t("auth.accountSwitch.title")}
      description={t("auth.accountSwitch.description")}
      contentClassName="max-w-[calc(100%-2rem)] overflow-x-hidden sm:max-w-sm"
      descriptionClassName="text-pretty"
    >
      <div className="flex min-w-0 flex-col gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className={optionClassName}
          disabled={loading}
          onClick={handleSignOut}
        >
          {loading ? (
            <Loader2 className="mb-1 h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <CloudUpload className="mb-1 h-4 w-4 shrink-0" />
          )}
          <span className="w-full min-w-0 text-pretty text-sm font-semibold">
            {t("auth.accountSwitch.keep")}
          </span>
          <span className="w-full min-w-0 text-pretty text-xs text-muted-foreground">
            {t("auth.accountSwitch.keepHint")}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className={
            confirmDiscard
              ? `${optionClassName} ${dialogPrimaryDestructiveClassName}`
              : optionClassName
          }
          disabled={loading}
          onClick={() => {
            if (confirmDiscard) {
              void handleDiscardPrevious();
              return;
            }
            setConfirmDiscard(true);
          }}
        >
          {loading ? (
            <Loader2 className="mb-1 h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <TriangleAlert className="mb-1 h-4 w-4 shrink-0" />
          )}
          <span className="w-full min-w-0 text-pretty text-sm font-semibold">
            {confirmDiscard
              ? t("auth.accountSwitch.discardConfirm")
              : t("auth.accountSwitch.discard")}
          </span>
          <span className="w-full min-w-0 text-pretty text-xs text-muted-foreground">
            {confirmDiscard
              ? t("auth.accountSwitch.discardConfirmHint")
              : t("auth.accountSwitch.discardHint")}
          </span>
        </Button>
      </div>
    </FormDialog>
  );
}
