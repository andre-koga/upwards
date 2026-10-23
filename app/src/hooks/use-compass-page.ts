import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup, CompassItem } from "@/lib/db/types";
import { loadHabitFacts } from "@/lib/ai/habit-facts";
import { todayDateString } from "@/lib/time-utils";
import { groupCompassItems, type CompassSnapshot } from "@/lib/compass/compass";
import {
  describeActivityForCompass,
  describeGroupForCompass,
  type EvidenceActivity,
  type EvidenceGroup,
  type EvidenceWeek,
} from "@/lib/compass/goal-evidence";

export interface CompassPageData {
  /** False until the compass, activities and groups have been read once. */
  ready: boolean;
  snapshot: CompassSnapshot;
  activities: EvidenceActivity[];
  groups: EvidenceGroup[];
  /**
   * Null until the week's figures have been read. Callers show no evidence
   * line in that gap, rather than a count of zero.
   */
  weeks: EvidenceWeek[] | null;
}

const EMPTY_SNAPSHOT: CompassSnapshot = {
  northStar: null,
  identity: [],
  goals: [],
  knowledge: [],
  archived: [],
  deleted: [],
};

/**
 * The compass and the records a goal's evidence is read from. Writes go
 * through `lib/compass/compass`; this only watches the local database, so a
 * save or a sync shows up on its own.
 */
export function useCompassPage(): CompassPageData {
  const [items, setItems] = useState<CompassItem[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [groups, setGroups] = useState<ActivityGroup[] | null>(null);
  const [weeks, setWeeks] = useState<EvidenceWeek[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWeeks = () => {
      loadHabitFacts(todayDateString())
        .then((facts) => {
          if (cancelled) return;
          setWeeks(
            facts.map((habit) => ({
              activityId: habit.id,
              daysDone: habit.figures.daysDone,
              daysActive: habit.figures.daysActive,
              measure: habit.figures.type === "time-only" ? "tracked" : "done",
            }))
          );
        })
        .catch((error) => {
          console.error("Error reading goal evidence:", error);
          if (!cancelled) setWeeks([]);
        });
    };

    loadWeeks();
    const subscription = liveQuery(() =>
      Promise.all([
        db.compassItems.toArray(),
        db.activities.toArray(),
        db.activityGroups.toArray(),
      ])
    ).subscribe({
      next: ([nextItems, nextActivities, nextGroups]) => {
        setItems(nextItems);
        setActivities(nextActivities);
        setGroups(nextGroups);
        loadWeeks();
      },
      error: (error) => {
        console.error("Error reading the compass:", error);
        setItems((current) => current ?? []);
        setActivities((current) => current ?? []);
        setGroups((current) => current ?? []);
      },
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const groupRows = groups ?? [];
  return {
    ready: items !== null && activities !== null && groups !== null,
    snapshot: items ? groupCompassItems(items) : EMPTY_SNAPSHOT,
    activities: (activities ?? []).map((activity) =>
      describeActivityForCompass(
        activity,
        groupRows.find((group) => group.id === activity.group_id) ?? null
      )
    ),
    groups: groupRows.map(describeGroupForCompass),
    weeks,
  };
}
