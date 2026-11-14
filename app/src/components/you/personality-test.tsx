import { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import type { PersonalitySitting } from "@/lib/db/types";
import { logError } from "@/lib/error-utils";
import { useIsGuest } from "@/lib/guest";
import { ITEMS, ITEM_COUNT } from "@/lib/personality/items";
import { nextUnansweredIndex } from "@/lib/personality/scoring";
import { answerQuestion, discardSitting } from "@/lib/personality/store";
import { cn } from "@/lib/utils";

const ANSWER_VALUES = [1, 2, 3, 4, 5] as const;

interface PersonalityTestProps {
  sitting: PersonalitySitting;
  /** Called after each saved answer; the last one hands over a finished sitting. */
  onSaved: (sitting: PersonalitySitting) => void;
  /** Leave the test; the sitting stays saved and can be resumed. */
  onLeave: () => void;
  /** The sitting was discarded. */
  onDiscarded: () => void;
}

/** One statement per screen, five answers, and a place that is saved each time. */
export function PersonalityTest({
  sitting,
  onSaved,
  onLeave,
  onDiscarded,
}: PersonalityTestProps) {
  const { t } = useTranslation("personality");
  const guest = useIsGuest();
  const [index, setIndex] = useState(
    () => nextUnansweredIndex(sitting.answers) ?? 0
  );
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const item = ITEMS[index];
  const current = sitting.answers[item.id] ?? null;

  const answer = useCallback(
    async (value: number) => {
      if (saving) return;
      setSaving(true);
      try {
        const updated = await answerQuestion(sitting.id, item.id, value);
        if (!updated) return;
        onSaved(updated);
        if (index < ITEM_COUNT - 1) setIndex(index + 1);
      } catch (err) {
        logError("Saving a test answer", err);
      } finally {
        setSaving(false);
      }
    },
    [saving, sitting.id, item.id, index, onSaved]
  );

  const back = useCallback(() => {
    setIndex((value) => Math.max(0, value - 1));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (confirmDiscard) return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, [role='dialog']")
      ) {
        return;
      }
      if (event.key >= "1" && event.key <= "5") {
        event.preventDefault();
        void answer(Number(event.key));
      } else if (event.key === "ArrowLeft") {
        back();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, back, confirmDiscard]);

  return (
    <section
      aria-labelledby="test-statement"
      className="mx-auto flex max-w-[26rem] flex-col px-4 pt-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8125rem] tabular-nums text-muted-foreground">
          {t("test.progress", { current: index + 1, total: ITEM_COUNT })}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onLeave}>
          {t("test.exit")}
        </Button>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={ITEM_COUNT}
        aria-valuenow={index + 1}
        aria-label={t("test.progress", {
          current: index + 1,
          total: ITEM_COUNT,
        })}
        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${((index + 1) / ITEM_COUNT) * 100}%` }}
        />
      </div>

      <p className="mt-10 text-center text-[0.8125rem] text-muted-foreground">
        {t("test.statementLabel")}
      </p>
      <h2
        id="test-statement"
        className="mt-3 min-h-[5.5rem] text-center font-display text-[1.625rem] italic leading-snug tracking-[-0.01em] text-foreground/90"
      >
        {t(`items.${item.id}`)}
      </h2>

      <div
        role="group"
        aria-label={t("test.answersLabel")}
        className="mt-8 flex flex-col gap-2"
      >
        {ANSWER_VALUES.map((value) => (
          <Button
            key={value}
            type="button"
            variant={current === value ? "default" : "outline"}
            disabled={saving}
            aria-pressed={current === value}
            onClick={() => void answer(value)}
            className={cn("h-11 justify-start gap-3 px-4 text-[0.9375rem]")}
          >
            <span
              aria-hidden="true"
              className="w-4 text-center text-xs tabular-nums opacity-70"
            >
              {value}
            </span>
            {t(`answers.${value}`)}
          </Button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={back}
        >
          {t("test.back")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirmDiscard(true)}
        >
          {t("test.discard")}
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t(guest ? "test.savedHintGuest" : "test.savedHint")}
      </p>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("test.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("test.discardBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("test.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void discardSitting(sitting.id)
                  .then(onDiscarded)
                  .catch((err) => logError("Discarding a sitting", err));
              }}
            >
              {t("test.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
