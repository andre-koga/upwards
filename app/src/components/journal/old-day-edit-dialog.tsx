import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  answerOldDayPrompt,
  getOldDayPrompt,
  subscribeOldDayPrompt,
} from "@/lib/journal/old-day-gate";
import { formatWeekdayShortDate, fromDateString } from "@/lib/time-utils";

/**
 * The one confirmation shown before saving a change to a day older than 7
 * days. Mounted once near the app root; journal, counts, and sessions all
 * ask through `requestOldDayEdit`.
 */
export function OldDayEditDialog() {
  const { t } = useTranslation("journal");
  const prompt = useSyncExternalStore(
    subscribeOldDayPrompt,
    getOldDayPrompt,
    getOldDayPrompt
  );

  const date = prompt
    ? formatWeekdayShortDate(fromDateString(prompt.date))
    : "";
  const year = prompt ? fromDateString(prompt.date).getFullYear() : "";

  return (
    <AlertDialog
      open={prompt !== null}
      onOpenChange={(open) => {
        if (!open) answerOldDayPrompt(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("oldDay.title", { date: `${date} ${year}` })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {prompt?.summary}
            {prompt?.summary ? " " : ""}
            {t("oldDay.reassurance")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("oldDay.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => answerOldDayPrompt(true)}>
            {t("oldDay.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
