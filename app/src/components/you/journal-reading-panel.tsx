import { Link } from "react-router-dom";
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
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { useJournalReading } from "@/hooks/use-journal-reading";
import type { JournalReading } from "@/lib/db/types";
import {
  LOOK_BACK_RANGES,
  type LookBackRange,
} from "@/lib/personality/look-back";
import { fromDateString, formatDateShort } from "@/lib/time-utils";

interface JournalReadingPanelProps {
  reading: JournalReading | null;
  /** The self-test has a finished sitting to compare against. */
  hasTest: boolean;
  /** How many days back the reading looks. */
  range: LookBackRange;
  onRangeChange: (range: LookBackRange) => void;
  onSaved: () => void;
}

/**
 * The opt-in journal reading. Nothing is sent until the person has seen how
 * many days will go, and to which model, and confirmed.
 */
export function JournalReadingPanel({
  reading,
  hasTest,
  range,
  onRangeChange,
  onSaved,
}: JournalReadingPanelProps) {
  const { t } = useTranslation("personality");
  const { ai, writtenDays, pending, status, errorCode, prepare, cancel, send } =
    useJournalReading(onSaved, range);

  const model = ai.state === "connected" ? ai.model : null;
  const isReading = status === "reading";
  // The window only matters once there is a test and an AI to read with.
  const showRange = hasTest && ai.state !== "not_connected";

  let action: React.ReactNode = null;
  let message: string | null = null;
  if (!hasTest) {
    message = t("journal.needTest");
  } else if (ai.state === "not_connected") {
    message = t("journal.notConnected");
    action = (
      <Button asChild variant="outline" size="sm">
        <Link to="/settings">{t("journal.openSettings")}</Link>
      </Button>
    );
  } else if (writtenDays === 0) {
    message = t("journal.noDays", { days: range });
  } else {
    action = (
      <Button
        type="button"
        variant={reading ? "outline" : "default"}
        disabled={isReading || writtenDays === null}
        onClick={() => void prepare()}
      >
        {isReading
          ? t("journal.reading")
          : reading
            ? t("journal.readAgain")
            : t("journal.read")}
      </Button>
    );
  }

  return (
    <section aria-labelledby="journal-reading" className="px-4">
      <div className="border-t border-border pt-6 text-center">
        <h2
          id="journal-reading"
          className="font-display text-[1.375rem] italic leading-snug text-foreground/85"
        >
          {t("journal.heading")}
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
          {t("journal.body")}
        </p>
        {showRange && (
          <div className="mt-5 space-y-2">
            <p id="look-back" className="text-xs text-muted-foreground">
              {t("lookBack.label")}
            </p>
            <SegmentedControl
              aria-labelledby="look-back"
              value={String(range)}
              onValueChange={(value) =>
                onRangeChange(Number(value) as LookBackRange)
              }
            >
              {LOOK_BACK_RANGES.map((days) => (
                <SegmentedControlItem key={days} value={String(days)}>
                  {t("lookBack.option", { count: days })}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>
        )}
        {message && (
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-foreground/80">
            {message}
          </p>
        )}
        {reading && (
          <p className="mt-4 text-xs text-muted-foreground">
            {t("journal.span", {
              count: reading.days_read,
              from: formatDateShort(fromDateString(reading.span_start)),
              to: formatDateShort(fromDateString(reading.span_end)),
            })}
          </p>
        )}
        {status === "error" && errorCode && (
          <p role="alert" className="mt-4 text-[0.9375rem] text-destructive">
            {t(`journal.errors.${errorCode}`)}
          </p>
        )}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("journal.consentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("journal.consentBody", {
                count: pending?.length ?? 0,
                model: model ?? t("journal.modelFallback"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("journal.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>
              {t("journal.consentConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
