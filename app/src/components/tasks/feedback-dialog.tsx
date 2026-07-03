import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FormDialog,
  FormDialogActions,
  FormStack,
  FormTextareaField,
} from "@/components/forms";
import {
  getCachedUserId,
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEEDBACK_LIMIT = 5000;

export default function FeedbackDialog({
  open,
  onOpenChange,
}: FeedbackDialogProps) {
  const { t } = useTranslation("nav");
  const { t: tCommon } = useTranslation("common");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignedIn = Boolean(getCachedUserId());
  const canSubmit = isSupabaseConfigured && supabase && isSignedIn;

  const helperText = useMemo(() => {
    if (!isSupabaseConfigured || !supabase) {
      return t("feedbackDialog.helperNoSync");
    }
    if (!isSignedIn) {
      return t("feedbackDialog.helperSignIn");
    }
    return "";
  }, [isSignedIn, t]);

  const resetForm = () => {
    setMessage("");
    setError(null);
    setSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError(t("feedbackDialog.errorEmpty"));
      return;
    }
    if (!canSubmit || !supabase) {
      setError(t("feedbackDialog.errorNoSync"));
      return;
    }

    setSubmitting(true);
    setError(null);
    const { error: invokeError } = await supabase.functions.invoke(
      "submit-feedback",
      {
        body: { message: trimmedMessage },
      }
    );

    if (invokeError) {
      setError(invokeError.message || t("feedbackDialog.errorGeneric"));
      setSubmitting(false);
      return;
    }

    handleOpenChange(false);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("feedbackDialog.title")}
      description={t("feedbackDialog.description")}
      contentClassName="w-80"
    >
      <FormStack className="space-y-2">
        <FormTextareaField
          id="feedback-message"
          label={t("feedbackDialog.label")}
          labelClassName="sr-only"
          autoFocus
          rows={6}
          maxLength={FEEDBACK_LIMIT}
          value={message}
          disabled={submitting || !canSubmit}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("feedbackDialog.placeholder")}
          message={helperText}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </FormStack>
      <FormDialogActions
        onConfirm={() => void handleSubmit()}
        confirmLabel={submitting ? t("feedbackDialog.sending") : t("feedbackDialog.send")}
        confirmDisabled={submitting || !canSubmit || !message.trim()}
        secondaryAction={{
          label: tCommon("cancel"),
          onClick: () => handleOpenChange(false),
          disabled: submitting,
        }}
      />
    </FormDialog>
  );
}
