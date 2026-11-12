import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
import { usePersonality } from "@/hooks/use-personality";
import type { PersonalitySitting } from "@/lib/db/types";
import { logError } from "@/lib/error-utils";
import { ITEM_COUNT } from "@/lib/personality/items";
import { countAnswered } from "@/lib/personality/scoring";
import { startSitting } from "@/lib/personality/store";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";

/**
 * The page has no masthead of its own: the tab bar already says where you are,
 * and a title above the portrait only pushes it down. The heading stays for
 * screen readers.
 */
function YouLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate space-y-6 px-2 pb-24 pt-6 md:p-4 md:pb-24 [&>h1+*]:!mt-0">
      <h1 className="sr-only">{title}</h1>
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
  const { data, reload } = usePersonality();
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

  return (
    <YouLayout title={t("title")}>
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

      {latest && (
        <>
          <PersonalityResult
            latest={latest}
            previous={previous}
            reading={data?.reading ?? null}
            behaviour={data?.behaviour ?? null}
          />
          {!current && (
            <div className="flex justify-center pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmRetake(true)}
              >
                {tp("test.retake")}
              </Button>
            </div>
          )}
          <JournalReadingPanel
            reading={data?.reading ?? null}
            hasTest
            onSaved={reload}
          />
        </>
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
