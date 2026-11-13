import { useCallback, useState } from "react";
import { useAsyncData } from "@/hooks/use-async-data";
import { useDayResetTimer } from "@/hooks/use-day-reset-timer";
import type { QuestionAnswer } from "@/lib/db/types";
import { todayDateString } from "@/lib/time-utils";
import type { Question } from "@/lib/questions/bank";
import { questionForDate } from "@/lib/questions/daily";
import { tallyEvidence, type Evidence } from "@/lib/questions/evidence";
import { computeStreaks, type Streaks } from "@/lib/questions/streak";
import { crowdPreference, liveAnswers } from "@/lib/questions/store";

export interface DailyQuestionData {
  date: string;
  question: Question;
  /** Today's answer, if there is one. */
  today: QuestionAnswer | null;
  streaks: Streaks;
  evidence: Evidence;
  /** Whether answers are counted in the anonymous results. */
  inCrowd: boolean;
}

/** Today's question, the answer to it, and what the answers add up to. */
export function useDailyQuestion() {
  const [date, setDate] = useState(todayDateString);
  useDayResetTimer(useCallback(() => setDate(todayDateString()), []));

  return useAsyncData<DailyQuestionData>(async () => {
    const answers = await liveAnswers();
    return {
      date,
      question: questionForDate(date),
      today: answers.find((answer) => answer.answered_on === date) ?? null,
      streaks: computeStreaks(
        answers.map((answer) => answer.answered_on),
        date
      ),
      evidence: tallyEvidence(answers),
      inCrowd: crowdPreference(answers),
    };
  }, [date]);
}
