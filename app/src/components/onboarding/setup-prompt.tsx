import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { FormDialog, FormDialogActions } from "@/components/forms";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateAccountSettings } from "@/lib/account-settings";
import {
  requestLocationPermission,
  type LocationProblem,
} from "@/lib/location-permission";
import { routeHidesNavigation } from "@/lib/navigation/destinations";
import {
  pendingSetupQuestions,
  setupAnswersToSettings,
  type SetupQuestion,
} from "@/lib/onboarding/setup-questions";
import { syncEngine } from "@/lib/sync";
import { onAccountSwitchChoiceNeeded } from "@/lib/sync/account-switch";
import {
  useAccountAnswered,
  useAccountSettings,
} from "@/lib/use-account-settings";

/**
 * Asks, once, about the two things that are off until chosen: adding where you
 * are to today, and the daily clip (product-scope.md §2.5, §2.7). Both stay in
 * Settings afterwards, so this is a friendly place to decide, never the only one.
 *
 * It asks only what is unanswered, and only after the account has said what it
 * already knows, so a second device never re-asks. "Not now" is a choice too:
 * it records both as off, so the question is not asked again.
 */
export function SetupPrompt() {
  const { t } = useTranslation("settings");
  const { pathname } = useLocation();
  const settings = useAccountSettings();
  const accountHasAnswered = useAccountAnswered();
  const [updateRequired, setUpdateRequired] = useState(
    syncEngine.getState().updateRequired
  );
  const [switchRaised, setSwitchRaised] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<SetupQuestion>>(new Set());
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<LocationProblem>(null);

  useEffect(
    () =>
      syncEngine.subscribe((state) => setUpdateRequired(state.updateRequired)),
    []
  );
  // Another account's unsent changes need an answer first, and that dialog
  // cannot be dismissed. Once it has been raised this prompt waits for the next
  // launch rather than risk two modals at once.
  useEffect(() => onAccountSwitchChoiceNeeded(() => setSwitchRaised(true)), []);

  const pending = pendingSetupQuestions({
    settings,
    accountHasAnswered,
    blocked: updateRequired || switchRaised || routeHidesNavigation(pathname),
  });
  const open = pending.length > 0;
  // Answering empties `pending`, but the dialog fades out over a moment: keep
  // the last list so its copy and rows do not change while it leaves.
  const [questions, setQuestions] = useState<SetupQuestion[]>([]);
  if (open && pending.join() !== questions.join()) setQuestions(pending);

  const finish = (answers: ReadonlySet<SetupQuestion>) => {
    updateAccountSettings(setupAnswersToSettings(questions, answers));
    setPicked(new Set());
    setProblem(null);
  };

  const toggle = async (question: SetupQuestion, next: boolean) => {
    if (question === "autoLocation") {
      setProblem(null);
      if (next) {
        setChecking(true);
        const result = await requestLocationPermission();
        setChecking(false);
        if (result) {
          // Stays off: the app must not claim to be locating when it cannot.
          setProblem(result);
          return;
        }
      }
    }
    setPicked((current) => {
      const updated = new Set(current);
      if (next) updated.add(question);
      else updated.delete(question);
      return updated;
    });
  };

  return (
    <FormDialog
      open={open}
      // Closing without choosing is "not now": nothing is turned on.
      onOpenChange={(next) => {
        if (!next) finish(new Set());
      }}
      title={t("setup.title", { count: questions.length })}
      description={t("setup.description", { count: questions.length })}
      titleClassName="font-display text-2xl font-normal tracking-tight"
    >
      <div className="space-y-4">
        {questions.map((question, index) => (
          <div
            key={question}
            className={
              index > 0
                ? "flex items-start justify-between gap-4 border-t border-border pt-4"
                : "flex items-start justify-between gap-4"
            }
          >
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor={`setup-${question}`}
                className="text-sm leading-snug"
              >
                {t(`setup.${question}.label`)}
              </Label>
              <p
                id={`setup-${question}-hint`}
                className="text-xs leading-relaxed text-muted-foreground"
              >
                {t(`setup.${question}.hint`)}
              </p>
              {question === "autoLocation" && problem ? (
                <p role="alert" className="text-xs text-destructive">
                  {t(`optIns.autoLocation.${problem}`)}
                </p>
              ) : null}
            </div>
            <Switch
              id={`setup-${question}`}
              aria-describedby={`setup-${question}-hint`}
              checked={picked.has(question)}
              disabled={question === "autoLocation" && checking}
              onCheckedChange={(next) => void toggle(question, next)}
            />
          </div>
        ))}
      </div>

      <FormDialogActions
        onConfirm={() => finish(picked)}
        confirmLabel={t("setup.save")}
        confirmDisabled={checking}
        secondaryAction={{
          label: t("setup.notNow"),
          onClick: () => finish(new Set()),
        }}
      />
      <p className="text-center text-xs text-muted-foreground">
        {t("setup.footer", { count: questions.length })}
      </p>
    </FormDialog>
  );
}
