import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, ChoiceGroupItem } from "@/components/ui/choice-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCrowdResult, type CrowdState } from "@/hooks/use-crowd-result";
import type { DailyQuestionData } from "@/hooks/use-daily-question";
import { logError } from "@/lib/error-utils";
import { MAX_WHY_LENGTH, type Question } from "@/lib/questions/bank";
import { sharePercent } from "@/lib/questions/crowd";
import { answerToday, setCrowdPreference } from "@/lib/questions/store";
import type { Streaks } from "@/lib/questions/streak";

function StreakPill({ streaks }: { streaks: Streaks }) {
  const { t } = useTranslation("you");
  if (streaks.best === 0) return null;
  const label =
    streaks.current > 0
      ? t("daily.streak", { count: streaks.current })
      : t("daily.streakBest", { count: streaks.best });
  return (
    <p className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80">
      <Flame aria-hidden="true" className="size-3.5 text-primary" />
      <span>{label}</span>
      {streaks.current > 0 && streaks.best > streaks.current && (
        <span className="text-muted-foreground">
          {t("daily.streakBestShort", { count: streaks.best })}
        </span>
      )}
    </p>
  );
}

function CrowdBars({
  question,
  state,
  mine,
}: {
  question: Question;
  state: Extract<CrowdState, { status: "ready" }>;
  mine: string;
}) {
  const { t } = useTranslation("you");
  const { t: tq } = useTranslation("questions");
  return (
    <>
      <ul className="space-y-3">
        {question.choices.map((choice) => {
          const percent = sharePercent(
            state.counts[choice.id] ?? 0,
            state.total
          );
          const isMine = choice.id === mine;
          return (
            <li key={choice.id}>
              <div className="flex items-baseline justify-between gap-3 text-[0.9375rem]">
                <span className="min-w-0 text-foreground">
                  {tq(`q.${question.id}.${choice.id}`)}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {t("daily.results.percent", { percent })}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={
                    isMine
                      ? "h-full rounded-full bg-primary"
                      : "h-full rounded-full bg-muted-foreground/40"
                  }
                  style={{ width: `${percent}%` }}
                />
              </div>
              {isMine && (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                  <Check aria-hidden="true" className="size-3" />
                  {t("daily.results.yours")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("daily.results.total", { count: state.total })}
      </p>
    </>
  );
}

function CrowdView({
  question,
  state,
  loading,
  mine,
  onRetry,
}: {
  question: Question;
  state: CrowdState;
  loading: boolean;
  mine: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation("you");

  if (state.status === "ready") {
    return <CrowdBars question={question} state={state} mine={mine} />;
  }
  if (loading || state.status === "idle") {
    return (
      <p className="text-[0.9375rem] text-muted-foreground" role="status">
        {t("daily.results.loading")}
      </p>
    );
  }
  if (state.status === "waiting") {
    return (
      <p className="text-[0.9375rem] text-muted-foreground" role="status">
        {t("daily.results.waiting")}
      </p>
    );
  }
  return (
    <div className="space-y-2" role="status">
      <p className="text-[0.9375rem] text-muted-foreground">
        {t(`daily.results.${state.status}`)}
      </p>
      {state.status !== "offline" && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t("daily.results.retry")}
        </Button>
      )}
    </div>
  );
}

/**
 * Today's question: pick an answer, optionally say why in a line only you can
 * read, then see how everyone answered. Changing your mind is allowed until the
 * day ends and rewrites the same answer.
 */
export function DailyQuestionCard({
  data,
  onChanged,
}: {
  data: DailyQuestionData;
  onChanged: () => void;
}) {
  const { t } = useTranslation("you");
  const { t: tq } = useTranslation("questions");
  const { question, today } = data;
  const [note, setNote] = useState(today?.why ?? "");
  const [saving, setSaving] = useState(false);

  const crowd = useCrowdResult(
    question.id,
    today
      ? { id: today.id, choiceId: today.choice_id, inCrowd: today.in_crowd }
      : null
  );

  const noteChanged = note.trim() !== (today?.why ?? "");

  const save = async (choiceId: string, why: string) => {
    setSaving(true);
    try {
      await answerToday({ choiceId, why });
      onChanged();
    } catch (err) {
      logError("Saving today's answer", err);
    } finally {
      setSaving(false);
    }
  };

  const toggleCrowd = async (inCrowd: boolean) => {
    try {
      await setCrowdPreference(inCrowd);
      onChanged();
    } catch (err) {
      logError("Changing the crowd preference", err);
    }
  };

  return (
    <section
      aria-labelledby="daily-question"
      className="rounded-3xl border border-border bg-card px-4 py-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="pt-1 text-[0.8125rem] font-medium text-muted-foreground">
          {t("daily.label")}
        </p>
        <StreakPill streaks={data.streaks} />
      </div>

      <h2
        id="daily-question"
        className="mt-2 font-display text-[1.375rem] italic leading-snug tracking-[-0.01em] text-foreground/90"
      >
        {tq(`q.${question.id}.prompt`)}
      </h2>

      <ChoiceGroup
        aria-labelledby="daily-question"
        value={today?.choice_id ?? ""}
        onValueChange={(choiceId) => void save(choiceId, note)}
        disabled={saving}
        className="mt-4"
      >
        {question.choices.map((choice) => (
          <ChoiceGroupItem key={choice.id} value={choice.id}>
            {tq(`q.${question.id}.${choice.id}`)}
          </ChoiceGroupItem>
        ))}
      </ChoiceGroup>

      {today ? (
        <div className="mt-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="daily-why">{t("daily.whyLabel")}</Label>
            <Textarea
              id="daily-why"
              value={note}
              maxLength={MAX_WHY_LENGTH}
              rows={2}
              placeholder={t("daily.whyPlaceholder")}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("daily.changeNote")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!noteChanged || saving}
                onClick={() => void save(today.choice_id, note)}
              >
                {t("daily.saveNote")}
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="mb-3 text-[0.8125rem] font-medium text-muted-foreground">
              {t("daily.results.heading")}
            </h3>
            <CrowdView
              question={question}
              state={crowd.state}
              loading={crowd.loading}
              mine={today.choice_id}
              onRetry={crowd.retry}
            />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-border pt-5">
            <div className="min-w-0">
              <Label htmlFor="daily-crowd" className="leading-snug">
                {t("daily.crowd.label")}
              </Label>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t("daily.crowd.hint")}
              </p>
            </div>
            <Switch
              id="daily-crowd"
              checked={data.inCrowd}
              onCheckedChange={(checked) => void toggleCrowd(checked)}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          {t("daily.unanswered")}
        </p>
      )}
    </section>
  );
}
