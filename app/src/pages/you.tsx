import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { DailyQuestion } from "@/components/you/daily-question";
import { JournalReadingPanel } from "@/components/you/journal-reading-panel";
import { PersonalityResult } from "@/components/you/personality-result";
import { PersonalityTest } from "@/components/you/personality-test";
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
import { isYouMode } from "@/lib/app-mode";
import { useDailyQuestion } from "@/hooks/use-daily-question";
import { usePersonality } from "@/hooks/use-personality";
import {
  setLookBackRange,
  useLookBackRange,
} from "@/lib/personality/look-back";
import type { PersonalitySitting } from "@/lib/db/types";
import { logError } from "@/lib/error-utils";
import { ITEM_COUNT } from "@/lib/personality/items";
import { countAnswered } from "@/lib/personality/scoring";
import { startSitting } from "@/lib/personality/store";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";
import { formatDateShort } from "@/lib/time-utils";

/**
 * With a portrait on screen the page opens with the same centred masthead as
 * the Journal: a serif title, a small rule, and a quiet italic line. Before
 * there is one, the centred intro is the whole screen and the heading stays
 * for screen readers only.
 */
function YouLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  /** Shown under the title when there is a portrait; hides the masthead if absent. */
  subtitle?: string | null;
  children: ReactNode;
}) {
  const masthead = subtitle != null;
  return (
    <div className="relative isolate space-y-6 px-2 pb-24 pt-4 md:p-4 md:pb-24 [&>h1+*]:!mt-0 [&>header+*]:!mt-0">
      {masthead ? (
        <header className="flex flex-col items-center px-4 pb-0 pt-6 text-center">
          <h1 className="font-display text-[2.5rem] font-medium leading-[1.1] tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle && (
            <>
              <span
                aria-hidden="true"
                className="my-4 h-px w-10 bg-foreground/25"
              />
              <p className="max-w-[19rem] font-display text-[1.0625rem] italic leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            </>
          )}
        </header>
      ) : (
        <h1 className="sr-only">{title}</h1>
      )}
      {children}
    </div>
  );
}

/**
 * Content held in the middle of the free space between the top of the screen
 * and the tab bar. It scrolls on very short screens instead of being cut off.
 */
function CenteredScreen({
  labelledBy,
  children,
}: {
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="fixed inset-x-0 bottom-[var(--app-tab-bar-h,0px)] top-[var(--ios-status-shield,0px)] overflow-y-auto"
    >
      <div className="mx-auto flex min-h-full max-w-[20rem] flex-col items-center justify-center px-4 py-8 text-center">
        {children}
      </div>
    </section>
  );
}

/**
 * A test that was started and not finished. On its own it fills the screen;
 * above a finished result (a retake in progress) it is a short note.
 */
function ResumePrompt({
  centered,
  title,
  left,
  action,
  onResume,
}: {
  centered: boolean;
  title: string;
  left: string;
  action: string;
  onResume: () => void;
}) {
  const body = (
    <>
      <h2
        id="resume-test"
        className="font-display text-[1.375rem] italic leading-snug text-foreground/85"
      >
        {title}
      </h2>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">{left}</p>
      <Button type="button" className="mt-4" onClick={onResume}>
        {action}
      </Button>
    </>
  );
  if (centered) {
    return <CenteredScreen labelledBy="resume-test">{body}</CenteredScreen>;
  }
  return (
    <section
      aria-labelledby="resume-test"
      className="mx-auto flex max-w-[20rem] flex-col items-center px-4 pt-4 text-center"
    >
      {body}
    </section>
  );
}

/**
 * Who you are. Reflective, so editorial: the same centred masthead as the
 * Journal, and serif text set on the page rather than in a box. The portrait
 * comes from a short self-test scored on this device, and, only if asked, from
 * a reading of the journal by the person's own AI.
 */
export default function YouPage() {
  const { t } = useTranslation("you");
  const { t: tp } = useTranslation("personality");
  const range = useLookBackRange();
  const { data, reload } = usePersonality();
  const { data: daily, reload: reloadDaily } = useDailyQuestion();
  const [testing, setTesting] = useState<PersonalitySitting | null>(null);
  const [confirmRetake, setConfirmRetake] = useState(false);

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  const begin = useCallback(async () => {
    try {
      setTesting(await startSitting());
      scrollAppToTop();
    } catch (err) {
      logError("Starting the personality test", err);
    }
  }, []);

  const leaveTest = useCallback(() => {
    setTesting(null);
    reload();
  }, [reload]);

  const handleSaved = useCallback(
    (sitting: PersonalitySitting) => {
      if (sitting.completed_at) {
        setTesting(null);
        scrollAppToTop();
        reload();
      } else {
        setTesting(sitting);
      }
    },
    [reload]
  );

  if (testing) {
    return (
      <YouLayout title={t("title")}>
        <PersonalityTest
          key={testing.id}
          sitting={testing}
          onSaved={handleSaved}
          onLeave={leaveTest}
          onDiscarded={leaveTest}
        />
      </YouLayout>
    );
  }

  const latest = data?.completed[0] ?? null;
  const previous = data?.completed[1] ?? null;
  const current = data?.current ?? null;

  // The quiet line under the title: when the test was taken, what it is based
  // on, and how many days of journal the reading covered.
  const subtitle = latest
    ? [
        latest.completed_at
          ? tp("result.takenOn", {
              date: formatDateShort(new Date(latest.completed_at)),
            })
          : null,
        tp("result.basedOn"),
        data?.reading
          ? tp("result.journalPill", { count: data.reading.days_read })
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <YouLayout title={t("title")} subtitle={subtitle}>
      {current && (
        <ResumePrompt
          centered={!latest}
          title={tp("test.resumeTitle")}
          left={tp("test.resumeLeft", {
            count: ITEM_COUNT - countAnswered(current.answers),
          })}
          action={tp("test.resume")}
          onResume={() => {
            setTesting(current);
            scrollAppToTop();
          }}
        />
      )}

      {data && !latest && !current && (
        <CenteredScreen labelledBy="you-empty">
          <h2
            id="you-empty"
            className="font-display text-[1.625rem] italic leading-snug tracking-[-0.01em] text-foreground/85"
          >
            {t("empty.heading")}
          </h2>
          <p className="mt-4 font-display text-[1.0625rem] leading-relaxed text-muted-foreground">
            {t("empty.body")}
          </p>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
            {tp("test.intro")}
          </p>
          <Button type="button" className="mt-6" onClick={() => void begin()}>
            {tp("test.start")}
          </Button>
        </CenteredScreen>
      )}

      {latest && daily && (
        <DailyQuestion key={daily.date} data={daily} onChanged={reloadDaily} />
      )}

      {latest && (
        <>
          <PersonalityResult
            latest={latest}
            previous={previous}
            reading={data?.reading ?? null}
            evidence={daily?.evidence ?? null}
            portraitOnly={isYouMode}
          />
          <div className="flex flex-wrap justify-center gap-2">
            {!current && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmRetake(true)}
              >
                {tp("test.retake")}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/you/types">{tp("types.open")}</Link>
            </Button>
          </div>
          {!isYouMode && (
            <JournalReadingPanel
              reading={data?.reading ?? null}
              hasTest
              range={range}
              onRangeChange={setLookBackRange}
              onSaved={reload}
            />
          )}
        </>
      )}

      {latest && (
        <footer className="px-4 pt-2 text-center text-xs leading-relaxed text-muted-foreground">
          <p>{tp("funDisclaimer")}</p>
        </footer>
      )}

      <AlertDialog open={confirmRetake} onOpenChange={setConfirmRetake}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tp("test.retakeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tp("test.retakeBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tp("test.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void begin()}>
              {tp("test.retakeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </YouLayout>
  );
}
