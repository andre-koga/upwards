import { db } from "@/lib/db";
import {
  sessionsOnDay,
  sessionShareOfDay,
} from "@/lib/activity/period-day-utils";
import { loadHabitFacts } from "@/lib/ai/habit-facts";
import { parseJournalLocationRoute } from "@/lib/journal";
import {
  fromDateString,
  shiftDate,
  toDateString,
  todayDateString,
} from "@/lib/time-utils";
import {
  MAX_LETTER_HABITS,
  type LetterRequest,
} from "../../../../supabase/functions/_shared/letter";

const WINDOW_DAYS = 7;

export interface LetterRequestHabit {
  key: string;
  id: string;
  name: string;
}

/**
 * The week's words and the habit figures, for the letter only. Place names are
 * included; coordinates are not. Callers must not call this unless journal
 * reading is on.
 */
export async function buildLetterRequest(
  language: LetterRequest["language"]
): Promise<{ request: LetterRequest; habits: LetterRequestHabit[] }> {
  const today = todayDateString();
  const start = shiftDate(fromDateString(today), -(WINDOW_DAYS - 1));
  const dates = Array.from({ length: WINDOW_DAYS }, (_, index) =>
    toDateString(shiftDate(start, index))
  );
  const startStr = dates[0];
  const nowMs = Date.now();

  const [entries, memories, periods, facts] = await Promise.all([
    db.journalEntries
      .where("entry_date")
      .between(startStr, today, true, true)
      .filter((entry) => !entry.deleted_at)
      .toArray(),
    db.memories.filter((memory) => !memory.deleted_at).toArray(),
    db.activityPeriods.filter((period) => !period.deleted_at).toArray(),
    loadHabitFacts(today),
  ]);

  const entryByDate = new Map(
    entries.map((entry) => [entry.entry_date, entry])
  );
  const days = dates.map((date) => {
    const entry = entryByDate.get(date);
    const places = entry
      ? parseJournalLocationRoute(entry.location)
          .locations.map((place) => place.displayName.trim())
          .filter(Boolean)
      : [];
    const remembered = memories
      .filter((memory) => toDateString(new Date(memory.created_at)) === date)
      .map((memory) => {
        const label = memory.time_label?.trim() ?? "";
        const text = memory.text_content?.trim() ?? "";
        return [label, text].filter(Boolean).join(": ");
      })
      .filter(Boolean);
    const notes = sessionsOnDay(periods, date, nowMs)
      .map((period) => period.note?.trim() ?? "")
      .filter(Boolean);
    return {
      date,
      title: entry?.title?.trim() ?? "",
      text: entry?.text_content?.trim() ?? "",
      memories: remembered,
      places,
      notes,
    };
  });

  const kept = facts.slice(0, MAX_LETTER_HABITS);
  const habits: LetterRequestHabit[] = kept.map((habit, index) => ({
    key: String(index + 1),
    id: habit.id,
    name: habit.name,
  }));
  const minutesById = new Map<string, number>();
  for (const habit of kept) {
    let ms = 0;
    for (const date of dates) {
      for (const period of sessionsOnDay(periods, date, nowMs)) {
        if (period.activity_id !== habit.id) continue;
        const startMs = new Date(period.start_time).getTime();
        const endMs = period.end_time
          ? new Date(period.end_time).getTime()
          : null;
        ms += sessionShareOfDay(startMs, endMs, date, nowMs);
      }
    }
    minutesById.set(habit.id, Math.round(ms / 60000));
  }

  return {
    request: {
      range: "7d",
      weekStart: startStr,
      language,
      days,
      habits: kept.map((habit, index) => ({
        key: String(index + 1),
        name: habit.name,
        daysDone: habit.figures.daysDone,
        daysActive: habit.figures.daysActive,
        streak: habit.figures.streak,
        target: habit.figures.target,
        minutes: minutesById.get(habit.id) ?? 0,
      })),
    },
    habits,
  };
}
